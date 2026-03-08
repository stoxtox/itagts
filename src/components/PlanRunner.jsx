// src/components/PlanRunner.jsx
// Offline-first PlanRunner — orchestrator
// Composes sub-components from runner/ and helpers from services/runnerHelpers.js

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box, Typography, Stack, Chip, Divider,
  Snackbar, Alert, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  useTheme, useMediaQuery
} from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";
import LocationIcon from "@mui/icons-material/Room";
import UndoIcon from "@mui/icons-material/Undo";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import { db, auth } from "../firebase";
import {
  collection, getDocs, query, where, addDoc, updateDoc,
  doc, Timestamp, enableNetwork, disableNetwork
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ── sub-components ── */
import SessionHeader from "./runner/SessionHeader";
import SessionSetupForm from "./runner/SessionSetupForm";
import CountdownRing from "./runner/CountdownRing";
import ZUPTGrid from "./runner/ZUPTGrid";
import StampsTable from "./runner/StampsTable";
import ActionBar from "./runner/ActionBar";
import StatusDialogs from "./runner/StatusDialogs";

/* ── helpers ── */
import {
  TZ_IANA, clockStr,
  PLANS_CACHE_KEY,
  loadOutbox, saveOutbox,
  loadIndex, saveIndex,
  loadStamps, saveStamps,
  loadProcessed, saveProcessed,
  pushReplace, pushCreateOnce,
  groupAndCoalesce,
  toDateSafe, toMillis, toTimestamp,
  rehydrateTimestampsInPayload,
  deriveLoopState,
} from "../services/runnerHelpers";

/* ── keyboard shortcuts ── */
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";

/* ───────── component ───────── */
export default function PlanRunner({ onSessionActive }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  /* online status */
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    try { online ? enableNetwork(db) : disableNetwork(db); } catch {}
  }, [online]);

  /* auth + clock */
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, u => setUser(u ?? null)), []);

  const [tz, setTz] = useState("UTC");
  const [clock, setClock] = useState(clockStr("UTC"));
  useEffect(() => {
    const id = setInterval(() => setClock(clockStr(tz)), 1000);
    return () => clearInterval(id);
  }, [tz]);

  /* plans + unfinished (cloud) */
  const [plans, setPlans] = useState(() => {
    try {
      const raw = localStorage.getItem(PLANS_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [plansLoading, setPlansLoading] = useState(true);
  const [planId, setPlanId] = useState("");
  const plan = useMemo(() => plans.find(p => p.id === planId), [plans, planId]);

  const [unfinishedFirebase, setUnfinishedFirebase] = useState([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const pSnap = await getDocs(query(collection(db, "plans"), where("uid", "==", user.uid)));
        const arr = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (arr.length) {
          setPlans(arr);
          try { localStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(arr)); } catch {}
        }
      } catch {}
      try {
        const uSnap = await getDocs(query(
          collection(db, "sessions"),
          where("uid", "==", user.uid),
          where("endedAt", "==", null)
        ));
        setUnfinishedFirebase(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}
      setPlansLoading(false);
    })();
  }, [user]);

  /* session state */
  const [sessionId, setSessionId] = useState(null);
  const [title, setTitle] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [stamps, setStamps] = useState([]);

  const [sessionPlan, setSessionPlan] = useState(null);
  const activePlan = plan || sessionPlan;

  const [{ loopIdx, loopOn }, setLoopMeta] = useState({ loopIdx: 1, loopOn: false });
  const [captured, setCaptured] = useState(new Set());

  /* compact status dialogs */
  const [openPanel, setOpenPanel] = useState(null);

  /* finish confirmation + post-session summary */
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);

  /* instant-update helpers */
  const [poke, setPoke] = useState(0);
  const bump = () => setPoke(x => x + 1);
  const [formKey, setFormKey] = useState(0);

  /* notify parent when session becomes active / inactive */
  useEffect(() => {
    onSessionActive?.(!!startedAt);
  }, [startedAt, onSessionActive]);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    const { loopIdx, loopOn, captured } = deriveLoopState(stamps);
    setLoopMeta({ loopIdx, loopOn });
    setCaptured(captured);
  }, [stamps]);

  /* countdown */
  const [active, setActive] = useState(null);
  const [remain, setRemain] = useState(null);
  const timerRunning = remain !== null;
  useEffect(() => {
    if (remain === null) return;
    if (remain === 0) {
      // Haptic vibration (mobile)
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch {}
      // Audio double-beep via Web Audio API
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const beep = (freq, delay, dur) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.value = 0.3;
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + dur);
        };
        beep(880, 0, 0.15);
        beep(1100, 0.25, 0.2);
      } catch {}
      setActive(null); setRemain(null);
      return;
    }
    const id = setTimeout(() => setRemain(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remain]);

  /* guard unload */
  useEffect(() => {
    const guard = e => { if (startedAt && (loopOn || remain !== null)) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [startedAt, loopOn, remain]);

  /* misc */
  const [snack, setSnack] = useState("");
  const [reverse, setReverse] = useState(false);
  const [startedOffline, setStartedOffline] = useState(false);

  const fmt = d => d.toLocaleTimeString("en-US", { timeZone: TZ_IANA[tz], hour12: false });
  const lap = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  /* local/outbox persistence */
  const persistStampsLocal = (sid, list) => { if (!sid) return; saveStamps(sid, list); };

  const localQueueTouch = () => {
    const ops = loadOutbox();
    ops.push({ type: "touch", at: Date.now() });
    saveOutbox(ops);
  };

  const store = async (list, msg) => {
    if (!sessionId) return;
    persistStampsLocal(sessionId, list);

    if (!online) {
      const payload = { timestamps: list.map(t => ({ ...t, time: toMillis(t.time) })) };
      pushReplace(sessionId, "update", payload);
      localQueueTouch();
      bump();
      setSnack(msg);
      return;
    }

    try {
      await updateDoc(doc(db, "sessions", sessionId), {
        timestamps: list.map(t => ({ ...t, time: toTimestamp(t.time) }))
      });
    } catch {
      const payload = { timestamps: list.map(t => ({ ...t, time: toMillis(t.time) })) };
      pushReplace(sessionId, "update", payload);
      bump();
    }
    setSnack(msg);
  };

  /* Flush outbox when back online (IDEMPOTENT + opId) */
  useEffect(() => {
    if (!online || !user) return;

    const flush = async () => {
      const ops = loadOutbox();
      if (!ops.length) return;

      const flushPlan = groupAndCoalesce(ops);
      const processed = loadProcessed();
      const remember = (op) => { if (op?.opId) processed.add(op.opId); };

      const idMap = new Map();
      const remaining = [];

      for (const item of flushPlan) {
        const localId = item.sessionId;
        let targetId = idMap.get(localId) || localId;

        try {
          if (item.create && !processed.has(item.create.opId)) {
            const payload = rehydrateTimestampsInPayload(item.create.payload);
            const ref = await addDoc(collection(db, "sessions"), payload);
            targetId = ref.id;
            idMap.set(localId, targetId);

            const idx = loadIndex();
            if (idx[localId]) {
              idx[targetId] = { ...idx[localId], id: targetId };
              delete idx[localId];
              saveIndex(idx);
            }
            const oldStamps = loadStamps(localId);
            if (oldStamps.length) saveStamps(targetId, oldStamps);

            remember(item.create);
          } else {
            targetId = idMap.get(localId) || localId;
          }

          if (item.update && !processed.has(item.update.opId)) {
            const payload = rehydrateTimestampsInPayload(item.update.payload);
            await updateDoc(doc(db, "sessions", targetId), payload);
            remember(item.update);
          }

          if (item.finish && !processed.has(item.finish.opId)) {
            const payload = rehydrateTimestampsInPayload(item.finish.payload);
            await updateDoc(doc(db, "sessions", targetId), payload);
            remember(item.finish);
          }
        } catch {
          for (const o of ops) {
            if (o.type === "touch") continue;
            if (o.sessionId === localId) remaining.push(o);
          }
        }
      }

      saveProcessed(processed);
      const filtered = remaining.filter(o => o.type !== "touch");
      saveOutbox(filtered);

      const stillPendingIds = new Set(filtered.map(o => o.sessionId));
      const idx0 = loadIndex();
      let touched = false;
      Object.values(idx0).forEach(entry => {
        if (entry.status !== "active" && !stillPendingIds.has(entry.id)) {
          delete idx0[entry.id];
          touched = true;
        }
      });
      if (touched) saveIndex(idx0);

      if (ops.length !== filtered.length) setSnack("Offline changes synced");
      bump();
    };

    flush();
  }, [online, user]);

  /* ───────── Actions ───────── */
  const addStamp = async (id, name, dur = 0) => {
    const now = new Date();
    const lastForLoc = [...stamps].reverse().find(s => s.zuptName === name);
    if (lastForLoc && now - lastForLoc.time < 2000) return;

    const upd = [...stamps, { ...(id ? { zuptId: id } : {}), zuptName: name, time: now, duration: dur }];
    setStamps(upd);
    persistStampsLocal(sessionId, upd);
    void store(upd, "Stamp saved");
  };

  const undoLast = useCallback(async () => {
    if (!stamps.length) return;
    if (!window.confirm("Undo last stamp?")) return;
    const rest = stamps.slice(0, -1);
    setStamps(rest);
    setActive(null); setRemain(null);
    setCaptured(prev => { const s = new Set(prev); s.delete(stamps.at(-1).zuptName); return s; });
    persistStampsLocal(sessionId, rest);
    void store(rest, "Last stamp removed");
  }, [stamps, sessionId]);

  const start = async () => {
    if (!activePlan || !title.trim() || !user) return;
    const ts = new Date();
    const snapshot = { id: activePlan.id, name: activePlan.name, zupts: activePlan.zupts || [] };

    let newId = null;
    let offlineStart = !online;

    if (!online) {
      newId = `local:${Date.now()}`;
      const payload = {
        uid: user.uid, planId: snapshot.id, planName: snapshot.name,
        planSnapshot: snapshot, sessionTitle: title.trim(), timezone: tz,
        startedAt: ts.getTime(), timestamps: [], endedAt: null,
        startedOffline: true, createdAt: Date.now()
      };
      pushCreateOnce(newId, payload);
      localQueueTouch();
      bump();
    } else {
      try {
        const ref = await addDoc(collection(db, "sessions"), {
          uid: user.uid, planId: snapshot.id, planName: snapshot.name,
          planSnapshot: snapshot, sessionTitle: title.trim(), timezone: tz,
          startedAt: Timestamp.fromDate(ts), timestamps: [], endedAt: null,
          startedOffline: false, createdAt: Timestamp.fromDate(new Date())
        });
        newId = ref.id;
      } catch {
        newId = `local:${Date.now()}`;
        offlineStart = true;
        const payload = {
          uid: user.uid, planId: snapshot.id, planName: snapshot.name,
          planSnapshot: snapshot, sessionTitle: title.trim(), timezone: tz,
          startedAt: ts.getTime(), timestamps: [], endedAt: null,
          startedOffline: true, createdAt: Date.now()
        };
        pushCreateOnce(newId, payload);
        bump();
      }
    }

    const idx = loadIndex();
    idx[newId] = {
      id: newId, uid: user.uid, title: title.trim(),
      planId: snapshot.id, planName: snapshot.name,
      startedAt: ts.toISOString(), startedOffline: offlineStart, status: "active"
    };
    saveIndex(idx);
    saveStamps(newId, []);
    bump();

    setSessionId(newId);
    setStartedAt(ts);
    setLoopMeta({ loopIdx: 1, loopOn: false });
    setCaptured(new Set());
    setStamps([]);
    setSessionPlan(snapshot);
    setStartedOffline(offlineStart);
    setSnack(offlineStart ? "Session started (offline)" : "Session started");

    try { sessionStorage.setItem("activeSessionId", newId); } catch {}
    if (offlineStart) setOpenPanel("queued");
  };

  const resume = (s) => {
    const isLocal = !!s.local;
    const sid = s.id;

    try { sessionStorage.setItem("activeSessionId", sid); } catch {}

    setSessionId(sid);
    setTitle(s.sessionTitle || s.title || "");
    setTz(s.timezone || "UTC");
    setPlanId(s.planId || "");

    if (isLocal) {
      const tsList = loadStamps(sid);
      const idx = loadIndex();
      const meta = idx[sid];
      if (meta) {
        setSessionPlan({
          id: meta.planId, name: meta.planName,
          zupts: (plans.find(p => p.id === meta.planId)?.zupts) || (s.planSnapshot?.zupts) || []
        });
        setStartedOffline(!!meta.startedOffline);
        setStartedAt(toDateSafe(meta.startedAt));
      }
      setStamps(tsList);
    } else {
      const tsList = (s.timestamps || []).map(t => ({ ...t, time: toDateSafe(t.time) }));
      setStamps(tsList);
      setStartedAt(toDateSafe(s.startedAt));
      if (s.planSnapshot) {
        setSessionPlan({ id: s.planSnapshot.id, name: s.planSnapshot.name, zupts: s.planSnapshot.zupts || [] });
      }
      setStartedOffline(!!s.startedOffline);
    }

    setSnack("Session resumed");
  };

  const toggleLoop = useCallback(async () => {
    if (!loopOn) {
      await addStamp(null, `L${loopIdx} Start`);
    } else {
      await addStamp(null, `L${loopIdx} Stop`);
      setActive(null); setRemain(null);
    }
  }, [loopOn, loopIdx, stamps, sessionId]);

  const clickZ = useCallback(async (z) => {
    if (captured.has(z.name) || timerRunning) return;
    if (!loopOn) { setSnack("Needs to Record Lap"); return; }
    setCaptured(prev => new Set(prev).add(z.name));
    setActive(z);
    setRemain(z.wait || 0);
    void addStamp(z.id, z.name, z.wait || 0);
  }, [captured, timerRunning, loopOn, stamps, sessionId]);

  const manual = useCallback(async () => {
    const note = prompt("Note for manual timestamp:");
    if (note) void addStamp(null, `MANUAL: ${note}`);
  }, [stamps, sessionId]);

  const finish = useCallback(async () => {
    if (!sessionId) return;
    const payloadOffline = { endedAt: Date.now() };
    let queued = !online;

    if (!online) {
      pushReplace(sessionId, "finish", payloadOffline);
      localQueueTouch();
      bump();
    } else {
      try {
        await updateDoc(doc(db, "sessions", sessionId), { endedAt: Timestamp.fromDate(new Date()) });
      } catch {
        queued = true;
        pushReplace(sessionId, "finish", payloadOffline);
        bump();
      }
    }

    const idx = loadIndex();
    if (queued) {
      if (idx[sessionId]) idx[sessionId].status = "finished-pending";
      saveIndex(idx);
    } else {
      if (idx[sessionId]) { delete idx[sessionId]; saveIndex(idx); }
    }
    bump();

    try { sessionStorage.removeItem("activeSessionId"); } catch {}

    // Capture summary before resetting state
    setSessionSummary({
      title,
      planName: activePlan?.name || "",
      stampCount: stamps.length,
      zuptsCaptured: captured.size,
      zuptsTotal: activePlan?.zupts?.length || 0,
      elapsed: lap,
      startedAt,
      endedAt: new Date(),
      queued,
    });

    setFinishConfirmOpen(false);
    setSessionId(null);
    setStartedAt(null);
    setLoopMeta({ loopIdx: 1, loopOn: false });
    setCaptured(new Set());
    setActive(null); setRemain(null);
    setStamps([]);
    setSessionPlan(null);
    setStartedOffline(false);

    setTitle("");
    setPlanId("");
    setFormKey(k => k + 1);

    if (queued) setOpenPanel("finished");
  }, [sessionId, online, title, activePlan, stamps, captured, lap, startedAt]);

  /* Keyboard shortcut: click ZUPT by visible index (respects reverse order) */
  const clickZuptByIndex = useCallback((idx) => {
    if (!activePlan?.zupts?.length) return;
    const ordered = reverse ? [...activePlan.zupts].reverse() : activePlan.zupts;
    if (idx >= 0 && idx < ordered.length) {
      clickZ(ordered[idx]);
    }
  }, [activePlan, reverse, clickZ]);

  /* ── keyboard shortcuts ── */
  useKeyboardShortcuts({
    enabled: !!startedAt,
    onToggleLap: toggleLoop,
    onClickZuptByIndex: clickZuptByIndex,
    onUndoLast: undoLast,
    onManual: manual,
    onFinish: () => setFinishConfirmOpen(true),
  });

  /* Auto-resume session from hint — OFFLINE ONLY */
  useEffect(() => {
    if (!user || startedAt || online) return;
    try {
      const hint = sessionStorage.getItem("activeSessionId");
      if (!hint) return;
      const idx = loadIndex();
      const entry = idx[hint];
      if (!entry || entry.status !== "active" || entry.uid !== user.uid) return;
      resume({ ...entry, local: true, id: hint });
    } catch {}
  }, [user, startedAt, online]);

  /* derived UI lists/counters */
  const outbox = !online ? loadOutbox() : [];
  const queuedCount = outbox.filter(o => o.type !== "touch").length;
  const userUid = user?.uid;
  const pendingFinished = !online
    ? Object.values(loadIndex()).filter(x => x.status === "finished-pending" && x.uid === userUid)
    : [];
  const finishedCount = pendingFinished.length;

  const localActives = Object
    .values(loadIndex())
    .filter(x => x.status === "active" && x.uid === userUid)
    .map(x => ({ ...x, local: true }));

  const unfinished = [
    ...(unfinishedFirebase || []),
    ...localActives.filter(l => !(unfinishedFirebase || []).some(f => f.id === l.id))
  ];

  /* ───────── RENDER ───────── */
  return (
    <Box sx={{ maxWidth: isMobile ? "100%" : 900, mx: "auto", px: isMobile ? 1 : 2, pt: 2, pb: 8 }}>

      {/* Header / Clock / Offline Status */}
      <SessionHeader
        clock={clock}
        tz={tz}
        setTz={setTz}
        startedAt={startedAt}
        startedOffline={startedOffline}
        isMobile={isMobile}
        online={online}
        queuedCount={queuedCount}
        finishedCount={finishedCount}
        onOpenPanel={setOpenPanel}
      />

      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700, letterSpacing: 0.2, color: "text.secondary" }}>
        Run a Plan Session
      </Typography>

      {/* Pre-start form (when nothing running) */}
      {!startedAt && (
        <SessionSetupForm
          plans={plans}
          planId={planId}
          setPlanId={setPlanId}
          title={title}
          setTitle={setTitle}
          isMobile={isMobile}
          onStart={start}
          unfinished={unfinished}
          onResume={resume}
          formKey={formKey}
          isLoading={plansLoading && !plans.length}
        />
      )}

      {/* ───────── Live mode ───────── */}
      {startedAt && activePlan && (
        <>
          {/* ── Session info card ── */}
          <Box
            sx={{
              mt: 0.5,
              mb: 1.5,
              p: 1.5,
              borderRadius: 2,
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(99,102,241,0.08)"
                  : "rgba(99,102,241,0.04)",
              border: "1px solid",
              borderColor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(99,102,241,0.18)"
                  : "rgba(99,102,241,0.12)",
            }}
          >
            {/* Title + plan + date row */}
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1, flexWrap: "wrap" }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, color: "text.primary" }}
              >
                {title || "(untitled)"}
              </Typography>
              {activePlan?.name && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 500,
                    px: 0.75,
                    py: 0.15,
                    borderRadius: 1,
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.05)",
                  }}
                >
                  {activePlan.name}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: "text.secondary", ml: "auto" }}>
                {toDateSafe(startedAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Typography>
            </Stack>

            {/* Elapsed + Lap stat row */}
            <Stack direction="row" spacing={1.5}>
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  p: 0.75,
                  borderRadius: 1.5,
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(99,102,241,0.12)"
                      : "rgba(99,102,241,0.06)",
                }}
              >
                <TimerIcon sx={{ fontSize: 18, color: "primary.main" }} />
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1, display: "block" }}>
                    Elapsed
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {lap}
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  p: 0.75,
                  borderRadius: 1.5,
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? loopOn ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)"
                      : loopOn ? "rgba(239,68,68,0.06)" : "rgba(0,0,0,0.03)",
                }}
              >
                <LocationIcon sx={{ fontSize: 18, color: loopOn ? "error.main" : "text.secondary" }} />
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1, display: "block" }}>
                    Current Lap
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    L{loopOn ? loopIdx : Math.max(1, loopIdx - 1)}
                    {loopOn && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ ml: 0.5, color: "error.main", fontWeight: 600 }}
                      >
                        REC
                      </Typography>
                    )}
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Box>

          {/* ── Active ZUPT countdown ── */}
          {active && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                mb: 2,
                py: 2,
                px: 1,
                borderRadius: 3,
                bgcolor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(0,0,0,0.2)"
                    : "rgba(0,0,0,0.02)",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CountdownRing
                secondsLeft={remain}
                total={active.wait || 0}
                size={isMobile ? 100 : 130}
                stroke={isMobile ? 7 : 9}
              />
              <Typography
                variant="subtitle2"
                sx={{
                  mt: 1,
                  fontWeight: 700,
                  color: "primary.main",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <LocationIcon sx={{ fontSize: 16 }} />
                {active.name}
              </Typography>
              <Button
                onClick={undoLast}
                size="small"
                variant="text"
                startIcon={<UndoIcon />}
                sx={{
                  mt: 0.5,
                  color: "error.main",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": {
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(239,68,68,0.08)",
                  },
                }}
              >
                Undo
              </Button>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* ZUPT chips */}
          <ZUPTGrid
            zupts={activePlan.zupts || []}
            captured={captured}
            timerRunning={timerRunning}
            reverse={reverse}
            setReverse={setReverse}
            onClickZupt={clickZ}
          />

          {/* Stamps table */}
          <StampsTable stamps={stamps} tz={tz} />
        </>
      )}

      {/* Sticky Action Bar */}
      {startedAt && (
        <ActionBar
          loopOn={loopOn}
          loopIdx={loopIdx}
          isMobile={isMobile}
          timerRunning={timerRunning}
          onToggleLoop={toggleLoop}
          onManual={manual}
          onFinish={() => setFinishConfirmOpen(true)}
        />
      )}

      {/* ── Finish Confirmation Dialog ── */}
      <Dialog
        open={finishConfirmOpen}
        onClose={() => setFinishConfirmOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Finish Session?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography variant="body2"><strong>Title:</strong> {title || "(untitled)"}</Typography>
            <Typography variant="body2"><strong>Plan:</strong> {activePlan?.name}</Typography>
            <Typography variant="body2"><strong>Stamps recorded:</strong> {stamps.length}</Typography>
            <Typography variant="body2">
              <strong>ZUPTs captured:</strong> {captured.size} / {activePlan?.zupts?.length || 0}
            </Typography>
            <Typography variant="body2"><strong>Elapsed:</strong> {lap}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setFinishConfirmOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained" color="success"
            onClick={finish}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Finish Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Post-Session Summary Dialog ── */}
      <Dialog
        open={!!sessionSummary}
        onClose={() => setSessionSummary(null)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
          <CheckCircleOutlineIcon color="success" />
          Session Complete
        </DialogTitle>
        <DialogContent dividers>
          {sessionSummary && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" fontWeight={700} color="text.primary">{sessionSummary.title}</Typography>
                <Typography variant="body2" sx={{ color: (t) => t.palette.mode === "dark" ? "grey.400" : "text.secondary" }}>
                  {sessionSummary.planName}
                </Typography>
              </Box>

              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Box sx={{ textAlign: "center", flex: 1, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
                  <Typography variant="h5" fontWeight={800} color="primary.light">
                    {sessionSummary.stampCount}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: (t) => t.palette.mode === "dark" ? "grey.300" : "text.secondary", fontWeight: 500 }}
                  >
                    Stamps
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "center", flex: 1, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
                  <Typography variant="h5" fontWeight={800} color="primary.light">
                    {sessionSummary.zuptsCaptured}/{sessionSummary.zuptsTotal}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: (t) => t.palette.mode === "dark" ? "grey.300" : "text.secondary", fontWeight: 500 }}
                  >
                    ZUPTs
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "center", flex: 1, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
                  <Typography variant="h5" fontWeight={800} color="primary.light">
                    {sessionSummary.elapsed}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: (t) => t.palette.mode === "dark" ? "grey.300" : "text.secondary", fontWeight: 500 }}
                  >
                    Duration
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
                {sessionSummary.queued ? (
                  <>
                    <CloudUploadIcon color="warning" />
                    <Typography variant="body2" color="warning.main" fontWeight={600}>
                      Queued for upload (will sync when online)
                    </Typography>
                  </>
                ) : (
                  <>
                    <CloudDoneIcon color="success" />
                    <Typography variant="body2" color="success.main" fontWeight={600}>
                      Synced to cloud
                    </Typography>
                  </>
                )}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            variant="contained"
            onClick={() => setSessionSummary(null)}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar — positioned above the docked action bar */}
      <Snackbar
        open={!!snack}
        autoHideDuration={2400}
        onClose={() => setSnack("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 80, sm: 90 } }}
      >
        <Alert severity="success" variant="filled" sx={{ width: "100%" }}>
          {snack}
        </Alert>
      </Snackbar>

      {/* Status Dialogs */}
      <StatusDialogs
        openPanel={openPanel}
        onClose={() => setOpenPanel(null)}
        queuedCount={queuedCount}
        finishedCount={finishedCount}
      />
    </Box>
  );
}
