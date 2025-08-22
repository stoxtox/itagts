// src/components/PlansPage.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Box, Typography, List, ListItem, ListItemText, IconButton, Button,
  Dialog, DialogTitle, DialogContent, TextField, Stack, Divider,
  CircularProgress, Snackbar, Alert, Paper, ListItemSecondaryAction,
  useTheme, useMediaQuery, Tooltip, Grid
} from "@mui/material";
import EditIcon          from "@mui/icons-material/Edit";
import DownloadIcon      from "@mui/icons-material/Download";
import UploadIcon        from "@mui/icons-material/UploadFile";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ArrowUpwardIcon   from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

import { db } from "../firebase";
import {
  collection, query, where, getDocs,
  updateDoc, addDoc, doc, deleteDoc, Timestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

/* DnD Kit */
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

  // Edit dialog state
  const [editing,setEditing]      = useState(null);
  const [name,   setName]         = useState("");
  const [anchors,setAnchors]      = useState(ANCHOR_KEYS.reduce((o,k)=>({...o,[k]:""}),{}));
  const [zupts,  setZupts]        = useState([]);

  // Touched & submit gating (no upfront errors)
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [planTouched, setPlanTouched]         = useState(false);
  const [anchorTouched, setAnchorTouched]     = useState(
    ANCHOR_KEYS.reduce((o,k)=>({...o,[k]:false}),{})
  );
  const [zuptTouched, setZuptTouched]         = useState([]); // array of {name,lat,lon,height,wait}

  const [snack,  setSnack]  = useState("");
  const fileRef             = useRef(null);

  /* fetch plans */
  const fetchPlans = async () => {
    if (!user) return;
    const snap = await getDocs(query(collection(db,"plans"),where("uid","==",user.uid)));
    setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { fetchPlans(); /* eslint-disable-next-line */ }, [user]);

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

  /* import (sanitize plan name to no-spaces) */
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
        name: `${(imported.name || "Plan").replace(/\s+/g,"")}-imported`,
        anchors: Object.fromEntries(
          ANCHOR_KEYS.map(k => [k, +imported.anchors?.[k] || 0])
        ),
        zupts: imported.zupts.map(z => ({
          id: uuid(), name:String(z.name||"").replace(/\s+/g,""),
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
  const startEdit = p => {
    setEditing(p);
    setName(p.name);
    setAnchors({ ...p.anchors });
    setZupts(p.zupts || []);
    setSubmitAttempted(false);
    setPlanTouched(false);
    setAnchorTouched(ANCHOR_KEYS.reduce((o,k)=>({...o,[k]:false}),{}));
    setZuptTouched((p.zupts||[]).map(()=>({name:false,lat:false,lon:false,height:false,wait:false})));
  };

  const updAnchor = (k,v) => setAnchors(a => ({ ...a, [k]:v }));
  const markAnchorTouched = (k) => setAnchorTouched(a => ({ ...a, [k]: true }));

  const updZupt   = (i,k,v) => setZupts(z => z.map((zu,idx)=> idx===i?{ ...zu,[k]:v }:zu));
  const markZuptTouched = (i,f) =>
    setZuptTouched(t => t.map((obj,idx)=> idx===i? { ...obj, [f]: true } : obj));

  const addZupt   = () => {
    setZupts(z => [...z, blankZup()]);
    setZuptTouched(t => [...t, {name:false,lat:false,lon:false,height:false,wait:false}]);
  };
  const insertZuptAt = (index) => {
    setZupts(z => {
      const copy=[...z]; copy.splice(index,0, blankZup()); return copy;
    });
    setZuptTouched(t => {
      const copy=[...t]; copy.splice(index,0, {name:false,lat:false,lon:false,height:false,wait:false}); return copy;
    });
  };
  const rmZupt    = i => {
    setZupts(z => z.filter((_,idx)=> idx!==i));
    setZuptTouched(t => t.filter((_,idx)=> idx!==i));
  };

  // 6-dp rounding on blur for lat/lon
  const handleLatLonBlur = (i, key, value) => {
    markZuptTouched(i, key);
    if (value === "" || !isFinite(+value)) return;
    updZupt(i, key, String(sixDP(value)));
  };

  /* validation (raw) */
  const anchorErrRaw = v => {
    if (v === "") return "Required";
    if (!isNum(v)) return "Number";
    return "";
  };

  const nameCounts = useMemo(() => {
    const m = new Map();
    (zupts||[]).forEach(z => {
      const k = String(z.name||"").trim().toLowerCase();
      if (!k) return;
      m.set(k, (m.get(k)||0)+1);
    });
    return m;
  }, [zupts]);

  const zuptErrRaw = z => ({
    name  : z.name==="" ? "Required" : (!noSpace(z.name) ? "No spaces" :
             ((nameCounts.get(String(z.name).trim().toLowerCase())||0)>1 ? "Duplicate" : "")),
    lat   : z.lat===""  ? "Required" : (!inRange(z.lat,-90,90)   ? "-90…90" : ""),
    lon   : z.lon===""  ? "Required" : (!inRange(z.lon,-180,180) ? "-180…180" : ""),
    height: z.height===""? "Required" : (!isNum(z.height) ? "Number" : ""),
    wait  : z.wait===""  ? "Required" : (!isNum(z.wait) || +z.wait<0 ? "≥ 0" : "")
  });

  const anchorErrors = useMemo(()=>Object.fromEntries(
    ANCHOR_KEYS.map(k => [k,anchorErrRaw(anchors[k])])
  ),[anchors]);

  const zuptErrors = useMemo(()=>zupts.map(zuptErrRaw),[zupts, nameCounts]);

  // gated display of errors
  const showAnchorErr = (k) => {
    const val = anchors[k]; const err = anchorErrors[k];
    if (!err) return "";
    if (val !== "" && err !== "Required") return err;
    if ((anchorTouched[k] || submitAttempted) && err) return err;
    return "";
  };

  const showZErr = (i,f) => {
    const val = zupts[i]?.[f] ?? ""; const err = zuptErrors[i]?.[f] ?? "";
    if (!err) return "";
    if (val !== "" && err !== "Required") return err;
    if ((zuptTouched[i]?.[f] || submitAttempted) && err) return err;
    return "";
  };

  // plan name: required, no spaces (sanitized input)
  const planNameErrRaw = (() => {
    if (name === "") return "Required";
    if (!noSpace(name)) return "No spaces";
    return "";
  })();
  const planNameErr = (() => {
    const val = name; const err = planNameErrRaw;
    if (!err) return "";
    if (val !== "" && err !== "Required") return err;
    if ((planTouched || submitAttempted) && err) return err;
    return "";
  })();

  const hasAnchorErrors = ANCHOR_KEYS.some(k => !!anchorErrRaw(anchors[k]));
  const hasZuptErrors   = zuptErrors.some(e => Object.values(e).some(Boolean));
  const hasZupts        = zupts.length > 0;
  const formOK = editing && !planNameErrRaw && !hasAnchorErrors && hasZupts && !hasZuptErrors;

  /* save */
  const save = async () => {
    setSubmitAttempted(true);
    if (!formOK) return;
    const cleanAnch = Object.fromEntries(ANCHOR_KEYS.map(k=>[k,+anchors[k]]));
    const cleanZ = zupts.map(z => ({
      id:z.id, name:z.name,
      lat:sixDP(z.lat), lon:sixDP(z.lon),
      height:+z.height, wait:+z.wait
    }));
    await updateDoc(doc(db,"plans",editing.id),{
      name:name, anchors:cleanAnch, zupts:cleanZ
    });
    fetchPlans();
    setSnack("Plan updated ✅");
    setEditing(null);
  };

  /* DnD Kit — define sensors ONCE (not inside JSX) */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 75, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = zupts.findIndex(z => z.id === active.id);
    const newIndex = zupts.findIndex(z => z.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setZupts(items => arrayMove(items, oldIndex, newIndex));
    setZuptTouched(items => arrayMove(items, oldIndex, newIndex));
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
                      {p.zupts?.length || 0} ZUPTs | PlanUID:{" "}
                      {p.planUid ? p.planUid.slice(-11).toUpperCase() : "—"}
                      <br />
                    </>
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
            fullWidth label="Plan Name" sx={{ mb:3 }}
            value={name}
            error={!!planNameErr}
            helperText={planNameErr || " "}
            onChange={e => setName(e.target.value.replace(/\s+/g,""))}
            onBlur={() => setPlanTouched(true)}
            onKeyDown={(e) => { if (e.key === " ") e.preventDefault(); }}
          />

          <Typography variant="subtitle2" gutterBottom>Anchor Points</Typography>
          <Stack direction={{ xs:"column", sm:"row" }} spacing={2} sx={{ mb:3 }}>
            {ANCHOR_KEYS.map(k => {
              const errText = showAnchorErr(k);
              return (
                <TextField
                  key={k} label={k} type="number"
                  value={anchors[k]}
                  error={!!errText}
                  helperText={errText || " "}
                  onChange={e => updAnchor(k, e.target.value)}
                  onBlur={() => markAnchorTouched(k)}
                  sx={{ width:{ xs:"100%", sm:110 } }}
                />
              );
            })}
          </Stack>

          <Divider sx={{ mb:2 }} />

          {/* ZUPTs with DnD + insert/remove, 3-row layout */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={zupts.map(z => z.id)} strategy={verticalListSortingStrategy}>
              {zupts.map((z,i)=>(
                <SortableZuptRow
                  key={z.id}
                  id={z.id}
                  index={i}
                  z={z}
                  isMobile={isMobile}
                  showZErr={showZErr}
                  updZupt={updZupt}
                  rmZupt={rmZupt}
                  insertZuptAt={insertZuptAt}
                  handleLatLonBlur={handleLatLonBlur}
                  markZuptTouched={markZuptTouched}
                />
              ))}
            </SortableContext>
          </DndContext>

          <Stack direction="row" spacing={2} mt={2}>
            <Button variant="outlined" onClick={addZupt}>➕ Add ZUPT</Button>
            <Tooltip
              title={
                !formOK
                  ? (!name || planNameErr ? "Enter a Plan Name (no spaces)." :
                     ANCHOR_KEYS.some(k=>!!anchorErrRaw(anchors[k])) ? "Fix anchor fields (numbers)." :
                     !zupts.length ? "Add at least one ZUPT." :
                     "Fix ZUPT fields (required/valid/unique).")
                  : ""
              }
              disableHoverListener={formOK}
            >
              <span>
                <Button variant="contained" disabled={!formOK} onClick={save}>💾 Save Changes</Button>
              </span>
            </Tooltip>
          </Stack>
        </DialogContent>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={2600} onClose={() => setSnack("")}>
        <Alert severity="success" variant="filled" sx={{ width:"100%" }}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}

/* ─── Sortable ZUPT Row ─── */
function SortableZuptRow({
  id, index, z, isMobile,
  showZErr, updZupt, rmZupt, insertZuptAt,
  handleLatLonBlur, markZuptTouched
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      variant="outlined"
      sx={{
        p: isMobile ? 1.5 : 2,
        mb: 2,
        borderLeft: "5px solid #6366f1",
        bgcolor: isMobile ? "grey.50" : undefined,
        cursor: "grab"
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton size="small" {...attributes} {...listeners} aria-label="Drag handle">
            <DragIndicatorIcon fontSize="inherit" />
          </IconButton>
          <Typography fontWeight="bold">ZUPT {index+1}</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Insert above">
            <IconButton size="small" onClick={() => insertZuptAt(index)}>
              <ArrowUpwardIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Insert below">
            <IconButton size="small" onClick={() => insertZuptAt(index+1)}>
              <ArrowDownwardIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove">
            <IconButton color="error" size="small" onClick={() => rmZupt(index)}>
              <DeleteForeverIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* 3-row layout */}
      <Grid container spacing={2}>
        {/* Row 1: Name */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Name"
            value={z.name}
            error={!!showZErr(index,"name")}
            helperText={showZErr(index,"name") || " "}
            onChange={e => updZupt(index, "name", e.target.value.replace(/\s+/g,""))}
            onBlur={() => markZuptTouched(index, "name")}
            onKeyDown={(e) => { if (e.key === " ") e.preventDefault(); }}
          />
        </Grid>

        {/* Row 2: Lat / Lon */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Latitude"
            type="number"
            value={z.lat}
            error={!!showZErr(index,"lat")}
            helperText={showZErr(index,"lat") || " "}
            onChange={e => updZupt(index, "lat", e.target.value)}
            onBlur={e => handleLatLonBlur(index, "lat", e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Longitude"
            type="number"
            value={z.lon}
            error={!!showZErr(index,"lon")}
            helperText={showZErr(index,"lon") || " "}
            onChange={e => updZupt(index, "lon", e.target.value)}
            onBlur={e => handleLatLonBlur(index, "lon", e.target.value)}
          />
        </Grid>

        {/* Row 3: Wait / Height */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Wait (s)"
            type="number"
            value={z.wait}
            error={!!showZErr(index,"wait")}
            helperText={showZErr(index,"wait") || " "}
            onChange={e => updZupt(index, "wait", e.target.value)}
            onBlur={() => markZuptTouched(index, "wait")}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Height (m)"
            type="number"
            value={z.height}
            error={!!showZErr(index,"height")}
            helperText={showZErr(index,"height") || " "}
            onChange={e => updZupt(index, "height", e.target.value)}
            onBlur={() => markZuptTouched(index, "height")}
          />
        </Grid>
      </Grid>
    </Paper>
  );
}
