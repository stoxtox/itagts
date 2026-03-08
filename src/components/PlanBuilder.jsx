// src/components/PlanBuilder.jsx
// DnD reorder + insert above/below + no upfront errors (touched/submit-gated)
// no spaces in names, 6dp lat/lon, 3-row ZUPT layout, unique names,
// snackbar + save tooltip + KML import.

import React, { useMemo, useState } from "react";
import {
  Box, TextField, Typography, Button, Stack, Divider, Paper, Grid,
  useTheme, useMediaQuery, Tooltip, Snackbar, Alert, IconButton
} from "@mui/material";
import AddIcon from "@mui/icons-material/AddCircleOutline";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/* ---------- DND Kit ---------- */
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

/* ---------- helpers ---------- */
const newZupt = () => ({
  id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  name: "", lat: "", lon: "", height: "", wait: ""
});
const isNum   = v => v !== "" && Number.isFinite(+v);
const inRange = (v, lo, hi) => isNum(v) && +v >= lo && +v <= hi;
const noSpace = s => !/\s/.test(s);
const sixDP   = v => Number(Number(v).toFixed(6));

const anchorLabels = {
  A1: "A1  (Lat SD)",
  A2: "A2  (Lon SD)",
  A3: "A3  (Ht SD)",
  B1: "B1  (Lever X, m)",
  B2: "B2  (Lever Y, m)",
  B3: "B3  (Lever Z, m)"
};

