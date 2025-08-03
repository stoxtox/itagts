// src/components/PlanBuilder.jsx
// Two-row anchors on mobile, single row on desktop, full-width flex inputs.

import React, { useState } from "react";
import {
  Box, TextField, Typography, Button, Stack, Divider, Paper,
  useTheme, useMediaQuery
} from "@mui/material";
import AddIcon    from "@mui/icons-material/AddCircleOutline";
import SaveIcon   from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/* ---------- helpers ---------- */
const newZupt = () => ({
  id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  name: "", lat: "", lon: "", height: "", wait: ""
});
const isNum = v => v !== "" && Number.isFinite(+v);
const inRange = (v, lo, hi) => isNum(v) && +v >= lo && +v <= hi;
const noSpace = s => !/\s/.test(s);
const sixDP   = v => Number(Number(v).toFixed(6));

const anchorLabels = {
  A1: "A1  (Lat)",
  A2: "A2  (Lon)",
  A3: "A3  (Ht)",
  B1: "B1  (Lever X)",
  B2: "B2  (Lever Y)",
  B3: "B3  (Lever Z)"
};

/* ---------- component ---------- */
export default function PlanBuilder() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [planName, setPlanName] = useState("");
  const [anchors,  setAnchors]  = useState({
    A1: "0.1",   A2: "0.1",   A3: "0.1",
    B1: "0", B2: "0", B3: "0"
  });
  const [zupts,    setZupts]    = useState([]);

  /* updates */
  const updateAnchor = (k, v) => setAnchors(p => ({ ...p, [k]: v }));
  const addZupt      = ()     => setZupts(p => [...p, newZupt()]);
  const updateZupt   = (i, k, v) =>
    setZupts(p => p.map((z, idx) => (idx === i ? { ...z, [k]: v } : z)));
  const removeZupt = i => setZupts(p => p.filter((_, idx) => idx !== i));

  /* validation */
  const anchorErr = v =>
    v !== "" && !isNum(v) ? "number" : "";

  const zuptErr = z => ({
    name  : z.name   !== "" && !noSpace(z.name)         ? "no spaces" : "",
    lat   : z.lat    !== "" && !inRange(z.lat,  -90,  90) ? "-90…90"   : "",
    lon   : z.lon    !== "" && !inRange(z.lon, -180, 180) ? "-180…180" : "",
    height: z.height !== "" && !isNum(z.height)         ? "number"    : "",
    wait  : z.wait   !== "" && (!isNum(z.wait) || +z.wait < 0)
                       ? "≥ 0" : ""
  });

  const anchorErrors = Object.fromEntries(
    Object.entries(anchors).map(([k, v]) => [k, anchorErr(v)])
  );
  const zuptErrors = zupts.map(zuptErr);

  const formOK =
    planName && noSpace(planName) &&
    Object.values(anchors).every(isNum) &&
    zupts.length &&
    zupts.every(z =>
      Object.values(zuptErr(z)).every(e => !e) &&
      ["name", "lat", "lon", "height", "wait"].every(f => z[f] !== "")
    );

  /* save */
  const savePlan = async () => {
    if (!formOK) return;
    const user = getAuth().currentUser;
    if (!user) { alert("Login required"); return; }

    const docBody = {
      uid: user.uid,
      planUid: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      name: planName.trim(),
      anchors: Object.fromEntries(
        Object.entries(anchors).map(([k, v]) => [k, +v])
      ),
      zupts: zupts.map(z => ({
        id: z.id, name: z.name,
        lat: sixDP(z.lat), lon: sixDP(z.lon),
        height: +z.height, wait: +z.wait
      })),
      createdAt: Timestamp.now()
    };

    try {
      await addDoc(collection(db, "plans"), docBody);
      alert("✅ Saved");
      setPlanName("");
      setAnchors({ A1: "0.1", A2: "0.1", A3: "0.1", B1: "0", B2: "0", B3: "0" });
      setZupts([]);
    } catch (e) { console.error(e); alert("Save failed"); }
  };

  /* ---------- helpers ---------- */
  const renderAnchor = k => (
    <TextField
      key={k}
      label={anchorLabels[k]}
      type="number"
      value={anchors[k]}
      error={!!anchorErrors[k]}
      helperText={anchorErrors[k] || " "}
      onChange={e => updateAnchor(k, e.target.value)}
      size="small"
      inputProps={{ step: "0.1" }}
      sx={{ flex: 1, minWidth: 80 }}
    />
  );

  /* ---------- UI ---------- */
  return (
    <Box sx={{ maxWidth: isMobile ? "100%" : 800, mx: "auto", px: isMobile ? 1 : 2 }}>
      <Typography variant="h6" gutterBottom>Create a Timestamp Plan</Typography>

      <TextField
        label="Plan Name (no spaces)" fullWidth sx={{ mb: 3 }}
        value={planName}
        error={!!planName && !noSpace(planName)}
        helperText={
          !!planName && !noSpace(planName) ? "No spaces allowed" : " "
        }
        onChange={e => setPlanName(e.target.value)}
      />

      <Typography variant="subtitle2" gutterBottom>
        Anchor Points (A = SDs, B = Lever Arm [m])
      </Typography>

      {/* Anchors — responsive rows */}
      {isMobile ? (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
            {["A1", "A2", "A3"].map(renderAnchor)}
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            {["B1", "B2", "B3"].map(renderAnchor)}
          </Stack>
        </>
      ) : (
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          {["A1", "A2", "A3", "B1", "B2", "B3"].map(renderAnchor)}
        </Stack>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* ZUPTs */}
      {zupts.map((z, i) => (
        <Paper
          key={z.id}
          variant="outlined"
          sx={{
            p: isMobile ? 1.5 : 2,
            mb: 2,
            borderLeft: "5px solid #6366f1",
            bgcolor: isMobile ? "grey.50" : undefined
          }}
        >
          <Typography fontWeight={600} mb={1}>ZUPT {i + 1}</Typography>
          <Stack spacing={2}>
            {["name", "lat", "lon", "height", "wait"].map(f => (
              <TextField
                key={f}
                label={{
                  name: "Name (no spaces)",
                  lat: "Latitude",
                  lon: "Longitude",
                  height: "Height (m)",
                  wait: "Wait (s)"
                }[f]}
                type={f === "name" ? "text" : "number"}
                value={z[f]}
                error={!!zuptErrors[i][f]}
                helperText={zuptErrors[i][f] || " "}
                onChange={e => updateZupt(i, f, e.target.value)}
              />
            ))}
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => removeZupt(i)}
            >
              Remove
            </Button>
          </Stack>
        </Paper>
      ))}

      {/* Actions */}
      <Stack direction={isMobile ? "column" : "row"} spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          fullWidth={isMobile}
          onClick={addZupt}
        >
          Add ZUPT
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          fullWidth={isMobile}
          disabled={!formOK}
          onClick={savePlan}
        >
          Save Plan
        </Button>
      </Stack>
    </Box>
  );
}
