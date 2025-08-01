// src/components/PlansPage.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Box, Typography, List, ListItem, ListItemText, IconButton, Button,
  Dialog, DialogTitle, DialogContent, TextField, Stack, Divider,
  CircularProgress, Snackbar, Alert, Paper, ListItemSecondaryAction,
  useTheme, useMediaQuery, Tooltip
} from "@mui/material";
import EditIcon          from "@mui/icons-material/Edit";
import DownloadIcon      from "@mui/icons-material/Download";
import UploadIcon        from "@mui/icons-material/UploadFile";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import { db } from "../firebase";
import {
  collection, query, where, getDocs,
  updateDoc, addDoc, doc, deleteDoc, Timestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

/* ─── helpers ─── */
const ANCHOR_KEYS = ["A1", "A2", "A3", "B1", "B2", "B3"];
const isNum    = v => v !== "" && Number.isFinite(+v);
const inRange  = (v, lo, hi) => isNum(v) && +v >= lo && +v <= hi;
const noSpace  = (s = "") => !/\s/.test(s);
const sixDP    = v => Number(Number(v).toFixed(6));
const uuid     = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const blankZup = () => ({ id: uuid(), name:"", lat:"", lon:"", height:"", wait:"" });

export default function PlansPage() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const user     = getAuth().currentUser;

  const [plans,  setPlans]  = useState(null);
  const [editing,setEditing]= useState(null);
  const [name,   setName]   = useState("");
  const [anchors,setAnchors]= useState(ANCHOR_KEYS.reduce((o,k)=>({...o,[k]:""}),{}));
  const [zupts,  setZupts]  = useState([]);
  const [snack,  setSnack]  = useState("");
  const fileRef             = useRef(null);

  /* fetch plans */
  const fetchPlans = async () => {
    if (!user) return;
    const snap = await getDocs(query(collection(db,"plans"),where("uid","==",user.uid)));
    setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { fetchPlans(); }, [user]);

  /* delete plan */
  const deletePlan = async p => {
    if (!window.confirm(`Delete plan “${p.name}” permanently?`)) return;
    await deleteDoc(doc(db,"plans",p.id));
    fetchPlans();
    setSnack("Plan deleted 🗑️");
  };

  /* export */
  const exportPlan = p => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(p,null,2)], { type:"application/json" })
    );
    Object.assign(document.createElement("a"),{
      href:url, download:`Plan-${p.name||p.id}.json`
    }).click();
    URL.revokeObjectURL(url);
  };

  /* import */
  const handleImportFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported.name || !Array.isArray(imported.zupts)) {
        alert("Invalid plan file"); return;
      }
      const planDoc = {
        uid: user.uid,
        planUid: uuid(),
        name: `${imported.name} (imported)`,
        anchors: Object.fromEntries(
          ANCHOR_KEYS.map(k => [k, +imported.anchors?.[k] || 0])
        ),
        zupts: imported.zupts.map(z => ({
          id: uuid(), name:z.name,
          lat: sixDP(z.lat), lon: sixDP(z.lon),
          height: +z.height, wait: +z.wait
        })),
        createdAt: Timestamp.now()
      };
      await addDoc(collection(db,"plans"), planDoc);
      fetchPlans();
      setSnack("Plan imported ✅");
    } catch (err) {
      console.error(err);
      alert("Import failed – invalid JSON?");
    } finally { e.target.value = ""; }
  };

  /* edit helpers */
  const startEdit = p => { setEditing(p); setName(p.name); setAnchors({ ...p.anchors }); setZupts(p.zupts); };
  const updAnchor = (k,v) => setAnchors(a => ({ ...a, [k]:v }));
  const updZupt   = (i,k,v) => setZupts(z => z.map((zu,idx)=> idx===i?{ ...zu,[k]:v }:zu));
  const addZupt   = () => setZupts(z => [...z, blankZup()]);
  const rmZupt    = i => setZupts(z => z.filter((_,idx)=> idx!==i));

  const anchorErr = v=> v!=="" && !isNum(v)? "number" : "";
  const zuptErr = z => ({
    name  : z.name!==""  && !noSpace(z.name) ? "no spaces" : "",
    lat   : z.lat!==""   && !inRange(z.lat,-90,90)? "-90…90": "",
    lon   : z.lon!==""   && !inRange(z.lon,-180,180)? "-180…180": "",
    height: z.height!==""&& !isNum(z.height) ? "number" : "",
    wait  : z.wait!==""  && !isNum(z.wait)   ? "number" : ""
  });
  const anchorErrors = useMemo(()=>Object.fromEntries(
    ANCHOR_KEYS.map(k => [k,anchorErr(anchors[k])])
  ),[anchors]);
  const zuptErrors = useMemo(()=>zupts.map(zuptErr),[zupts]);

  const formOK = editing && noSpace(name) &&
    ANCHOR_KEYS.every(k => isNum(anchors[k])) &&
    zupts.length &&
    zupts.every(z =>
      Object.values(zuptErr(z)).every(e=>!e) &&
      ["name","lat","lon","height","wait"].every(f => z[f] !== "")
    );

  const save = async () => {
    if (!formOK) return;
    const cleanAnch = Object.fromEntries(ANCHOR_KEYS.map(k=>[k,+anchors[k]]));
    const cleanZ = zupts.map(z => ({
      id:z.id, name:z.name,
      lat:sixDP(z.lat), lon:sixDP(z.lon),
      height:+z.height, wait:+z.wait
    }));
    await updateDoc(doc(db,"plans",editing.id),{
      name:name.trim(), anchors:cleanAnch, zupts:cleanZ
    });
    fetchPlans();
    setSnack("Plan updated ✅");
    setEditing(null);
  };

  if (!plans) return <CircularProgress />;

  /* ─── UI ─── */
  return (
    <Box>
      {/* hidden import input */}
      <input
        type="file" accept="application/json" ref={fileRef}
        style={{ display:"none" }} onChange={handleImportFile}
      />

      {/* header */}
      <Stack
        direction={isMobile ? "column" : "row"}
        justifyContent="space-between"
        spacing={isMobile ? 1 : 0}
        mb={2}
      >
        <Typography variant="h6">Your Plans</Typography>
        <Button
          fullWidth={isMobile}
          size="small"
          variant="contained"
          color="secondary"
          startIcon={<UploadIcon />}
          onClick={() => fileRef.current?.click()}
          sx={{ whiteSpace:"nowrap", minWidth:0 }}
        >
          Import plan
        </Button>
      </Stack>

      {/* list or empty-state */}
      {plans.length ? (
        <Paper variant="outlined">
          <List dense>
            {plans.map(p => (
              <ListItem key={p.id} sx={{ alignItems:"flex-start" }}>
                <ListItemText
    primary={p.name}
    secondary={
      <>
        {p.zupts.length} ZUPTs | PlanUID:{" "}
        {p.planUid
          ? p.planUid.slice(-11).toUpperCase()
          : "—"}
        <br /></>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Export JSON">
                      <IconButton size="small" onClick={() => exportPlan(p)}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => startEdit(p)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => deletePlan(p)}
                      >
                        <DeleteForeverIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      ) : (
        <Paper
          variant="outlined"
          sx={{ p:3, textAlign:"center", bgcolor:"background.default" }}
        >
          <Typography>No plans saved yet.</Typography>
          <Typography variant="body2" sx={{ mt:1 }}>
            Import a plan file to get started.
          </Typography>
          <Button
            size="small"
            variant="contained"
            sx={{ mt:2 }}
            startIcon={<UploadIcon />}
            onClick={() => fileRef.current?.click()}
          >
            Import plan
          </Button>
        </Paper>
      )}

      {/* edit dialog */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Plan</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth label="Plan Name (no spaces)" sx={{ mb:3 }}
            value={name}
            error={!!name && !noSpace(name)}
            helperText={!!name && !noSpace(name) ? "No spaces allowed" : " "}
            onChange={e => setName(e.target.value)}
          />

          <Typography variant="subtitle2" gutterBottom>Anchor Points</Typography>
          <Stack direction={{ xs:"column", sm:"row" }} spacing={2} sx={{ mb:3 }}>
            {ANCHOR_KEYS.map(k => (
              <TextField
                key={k} label={k} type="number"
                value={anchors[k]}
                error={!!anchorErrors[k]}
                helperText={anchorErrors[k] || " "}
                onChange={e => updAnchor(k, e.target.value)}
                sx={{ width:{ xs:"100%", sm:110 } }}
              />
            ))}
          </Stack>

          <Divider sx={{ mb:2 }} />
          {zupts.map((z,i) => (
            <Paper
              key={z.id} variant="outlined"
              sx={{ p:2, mb:2, borderLeft:"5px solid #6366f1" }}
            >
              <Typography fontWeight="bold" mb={1}>ZUPT {i+1}</Typography>
              <Stack spacing={2}>
                {["name","lat","lon","height","wait"].map(f => (
                  <TextField
                    key={f}
                    label={{
                      name:"Name (no spaces)", lat:"Latitude", lon:"Longitude",
                      height:"Height (m)", wait:"Wait (s)"
                    }[f]}
                    type={f==="name"?"text":"number"}
                    value={z[f]}
                    error={!!zuptErrors[i][f]}
                    helperText={zuptErrors[i][f] || " "}
                    onChange={e => updZupt(i, f, e.target.value)}
                  />
                ))}
                <Button color="error" onClick={() => rmZupt(i)}>
                  Remove ZUPT
                </Button>
              </Stack>
            </Paper>
          ))}

          <Stack direction="row" spacing={2} mt={2}>
            <Button variant="outlined" onClick={addZupt}>➕ Add ZUPT</Button>
            <Button variant="contained" disabled={!formOK} onClick={save}>💾 Save Changes</Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={2600} onClose={() => setSnack("")}>
        <Alert severity="success" variant="filled" sx={{ width:"100%" }}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