export default function PlanBuilder() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [planName, setPlanName] = useState("");
  const [anchors,  setAnchors]  = useState({ A1: "0.1", A2: "0.1", A3: "0.1", B1: "0", B2: "0", B3: "0" });
  const [zupts,    setZupts]    = useState([]);

  // touch / submit gating
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [anchorTouched, setAnchorTouched] = useState({ A1:false, A2:false, A3:false, B1:false, B2:false, B3:false });
  const [zuptTouched, setZuptTouched] = useState([]);
  const [planTouched, setPlanTouched] = useState(false);

  // Snackbar UX
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
  const showSnack = (msg, severity="success") => setSnack({ open: true, msg, severity });

  /* ---------- updates ---------- */
  const updateAnchor = (k, v) => setAnchors(p => ({ ...p, [k]: v }));

  const addZuptEnd = () => {
    setZupts(p => [...p, newZupt()]);
    setZuptTouched(t => [...t, { name:false, lat:false, lon:false, height:false, wait:false }]);
  };

  const insertZuptAt = (index) => {
    setZupts(p => {
      const copy = [...p];
      copy.splice(index, 0, newZupt());
      return copy;
    });
    setZuptTouched(t => {
      const copy = [...t];
      copy.splice(index, 0, { name:false, lat:false, lon:false, height:false, wait:false });
      return copy;
    });
  };

  const updateZupt = (i, k, v) =>
    setZupts(p => p.map((z, idx) => (idx === i ? { ...z, [k]: v } : z)));

  const removeZupt = i => {
    setZupts(p => p.filter((_, idx) => idx !== i));
    setZuptTouched(t => t.filter((_, idx) => idx !== i));
  };

  const markAnchorTouched = (k) => setAnchorTouched(p => ({ ...p, [k]: true }));
  const markZuptTouched = (i, f) =>
    setZuptTouched(t => t.map((obj, idx) => idx === i ? { ...obj, [f]: true } : obj));

  // Enforce 6dp on lat/lon blur if numeric
  const handleLatLonBlur = (i, key, value) => {
    markZuptTouched(i, key);
    if (value === "" || !isFinite(+value)) return;
    updateZupt(i, key, String(sixDP(value)));
  };

  /* ---------- KML Import ---------- */
  const handleImportKml = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");

      const placemarks = Array.from(xmlDoc.getElementsByTagName("Placemark"));

      const newZupts = placemarks.map(pm => {
        const name = pm.getElementsByTagName("name")[0]?.textContent ?? "";
        const coords = pm.getElementsByTagName("coordinates")[0]?.textContent ?? "";
        const [lon, lat, height] = coords.split(",").map(v => v.trim());

        return {
          id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          name: name.replace(/\s+/g, ""), // enforce no spaces
          lat: sixDP(lat),
          lon: sixDP(lon),
          height: height ? +height : 0,
          wait: 0
        };
      });

      setZupts(newZupts);
      setZuptTouched(newZupts.map(() => ({ name:false, lat:false, lon:false, height:false, wait:false })));

      showSnack("✅ KML imported!");
    } catch (err) {
      console.error(err);
      showSnack("Failed to import KML", "error");
    }
  };

  /* ---------- validation ---------- */
  const rawAnchorErr = v => {
    if (v === "") return "Required";
    if (!isNum(v)) return "Number";
    return "";
  };

  // name duplicate map
  const nameCounts = useMemo(() => {
    const m = new Map();
    zupts.forEach(z => {
      const key = z.name.trim().toLowerCase();
      if (!key) return;
      m.set(key, (m.get(key) || 0) + 1);
    });
    return m;
  }, [zupts]);

  const rawZuptErr = z => {
    const errs = { name:"", lat:"", lon:"", height:"", wait:"" };
    if (z.name === "") errs.name = "Required";
    else if (!noSpace(z.name)) errs.name = "No spaces";
    else if ((nameCounts.get(z.name.trim().toLowerCase()) || 0) > 1) errs.name = "Duplicate";
    if (z.lat === "") errs.lat = "Required";
    else if (!inRange(z.lat, -90, 90)) errs.lat = "-90…90";
    if (z.lon === "") errs.lon = "Required";
    else if (!inRange(z.lon, -180, 180)) errs.lon = "-180…180";
    if (z.height === "") errs.height = "Required";
    else if (!isNum(z.height)) errs.height = "Number";
    if (z.wait === "") errs.wait = "Required";
    else if (!isNum(z.wait) || +z.wait < 0) errs.wait = "≥ 0";
    return errs;
  };

  const anchorErrors = Object.fromEntries(
    Object.entries(anchors).map(([k, v]) => [k, rawAnchorErr(v)])
  );
  const zuptErrors = zupts.map(rawZuptErr);

  const showAnchorErr = (k) => {
    const val = anchors[k];
    const err = anchorErrors[k];
    if (!err) return "";
    if (val !== "" && err !== "Required") return err;
    if ((anchorTouched[k] || submitAttempted) && err) return err;
    return "";
  };

  const showZErr = (i, f) => {
    const val = zupts[i]?.[f] ?? "";
    const err = zuptErrors[i]?.[f] ?? "";
    if (!err) return "";
    if (val !== "" && err !== "Required") return err;
    if ((zuptTouched[i]?.[f] || submitAttempted) && err) return err;
    return "";
  };

  const planNameErrRaw = (() => {
    if (planName === "") return "Required";
    if (!noSpace(planName)) return "No spaces";
    return "";
  })();

  const planNameErr = (() => {
    const val = planName;
    const err = planNameErrRaw;
    if (!err) return "";
    if (val !== "" && err !== "Required") return err;
    if ((planTouched || submitAttempted) && err) return err;
    return "";
  })();

  const hasAnchorErrors = Object.keys(anchors).some(k => !!rawAnchorErr(anchors[k]));
  const hasZuptErrors   = zuptErrors.some(e => Object.values(e).some(Boolean));
  const hasZupts        = zupts.length > 0;
  const formOK = !planNameErrRaw && !hasAnchorErrors && hasZupts && !hasZuptErrors;

  const disabledReason = useMemo(() => {
    if (!planName || !!planNameErrRaw) return "Enter a Plan Name (no spaces).";
    if (hasAnchorErrors) return "Fix anchor fields (numbers required).";
    if (!hasZupts) return "Add at least one ZUPT.";
    if (hasZuptErrors) return "Fix ZUPT fields (required/valid/unique).";
    return "";
  }, [planName, planNameErrRaw, hasAnchorErrors, hasZupts, hasZuptErrors]);

  /* ---------- DND ---------- */
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

    setZupts((items) => arrayMove(items, oldIndex, newIndex));
    setZuptTouched((items) => arrayMove(items, oldIndex, newIndex));
  };

  /* ---------- save ---------- */
  const savePlan = async () => {
    setSubmitAttempted(true);
    if (!formOK) return;
    const user = getAuth().currentUser;
    if (!user) { showSnack("Login required", "error"); return; }

    const docBody = {
      uid: user.uid,
      planUid: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      name: planName,
      anchors: Object.fromEntries(Object.entries(anchors).map(([k, v]) => [k, +v])),
      zupts: zupts.map(z => ({
        id: z.id, name: z.name,
        lat: sixDP(z.lat), lon: sixDP(z.lon),
        height: +z.height, wait: +z.wait
      })),
      createdAt: Timestamp.now()
    };

    try {
      await addDoc(collection(db, "plans"), docBody);
      showSnack("✅ Plan saved!");
      setSubmitAttempted(false);
      setPlanTouched(false);
      setPlanName("");
      setAnchors({ A1: "0.1", A2: "0.1", A3: "0.1", B1: "0", B2: "0", B3: "0" });
      setZupts([]);
      setZuptTouched([]);
      setAnchorTouched({ A1:false, A2:false, A3:false, B1:false, B2:false, B3:false });
    } catch (e) {
      console.error(e);
      showSnack("Save failed", "error");
    }
  };

  /* ---------- UI ---------- */
  return (
    <Box sx={{ maxWidth: isMobile ? "100%" : 900, mx: "auto", px: isMobile ? 1 : 2 }}>
      {/* ─── Step 1: Plan Name ─── */}
      <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
        <Box sx={{
          width: 24, height: 24, borderRadius: "50%",
          bgcolor: "primary.main", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700,
        }}>1</Box>
        <Typography variant="subtitle1" fontWeight={600}>Name your plan</Typography>
      </Stack>
      <TextField
        label="Plan Name"
        fullWidth
        sx={{ mb: 3 }}
        value={planName}
        error={!!planNameErr}
        helperText={planNameErr || " "}
        onChange={e => setPlanName(e.target.value.replace(/\s+/g, ""))}
        onBlur={() => setPlanTouched(true)}
        onKeyDown={(e) => { if (e.key === " ") e.preventDefault(); }}
      />

      {/* ─── Step 2: Anchor Points ─── */}
      <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
        <Box sx={{
          width: 24, height: 24, borderRadius: "50%",
          bgcolor: "primary.main", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700,
        }}>2</Box>
        <Typography variant="subtitle1" fontWeight={600}>Anchor points</Typography>
        <Typography variant="caption" color="text.secondary">(A = SDs, B = Lever Arm [m])</Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        {["A1", "A2", "A3"].map(renderAnchor)}
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {["B1", "B2", "B3"].map(renderAnchor)}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* ─── Step 3: ZUPTs ─── */}
      <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
        <Box sx={{
          width: 24, height: 24, borderRadius: "50%",
          bgcolor: "primary.main", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700,
        }}>3</Box>
        <Typography variant="subtitle1" fontWeight={600}>Add ZUPTs</Typography>
        {zupts.length > 0 && (
          <Box sx={{
            bgcolor: "primary.50", color: "primary.main",
            borderRadius: 1, px: 0.75, py: 0.1,
            fontSize: 11, fontWeight: 600,
          }}>
            {zupts.length} added
          </Box>
        )}
      </Stack>

      {/* ZUPTs */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={zupts.map(z => z.id)} strategy={verticalListSortingStrategy}>
          {zupts.map((z, i) => (
            <SortableZuptCard
              key={z.id}
              id={z.id}
              index={i}
              z={z}
              isMobile={isMobile}
              showZErr={showZErr}
              updateZupt={updateZupt}
              removeZupt={removeZupt}
              insertZuptAt={insertZuptAt}
              handleLatLonBlur={handleLatLonBlur}
              markZuptTouched={markZuptTouched}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Actions */}
      <Stack direction={isMobile ? "column" : "row"} spacing={2} sx={{ mt: 2 }}>
        <Button variant="outlined" startIcon={<AddIcon />} fullWidth={isMobile} onClick={addZuptEnd}>
          Add ZUPT
        </Button>

        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileIcon />}
          fullWidth={isMobile}
        >
          Import KML
          <input type="file" hidden accept=".kml" onChange={handleImportKml} />
        </Button>

        <Tooltip title={!formOK ? disabledReason : ""} disableHoverListener={formOK}>
          <span style={{ width: isMobile ? "100%" : "auto" }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              fullWidth={isMobile}
              disabled={!formOK}
              onClick={savePlan}
            >
              Save Plan
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} sx={{ width: "100%" }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );

  /* ---------- UI helpers ---------- */
  function renderAnchor(k) {
    const errText = showAnchorErr(k);
    return (
      <TextField
        key={k}
        label={anchorLabels[k]}
        type="number"
        value={anchors[k]}
        error={!!errText}
        helperText={errText || " "}
        onChange={e => updateAnchor(k, e.target.value)}
        onBlur={() => markAnchorTouched(k)}
        size="small"
        inputProps={{ step: "0.1" }}
        sx={{ flex: 1, minWidth: 120 }}
      />
    );
  }
}

/* ---------- Sortable ZUPT Card ---------- */
function SortableZuptCard({
  id, index, z, isMobile,
  showZErr, updateZupt, removeZupt, insertZuptAt,
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
        borderLeft: "5px solid",
        borderLeftColor: "secondary.main",
        bgcolor: isMobile ? "action.hover" : undefined,
        cursor: "grab"
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton size="small" {...attributes} {...listeners} aria-label="Drag handle">
            <DragIndicatorIcon fontSize="inherit" />
          </IconButton>
          <Typography fontWeight={600}>ZUPT {index + 1}</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Insert above">
            <IconButton size="small" onClick={() => insertZuptAt(index)}>
              <ArrowUpwardIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Insert below">
            <IconButton size="small" onClick={() => insertZuptAt(index + 1)}>
              <ArrowDownwardIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove">
            <IconButton color="error" size="small" onClick={() => removeZupt(index)}>
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* 3-row layout (responsive) */}
      <Grid container spacing={2}>
        {/* Row 1: Name */}
        <Grid size={12}>
          <TextField
            fullWidth
            label="Name"
            value={z.name}
            error={!!showZErr(index, "name")}
            helperText={showZErr(index, "name") || " "}
            onChange={e => updateZupt(index, "name", e.target.value.replace(/\s+/g, ""))}
            onBlur={() => markZuptTouched(index, "name")}
            onKeyDown={(e) => { if (e.key === " ") e.preventDefault(); }}
          />
        </Grid>

        {/* Row 2: Lat / Lon */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Latitude"
            type="number"
            value={z.lat}
            error={!!showZErr(index, "lat")}
            helperText={showZErr(index, "lat") || " "}
            onChange={e => updateZupt(index, "lat", e.target.value)}
            onBlur={e => handleLatLonBlur(index, "lat", e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Longitude"
            type="number"
            value={z.lon}
            error={!!showZErr(index, "lon")}
            helperText={showZErr(index, "lon") || " "}
            onChange={e => updateZupt(index, "lon", e.target.value)}
            onBlur={e => handleLatLonBlur(index, "lon", e.target.value)}
          />
        </Grid>

        {/* Row 3: Wait / Height */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Wait (s)"
            type="number"
            value={z.wait}
            error={!!showZErr(index, "wait")}
            helperText={showZErr(index, "wait") || " "}
            onChange={e => updateZupt(index, "wait", e.target.value)}
            onBlur={() => markZuptTouched(index, "wait")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Height (m)"
            type="number"
            value={z.height}
            error={!!showZErr(index, "height")}
            helperText={showZErr(index, "height") || " "}
            onChange={e => updateZupt(index, "height", e.target.value)}
            onBlur={() => markZuptTouched(index, "height")}
          />
        </Grid>
      </Grid>
    </Paper>
  );
}
