// src/components/PlanRunner.jsx
// Curved-gradient header · animated countdown ring · mobile friendly
// Smarter “Resume” (keeps loop/captured state) + undo + refresh-guard
// Equal-width mobile buttons • auto-refresh after Finish
// Table header no-overlap • timer-lock ZUPTs • duration on mobile
// Anti-double-tap (2 s) • flip ZUPT order

import React, { useEffect, useState, useMemo } from "react";
import {
  Box, Paper, Button, Typography, MenuItem, TextField,
  Divider, Stack, Chip, Snackbar, Alert, LinearProgress,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, useTheme, useMediaQuery
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import CheckIcon from "@mui/icons-material/CheckCircle";
import LocationIcon from "@mui/icons-material/Room";
import TimerIcon from "@mui/icons-material/Timer";
import AddIcon from "@mui/icons-material/AddCircle";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import UndoIcon from "@mui/icons-material/Undo";
import SwapVertIcon from "@mui/icons-material/SwapVert";   // ⬆⬇ flip order

import LoaderOverlay from "./LoaderOverlay";

import { db } from "../firebase";
import {
  collection, getDocs, query, where, addDoc, updateDoc,
  doc, Timestamp
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

/* ───────── SVG countdown ring ───────── */
function CountdownRing({ secondsLeft, total, size = 96, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = 1 - secondsLeft / total;
  const off = circ * pct;
  const color =
    pct < 0.33 ? "#10B981" : pct < 0.67 ? "#F59E0B" : "#EF4444";

  return (
    <svg width={size} height={size}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle r={r} cx={size / 2} cy={size / 2} fill="none"
          stroke="#E5E7EB" strokeWidth={stroke} />
        <circle r={r} cx={size / 2} cy={size / 2} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 300ms" }} />
      </g>
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
        fontWeight="700" fontSize={size < 90 ? 20 : 25} fill="#111827">
        {secondsLeft}s
      </text>
    </svg>
  );
}

/* ───────── helpers ───────── */
const TZ_LIST = ["UTC", "EST", "CST", "MST", "PDT", "GMT", "CET", "IST", "JST"];
const TZ_IANA = {
  UTC: "UTC", EST: "America/New_York", CST: "America/Chicago", MST: "America/Denver",
  PDT: "America/Los_Angeles", GMT: "Etc/GMT", CET: "Europe/Paris",
  IST: "Asia/Kolkata", JST: "Asia/Tokyo"
};
const clockStr = z =>
  new Date().toLocaleTimeString("en-US", { timeZone: TZ_IANA[z], hour12: false });
const chipTone = i => ["default", "success", "info", "warning",
  "secondary", "primary", "error"][(i + 1) % 7];

/* ───────── component ───────── */
export default function PlanRunner() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  /* ── auth + live clock ── */
  const auth = getAuth();
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), [auth]);

  const [tz, setTz] = useState("UTC");
  const [clock, setClock] = useState(clockStr("UTC"));
  useEffect(() => {
    const id = setInterval(() => setClock(clockStr(tz)), 1000);
    return () => clearInterval(id);
  }, [tz]);

  /* ── Firestore data ── */
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState("");
  const plan = useMemo(() => plans.find(p => p.id === planId), [plans, planId]);

  const [unfinished, setUnfinished] = useState([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const pSnap = await getDocs(query(collection(db, "plans"), where("uid", "==", user.uid)));
      setPlans(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const uSnap = await getDocs(query(
        collection(db, "sessions"),
        where("uid", "==", user.uid),
        where("endedAt", "==", null)
      ));
      setUnfinished(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, [user]);

  /* ── session state ── */
  const [sessionId, setSessionId] = useState(null);
  const [title, setTitle] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [stamps, setStamps] = useState([]);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  /* loop */
  const [loopOn, setLoopOn] = useState(false);
  const [loopIdx, setLoopIdx] = useState(1);
  const [captured, setCaptured] = useState(new Set());

  /* countdown */
  const [active, setActive] = useState(null); // {id,name,wait}
  const [remain, setRemain] = useState(null);
  const timerRunning = remain !== null;

  useEffect(() => {
    if (remain === null) return;
    if (remain === 0) { setActive(null); setRemain(null); return; }
    const id = setTimeout(() => setRemain(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remain]);

  /* refresh guard */
  useEffect(() => {
    const guard = e => {
      if (startedAt && (loopOn || remain !== null)) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [startedAt, loopOn, remain]);

  /* misc */
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState("");
  const [reverse, setReverse] = useState(false);    // ⬆⬇ order toggle

  const fmt = d => d.toLocaleTimeString("en-US", { timeZone: TZ_IANA[tz], hour12: false });
  const lap = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  /* ── DB helpers ── */
  const store = async (list, msg) => {
    if (!sessionId) return;
    setSaving(true);
    await updateDoc(doc(db, "sessions", sessionId), {
      timestamps: list.map(t => ({ ...t, time: Timestamp.fromDate(t.time) }))
    });
    setSaving(false); setSnack(msg);
  };

  const addStamp = async (id, name, dur = 0) => {
    const now = new Date();

    /* ---- anti-double-tap within 2 s ---- */
    const lastForLoc = [...stamps].reverse().find(s => s.zuptName === name);
    if (lastForLoc && now - lastForLoc.time < 2000) return;

    const upd = [...stamps, {
      ...(id ? { zuptId: id } : {}),
      zuptName: name, time: now, duration: dur
    }];
    setStamps(upd); await store(upd, "Stamp saved");
  };

  const undoLast = async () => {
    if (!stamps.length) return;
    if (!window.confirm("Undo last stamp?")) return;
    const rest = stamps.slice(0, -1);
    setStamps(rest);
    setActive(null); setRemain(null);
    setCaptured(prev => {
      const s = new Set(prev); s.delete(stamps.at(-1).zuptName); return s;
    });
    await store(rest, "Last stamp removed");
  };

  /* ── actions ── */
  const start = async () => {
    if (!plan || !title.trim()) return;
    const ts = new Date();
    const ref = await addDoc(collection(db, "sessions"), {
      uid: user.uid, planId: plan.id, planName: plan.name,
      sessionTitle: title.trim(), timezone: tz,
      startedAt: Timestamp.fromDate(ts), timestamps: [],
      endedAt: null, createdAt: Timestamp.now()
    });
    setSessionId(ref.id); setStartedAt(ts); setElapsed(0);
    setLoopOn(false); setLoopIdx(1); setCaptured(new Set()); setStamps([]);
    setSnack("Session started");
  };

  const resume = s => {
    setSessionId(s.id); setTitle(s.sessionTitle);
    setTz(s.timezone || "UTC"); setPlanId(s.planId);
    const ts = (s.timestamps || []).map(t => ({ ...t, time: t.time.toDate() }));
    setStamps(ts);

    let active = false, next = 1, cap = new Set();
    for (let i = ts.length - 1; i >= 0; i--) {
      const m = ts[i].zuptName?.match(/^L(\d+) Start$/); if (!m) continue;
      const n = +m[1];
      const closed = ts.slice(i + 1).some(t => t.zuptName === `L${n} Stop`);
      if (!closed) {
        active = true; next = n;
        ts.slice(i + 1).forEach(t => {
          if (!/^L\d+ Stop$/.test(t.zuptName) && !/^MANUAL:/.test(t.zuptName))
            cap.add(t.zuptName);
        });
      } else next = n + 1;
      break;
    }
    setLoopOn(active); setLoopIdx(next); setCaptured(cap);
    setStartedAt(s.startedAt.toDate());
  };

  const toggleLoop = async () => {
    if (!loopOn) {
      await addStamp(null, `L${loopIdx} Start`);
      setLoopOn(true); setCaptured(new Set());
    } else {
      await addStamp(null, `L${loopIdx} Stop`);
      setLoopOn(false); setLoopIdx(i => i + 1); setCaptured(new Set());
    }
  };

  const clickZ = async z => {
    if (!loopOn || captured.has(z.name) || timerRunning) return;
    await addStamp(z.id, z.name, z.wait);
    setCaptured(prev => new Set(prev).add(z.name));
    setActive(z); setRemain(z.wait);
  };

  const manual = async () => {
    const note = prompt("Note for manual timestamp:");
    if (note) await addStamp(null, `MANUAL: ${note}`);
  };

  const finish = async () => {
    if (!sessionId) return;
    await updateDoc(doc(db, "sessions", sessionId),
      { endedAt: Timestamp.fromDate(new Date()) });
    // clear local state first (UX) …
    setSessionId(null); setStartedAt(null); setPlanId("");
    setLoopOn(false); setLoopIdx(1); setCaptured(new Set());
    setActive(null); setRemain(null); setStamps([]);
    setSnack("Session finalized");
    // … then hard refresh so *everything* (incl. title) resets
    setTimeout(() => window.location.reload(), 400);
  };

  /* === UI === */
  if (user === null) return <LoaderOverlay open />;

  return (
    <Box sx={{
      maxWidth: isMobile ? "100%" : 900, mx: "auto",
      px: isMobile ? 1 : 2, pt: 2, pb: 8
    }}>
      {startedAt && <LinearProgress sx={{ mb: 1 }} />}

      {/* header */}
      <Paper elevation={3} sx={{
        p: isMobile ? 2 : 3, mb: isMobile ? 3 : 4, borderRadius: 2,
        background: "linear-gradient(135deg,#6366f1 0%,#4f46e5 40%,#4338ca 100%)",
        color: "#fff"
      }}>
        <Typography align="center" fontWeight={700}
          variant={isMobile ? "h5" : "h4"}>{clock}</Typography>
        <TextField select size="small" value={tz} onChange={e => setTz(e.target.value)}
          sx={{
            mt: 1, width: isMobile ? 90 : 110,
            ".MuiOutlinedInput-root": { bgcolor: "rgba(255,255,255,0.1)", color: "#fff" },
            ".MuiSvgIcon-root": { color: "#fff" }
          }}>
          {TZ_LIST.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
      </Paper>

      <Typography variant="h6" gutterBottom>Run a Plan Session</Typography>

      {/* resume list */}
      {!startedAt && unfinished.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle2">Resume unfinished:</Typography>
          {unfinished.map(s => (
            <Button key={s.id} variant="outlined"
              size={isMobile ? "small" : "medium"} sx={{ mr: 1, mb: 1 }}
              onClick={() => resume(s)}>▶ {s.sessionTitle || s.planName}</Button>
          ))}
          <Divider sx={{ my: 2 }} />
        </Box>
      )}

      {/* first-time form */}
      {!startedAt && (
        <>
          <TextField select fullWidth label="Select Plan" sx={{ mb: 2 }}
            value={planId} onChange={e => setPlanId(e.target.value)}>
            {plans.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Session Title" sx={{ mb: 2 }}
            value={title} onChange={e => setTitle(e.target.value)} />
          <Button fullWidth variant="contained" size={isMobile ? "large" : "medium"}
            startIcon={<PlayArrowIcon />}
            disabled={!planId || !title.trim() || saving}
            onClick={start}>Start Session</Button>
        </>
      )}

      {/* live mode */}
      {startedAt && plan && (
        <>
          <Typography variant="subtitle1" sx={{ mb: isMobile ? 1 : 0 }}>
            🕒 Elapsed: <strong>{lap}</strong>
          </Typography>

          {active && (
            <Box textAlign="center" mb={2}>
              <CountdownRing
                secondsLeft={remain}
                total={active.wait}
                size={isMobile ? 80 : 130}
                stroke={isMobile ? 6 : 8}
              />
              <Typography variant="h6" sx={{
                mt: 1, display: "flex", justifyContent: "center",
                alignItems: "center", gap: 1
              }}>
                <LocationIcon fontSize="small" /> {active.name}
                <IconButton onClick={undoLast}
                  size={isMobile ? "small" : "medium"}
                  sx={{ color: "error.main", ml: 0.5 }}>
                  <UndoIcon />
                </IconButton>
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Typography variant="subtitle2">
              Select ZUPT location:
            </Typography>
            <IconButton size="small" sx={{ ml: 0.5 }}
              onClick={() => setReverse(p => !p)}
              title="Flip order">
              <SwapVertIcon fontSize="inherit"
                sx={{ transform: "rotate(90deg)" }}
              />
            </IconButton>
          </Box>

          <Box sx={{ display: "flex", gap: 1, overflowX: "auto", py: 1 }}>
            {(reverse ? [...plan.zupts].reverse() : plan.zupts).map((z, i) => {
              const done = captured.has(z.name);
              return (
                <Chip key={z.id} label={z.name}
                  icon={done ? <CheckIcon /> : <TimerIcon />}
                  color={done ? chipTone(i) : "default"}
                  variant={done ? "filled" : "outlined"}
                  clickable={loopOn && !done && !timerRunning}
                  onClick={loopOn && !done && !timerRunning ? () => clickZ(z) : undefined} />
              );
            })}
          </Box>

          {!!stamps.length && (
            <Box mt={4} mb={12}>
              <Typography variant="subtitle2">Recorded timestamps:</Typography>
              <TableContainer component={Paper} variant="outlined"
                sx={{
                  maxHeight: 220,
                  /* leave space so table header never collides w/ bottom bar */
                  mb: 2, pb: 8
                }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Time&nbsp;({tz})</TableCell>
                      <TableCell>Dur&nbsp;(s)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stamps.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell>{t.zuptName}</TableCell>
                        <TableCell>{fmt(t.time)}</TableCell>
                        <TableCell>{t.duration}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </>
      )}

      {/* sticky action bar */}
      {startedAt && (
        <Paper
          elevation={6}
          sx={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",

            width: isMobile ? "calc(100% - 16px)" : "min(640px,90%)",

            p: isMobile ? 1.2 : 2,
            borderRadius: 4,

            /* glass effect */
            backgroundColor: "rgba(255,255,255,0.15)",   // translucent “pane”
            border: "1px solid rgba(255,255,255,0.25)",  // light frosted edge
            backdropFilter: "blur(5px)",                // stronger blur for depth
            WebkitBackdropFilter: "blur(5px)",          // Safari support

            zIndex: theme.zIndex.drawer + 2              // above sticky table header
          }}
        >
          <Stack direction="row" spacing={isMobile ? 1 : 2}
            justifyContent="center" flexWrap="wrap">
            <Button fullWidth={isMobile} sx={{ flex: isMobile ? 1 : undefined, py: 1.5 }}
              variant="contained" color={loopOn ? "error" : "primary"}
              startIcon={loopOn ? <StopIcon /> : <LocationIcon />}
              onClick={toggleLoop} disabled={saving}
              size={isMobile ? "small" : "medium"}>
              {loopOn ? `Stop L${loopIdx}` : `Record L${loopIdx}`}
            </Button>
            <Button fullWidth={isMobile} sx={{ flex: isMobile ? 1 : undefined }}
              variant="outlined" startIcon={<AddIcon />}
              onClick={manual} disabled={saving || timerRunning}
              size={isMobile ? "small" : "medium"}>
              Manual
            </Button>
            <Button fullWidth={isMobile} sx={{ flex: isMobile ? 1 : undefined }}
              variant="contained" color="success"
              startIcon={<DoneAllIcon />}
              onClick={finish} disabled={saving}
              size={isMobile ? "small" : "medium"}>
              Finish
            </Button>
          </Stack>
        </Paper>
      )}

      <Snackbar open={!!snack} autoHideDuration={2600}
        onClose={() => setSnack("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" sx={{ width: "100%" }}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  );
}
