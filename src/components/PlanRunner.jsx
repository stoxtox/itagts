// src/components/PlanRunner.jsx
// Offline-first PlanRunner
// - Requires "Record Lx" before any ZUPT
// - Restores progress (lap & captured ZUPTs) after refresh (online/offline)
// - Pure-local behavior when offline (no Firestore network attempts)
// - Local outbox + local session index & stamps; auto-flush on reconnect (idempotent)
// - Auto-resume only when OFFLINE (online never auto-opens)
// - Compact header status row (only offline): cloud/pending/finished
// - Refreshes after Start (offline) and Finish to make state obvious
// - planSnapshot ensures ZUPTs are available offline
// - No geolocation

import React, { useEffect, useState, useMemo } from "react";
import {
  Box, Paper, Button, Typography, MenuItem, TextField,
  Divider, Stack, Chip, Snackbar, Alert, LinearProgress,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, useTheme, useMediaQuery, Tooltip, Badge,
  Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import CheckIcon from "@mui/icons-material/CheckCircle";
import LocationIcon from "@mui/icons-material/Room";
import TimerIcon from "@mui/icons-material/Timer";
import AddIcon from "@mui/icons-material/AddCircle";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import UndoIcon from "@mui/icons-material/Undo";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import OfflineBoltIcon from "@mui/icons-material/OfflineBolt";
import InfoIcon from "@mui/icons-material/Info";

import LoaderOverlay from "./LoaderOverlay";

import { db } from "../firebase";
import {
  collection, getDocs, query, where, addDoc, updateDoc,
  doc, Timestamp, enableNetwork, disableNetwork
} from "firebase/firestore";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

/* ───────── SVG countdown ring ───────── */
function CountdownRing({ secondsLeft, total, size = 96, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = 1 - secondsLeft / total;
  const off = circ * pct;
  const color = pct < 0.33 ? "#10B981" : pct < 0.67 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={size} height={size}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle r={r} cx={size / 2} cy={size / 2} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
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
const chipTone = i => ["default", "success", "info", "warning", "secondary", "primary", "error"][(i + 1) % 7];

const PLANS_CACHE_KEY = "plansCache_v1";
const OUTBOX_KEY = "sessionOutbox_v1";
const INDEX_KEY = "sessionIndex_v1";
const STAMPS_KEY_PREFIX = "stamps_";

/* local storage helpers */
const loadOutbox = () => { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch { return []; } };
const saveOutbox = (ops) => { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops)); } catch {} };

const loadIndex = () => { try { return JSON.parse(localStorage.getItem(INDEX_KEY) || "{}"); } catch { return {}; } };
const saveIndex = (idx) => { try { localStorage.setItem(INDEX_KEY, JSON.stringify(idx)); } catch {} };

const stampsKey = (sid) => `${STAMPS_KEY_PREFIX}${sid}`;
const loadStamps = (sid) => {
  try {
    const raw = localStorage.getItem(stampsKey(sid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return arr.map(t => ({ ...t, time: new Date(t.time) }));
  } catch { return []; }
};
const saveStamps = (sid, list) => {
  try {
    localStorage.setItem(
      stampsKey(sid),
      JSON.stringify(list.map(t => ({ ...t, time: t.time.toISOString() })))
    );
  } catch {}
};

/* ───────── Outbox idempotency helpers (DEDUPING) ───────── */
// Track which opIds have already been applied (survives reloads).
const OP_TRACK_KEY = "outboxProcessed_v1"; // Set<string>
const loadProcessed = () => {
  try { return new Set(JSON.parse(localStorage.getItem(OP_TRACK_KEY) || "[]")); }
  catch { return new Set(); }
};
const saveProcessed = (set) => {
  try { localStorage.setItem(OP_TRACK_KEY, JSON.stringify([...set])); } catch {}
};
const genOpId = () => `op_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

/** Replace prior ops of the same type for this session, then push. (adds opId) */
const pushReplace = (sessionId, type, payload) => {
  const ops = loadOutbox();
  const next = ops.filter(o => !(o.sessionId === sessionId && o.type === type));
  next.push({ opId: genOpId(), type, sessionId, payload });
  saveOutbox(next);
};

/** Guard against adding more than one CREATE for the same local session. (adds opId) */
const pushCreateOnce = (sessionId, payload) => {
  const ops = loadOutbox();
  if (!ops.some(o => o.type === "create" && o.sessionId === sessionId)) {
    ops.push({ opId: genOpId(), type: "create", sessionId, payload });
    saveOutbox(ops);
  }
};

/** Merge ops per session: keep first create, last update, last finish. */
const groupAndCoalesce = (ops) => {
  const bySession = new Map();
  for (const op of ops) {
    if (op.type === "touch") continue;
    const g = bySession.get(op.sessionId) || { creates: [], updates: [], finishes: [] };
    if (op.type === "create") g.creates.push(op);
    else if (op.type === "update") g.updates.push(op);
    else if (op.type === "finish") g.finishes.push(op);
    bySession.set(op.sessionId, g);
  }
  const plan = [];
  for (const [sessionId, g] of bySession.entries()) {
    plan.push({
      sessionId,
      create: g.creates.length ? g.creates[0] : null,
      update: g.updates.length ? g.updates[g.updates.length - 1] : null,
      finish: g.finishes.length ? g.finishes[g.finishes.length - 1] : null,
    });
  }
  return plan;
};

/* Safe conversions */
const toDateSafe = (v) => {
  if (!v) return new Date(0);
  if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  if (typeof v?.seconds === "number" && typeof v?.nanoseconds === "number") {
    return new Date(v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6));
  }
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  return new Date(v); // ISO string
};
const toMillis = (v) => toDateSafe(v).getTime();
const toTimestamp = (v) => Timestamp.fromDate(toDateSafe(v));

/* Deep-rehydrate any {seconds,nanoseconds} or ms into Firestore Timestamps */
const rehydrateTimestampsInPayload = (payload) => {
  const out = { ...payload };
  if ("startedAt" in out) out.startedAt = toTimestamp(out.startedAt);
  if ("endedAt"   in out && out.endedAt) out.endedAt = toTimestamp(out.endedAt);
  if (Array.isArray(out.timestamps)) {
    out.timestamps = out.timestamps.map(t => ({
      ...t,
      time: toTimestamp(t.time)
    }));
  }
  return out;
};

/* derive lap & captured */
function deriveLoopState(stamps) {
  const starts = [];
  const stops = new Set();
  const rexStart = /^L(\d+)\s+Start$/;
  const rexStop = /^L(\d+)\s+Stop$/;

  for (const s of stamps) {
    const mS = rexStart.exec(s.zuptName);
    const mE = rexStop.exec(s.zuptName);
    if (mS) starts.push(parseInt(mS[1], 10));
    if (mE) stops.add(parseInt(mE[1], 10));
  }
  if (!starts.length) return { loopIdx: 1, loopOn: false, captured: new Set() };
  const maxStart = Math.max(...starts);
  const loopOn = !stops.has(maxStart);
  const loopIdx = loopOn ? maxStart : maxStart + 1;

  const lastStartIdx = [...stamps].map(s => s.zuptName).lastIndexOf(`L${loopOn ? loopIdx : loopIdx - 1} Start`);
  const captured = new Set();
  for (let i = Math.max(0, lastStartIdx + 1); i < stamps.length; i++) {
    const name = stamps[i].zuptName;
    if (!rexStart.test(name) && !rexStop.test(name) && !name.startsWith("MANUAL:")) {
      captured.add(name);
    }
  }

  return { loopIdx, loopOn, captured };
}

/* ───────── component ───────── */
export default function PlanRunner() {
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

  // Explicitly toggle Firestore network so the SDK doesn't keep trying while offline
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
    })();
  }, [user]);

  /* session state */
  const [sessionId, setSessionId] = useState(null);
  const [title, setTitle] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [stamps, setStamps] = useState([]);

  // plan snapshot for offline
  const [sessionPlan, setSessionPlan] = useState(null); // {id,name,zupts}
  const activePlan = plan || sessionPlan;

  // derived loop state
  const [{ loopIdx, loopOn }, setLoopMeta] = useState({ loopIdx: 1, loopOn: false });
  const [captured, setCaptured] = useState(new Set());

  /* panel state placed before early returns */
  const [openPanel, setOpenPanel] = useState(null); // 'net'|'queued'|'finished'|null

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
  const [active, setActive] = useState(null); // {id,name,wait}
  const [remain, setRemain] = useState(null);
  const timerRunning = remain !== null;
  useEffect(() => {
    if (remain === null) return;
    if (remain === 0) { setActive(null); setRemain(null); return; }
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

  // LOCAL-FIRST: do not call Firestore when offline
  const store = async (list, msg) => {
    if (!sessionId) return;
    persistStampsLocal(sessionId, list);

    if (!online) {
      // queue UPDATE with plain millis for time (stable to rehydrate)
      const payload = {
        timestamps: list.map(t => ({ ...t, time: toMillis(t.time) }))
      };
      pushReplace(sessionId, "update", payload);
      localQueueTouch();
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
    }
    setSnack(msg);
  };

  // Flush outbox when back online & prune finished-pending from index (IDEMPOTENT + opId)
  useEffect(() => {
    if (!online || !user) return;

    const flush = async () => {
      const ops = loadOutbox();
      if (!ops.length) return;

      // plan per session
      const plan = groupAndCoalesce(ops);

      // processed op-ids survive reloads; skip if seen
      const processed = loadProcessed();
      const remember = (op) => { if (op?.opId) processed.add(op.opId); };

      const idMap = new Map();     // localId -> remoteId
      const remaining = [];

      for (const item of plan) {
        const localId = item.sessionId;
        let targetId = idMap.get(localId) || localId;

        try {
          // CREATE once
          if (item.create && !processed.has(item.create.opId)) {
            const payload = rehydrateTimestampsInPayload(item.create.payload);
            const ref = await addDoc(collection(db, "sessions"), payload);
            targetId = ref.id;
            idMap.set(localId, targetId);

            // migrate index + stamps localId -> remoteId
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

          // UPDATE (last) — run if not already applied
          if (item.update && !processed.has(item.update.opId)) {
            const payload = rehydrateTimestampsInPayload(item.update.payload);
            await updateDoc(doc(db, "sessions", targetId), payload);
            remember(item.update);
          }

          // FINISH (last)
          if (item.finish && !processed.has(item.finish.opId)) {
            const payload = rehydrateTimestampsInPayload(item.finish.payload);
            await updateDoc(doc(db, "sessions", targetId), payload);
            remember(item.finish);
          }
        } catch {
          // keep raw ops for this local session for retry
          for (const o of ops) {
            if (o.type === "touch") continue;
            if (o.sessionId === localId) remaining.push(o);
          }
        }
      }

      // Persist processed opIds & remaining (drop 'touch')
      saveProcessed(processed);
      const filtered = remaining.filter(o => o.type !== "touch");
      saveOutbox(filtered);

      // prune finished-pending with no pending ops
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
    };

    flush();
  }, [online, user]);

  const addStamp = async (id, name, dur = 0) => {
    const now = new Date();
    const lastForLoc = [...stamps].reverse().find(s => s.zuptName === name);
    if (lastForLoc && now - lastForLoc.time < 2000) return;

    const upd = [...stamps, { ...(id ? { zuptId: id } : {}), zuptName: name, time: now, duration: dur }];
    setStamps(upd);
    persistStampsLocal(sessionId, upd);
    void store(upd, "Stamp saved");
  };

  const undoLast = async () => {
    if (!stamps.length) return;
    if (!window.confirm("Undo last stamp?")) return;
    const rest = stamps.slice(0, -1);
    setStamps(rest);
    setActive(null); setRemain(null);
    setCaptured(prev => { const s = new Set(prev); s.delete(stamps.at(-1).zuptName); return s; });
    persistStampsLocal(sessionId, rest);
    void store(rest, "Last stamp removed");
  };

  /* actions */
  const start = async () => {
    if (!activePlan || !title.trim() || !user) return;
    const ts = new Date();
    const snapshot = { id: activePlan.id, name: activePlan.name, zupts: activePlan.zupts || [] };

    let newId = null;
    let offlineStart = !online;

    if (!online) {
      newId = `local:${Date.now()}`;
      const payload = {
        uid: user.uid,
        planId: snapshot.id,
        planName: snapshot.name,
        planSnapshot: snapshot,
        sessionTitle: title.trim(),
        timezone: tz,
        startedAt: ts.getTime(),        // millis for JSON durability
        timestamps: [],
        endedAt: null,
        startedOffline: true,
        createdAt: Date.now()
      };
      pushCreateOnce(newId, payload);
      localQueueTouch();
    } else {
      try {
        const ref = await addDoc(collection(db, "sessions"), {
          uid: user.uid,
          planId: snapshot.id,
          planName: snapshot.name,
          planSnapshot: snapshot,
          sessionTitle: title.trim(),
          timezone: tz,
          startedAt: Timestamp.fromDate(ts),
          timestamps: [],
          endedAt: null,
          startedOffline: false,
          createdAt: Timestamp.fromDate(new Date())
        });
        newId = ref.id;
      } catch {
        newId = `local:${Date.now()}`;
        offlineStart = true;
        const payload = {
          uid: user.uid,
          planId: snapshot.id,
          planName: snapshot.name,
          planSnapshot: snapshot,
          sessionTitle: title.trim(),
          timezone: tz,
          startedAt: ts.getTime(),
          timestamps: [],
          endedAt: null,
          startedOffline: true,
          createdAt: Date.now()
        };
        pushCreateOnce(newId, payload);
      }
    }

    const idx = loadIndex();
    idx[newId] = {
      id: newId,
      uid: user.uid,
      title: title.trim(),
      planId: snapshot.id,
      planName: snapshot.name,
      startedAt: ts.toISOString(),
      startedOffline: offlineStart,
      status: "active"
    };
    saveIndex(idx);
    saveStamps(newId, []);

    setSessionId(newId);
    setStartedAt(ts);
    setLoopMeta({ loopIdx: 1, loopOn: false });
    setCaptured(new Set());
    setStamps([]);
    setSessionPlan(snapshot);
    setStartedOffline(offlineStart);
    setSnack(offlineStart ? "Session started (offline)" : "Session started");

    try { sessionStorage.setItem("activeSessionId", newId); } catch {}
    if (offlineStart) setTimeout(() => window.location.reload(), 300);
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
          id: meta.planId,
          name: meta.planName,
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

  const toggleLoop = async () => {
    if (!loopOn) {
      await addStamp(null, `L${loopIdx} Start`);
    } else {
      await addStamp(null, `L${loopIdx} Stop`);
      setActive(null); setRemain(null);
    }
  };

  const clickZ = async (z) => {
    if (captured.has(z.name) || timerRunning) return;
    if (!loopOn) { setSnack("Needs to Record Lap"); return; }
    setCaptured(prev => new Set(prev).add(z.name));
    setActive(z);
    setRemain(z.wait || 0);
    void addStamp(z.id, z.name, z.wait || 0);
  };

  const manual = async () => {
    const note = prompt("Note for manual timestamp:");
    if (note) void addStamp(null, `MANUAL: ${note}`);
  };

  const finish = async () => {
    if (!sessionId) return;
    const payloadOffline = { endedAt: Date.now() };
    let queued = !online;

    if (!online) {
      pushReplace(sessionId, "finish", payloadOffline);
      localQueueTouch();
    } else {
      try {
        await updateDoc(doc(db, "sessions", sessionId), { endedAt: Timestamp.fromDate(new Date()) });
      } catch {
        queued = true;
        pushReplace(sessionId, "finish", payloadOffline);
      }
    }

    const idx = loadIndex();
    if (queued) {
      if (idx[sessionId]) idx[sessionId].status = "finished-pending";
      saveIndex(idx);
    } else {
      if (idx[sessionId]) { delete idx[sessionId]; saveIndex(idx); }
    }

    try { sessionStorage.removeItem("activeSessionId"); } catch {}
    setSnack(queued ? "Session finalized (will upload when online)" : "Session finalized");
    setTimeout(() => window.location.reload(), 400);
  };

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

  /* === UI === */
  if (user === undefined) return <LoaderOverlay open />; // loading auth
  if (user === null) return (
    <Box sx={{ maxWidth: 720, mx: "auto", p: 3 }}>
      <Alert severity="info">Please sign in to run a session.</Alert>
    </Box>
  );

  const outbox = !online ? loadOutbox() : [];
  const queuedCount = outbox.filter(o => o.type !== "touch").length;
  const pendingFinished = !online
    ? Object.values(loadIndex()).filter(x => x.status === "finished-pending" && x.uid === user.uid)
    : [];
  const finishedCount = pendingFinished.length;

  const localActives = Object.values(loadIndex())
    .filter(x => x.status === "active" && x.uid === user.uid)
    .map(x => ({ ...x, local: true }));

  const unfinished = [
    ...unfinishedFirebase,
    ...localActives.filter(l => !unfinishedFirebase.some(f => f.id === l.id))
  ];

  return (
  <Box sx={{ maxWidth: isMobile ? "100%" : 900, mx: "auto", px: isMobile ? 1 : 2, pt: 2, pb: 8 }}>
    {/* ───────────────── Header / Clock / Status ───────────────── */}
    <Paper
      elevation={6}
      sx={{
        p: isMobile ? 2 : 3,
        mb: isMobile ? 3 : 4,
        borderRadius: 3,
        color: "#fff",
        textAlign: "center",
        bgcolor: "transparent",
        background:
          "radial-gradient(110% 140% at 0% 0%, rgba(99,102,241,1) 0%, rgba(79,70,229,1) 55%, rgba(67,56,202,1) 100%)",
        boxShadow:
          "0 10px 30px rgba(79,70,229,.35), inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      <Typography
        variant={isMobile ? "h5" : "h4"}
        fontWeight={800}
        letterSpacing={0.2}
        sx={{ textShadow: "0 1px 10px rgba(0,0,0,.18)" }}
      >
        {clock}
      </Typography>

      {startedAt && startedOffline && (
        <Tooltip title="This session was started while offline">
          <Chip
            size="small"
            color="warning"
            variant="filled"
            icon={<OfflineBoltIcon />}
            label="Started offline"
            sx={{
              mt: 1,
              color: "#111",
              fontWeight: 600,
              bgcolor: "rgba(255,214,102,.95)",
              "& .MuiChip-icon": { color: "#111" },
            }}
          />
        </Tooltip>
      )}

      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <TextField
          select
          size="small"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          sx={{
            mt: 1.25,
            width: 140,
            ".MuiOutlinedInput-root": {
              bgcolor: "rgba(255,255,255,0.12)",
              color: "#fff",
              borderRadius: 2,
              "& fieldset": { borderColor: "rgba(255,255,255,0.18)" },
              "&:hover fieldset": { borderColor: "rgba(255,255,255,0.35)" },
            },
            ".MuiSvgIcon-root": { color: "#fff" },
          }}
        >
          {TZ_LIST.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* compact status row — render ONLY when offline */}
      {!online && (
        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="center"
          alignItems="center"
          sx={{ mt: 1.25 }}
        >
          <Tooltip title="Offline — network unavailable">
            <span>
              <IconButton
                size="small"
                onClick={() => setOpenPanel("net")}
                aria-label="Network status"
                sx={{
                  color: "warning.light",
                  bgcolor: "rgba(0,0,0,.18)",
                  "&:hover": { bgcolor: "rgba(0,0,0,.26)" },
                }}
              >
                <CloudOffIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip
            title={
              queuedCount
                ? `${queuedCount} change${queuedCount > 1 ? "s" : ""} queued`
                : "No queued changes"
            }
          >
            <span>
              <Badge
                badgeContent={queuedCount || 0}
                color={queuedCount ? "info" : "default"}
                overlap="circular"
              >
                <IconButton
                  size="small"
                  onClick={() => setOpenPanel("queued")}
                  aria-label="Queued changes"
                  sx={{
                    color: queuedCount ? "info.light" : "rgba(255,255,255,.7)",
                    bgcolor: "rgba(0,0,0,.18)",
                    "&:hover": { bgcolor: "rgba(0,0,0,.26)" },
                  }}
                >
                  <CloudUploadIcon fontSize="small" />
                </IconButton>
              </Badge>
            </span>
          </Tooltip>

          <Tooltip
            title={
              finishedCount
                ? `${finishedCount} finished session${
                    finishedCount > 1 ? "s" : ""
                  } pending`
                : "Nothing pending"
            }
          >
            <span>
              <Badge
                badgeContent={finishedCount || 0}
                color={finishedCount ? "warning" : "default"}
                overlap="circular"
              >
                <IconButton
                  size="small"
                  onClick={() => setOpenPanel("finished")}
                  aria-label="Finished pending"
                  sx={{
                    color: finishedCount ? "warning.light" : "rgba(255,255,255,.7)",
                    bgcolor: "rgba(0,0,0,.18)",
                    "&:hover": { bgcolor: "rgba(0,0,0,.26)" },
                  }}
                >
                  <AssignmentTurnedInIcon fontSize="small" />
                </IconButton>
              </Badge>
            </span>
          </Tooltip>
        </Stack>
      )}
    </Paper>

    <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
      Run a Plan Session
    </Typography>

    {/* ───────────────── Resume (when nothing started) ───────────────── */}
    {!startedAt && unfinished.length > 0 && (
      <Box mb={3}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Resume unfinished:
        </Typography>
        {unfinished.map((s) => (
          <Button
            key={s.id}
            variant="outlined"
            size={isMobile ? "small" : "medium"}
            sx={{ mr: 1, mb: 1 }}
            onClick={() => resume(s)}
          >
            ▶ {s.sessionTitle || s.title || s.planName}
            {s.local ? " (local)" : s.startedOffline ? " (offline)" : ""}
          </Button>
        ))}
        <Divider sx={{ my: 2 }} />
      </Box>
    )}

    {/* ───────────────── First-time form ───────────────── */}
    {!startedAt && (
      <>
        <TextField
          select
          fullWidth
          label="Select Plan"
          sx={{ mb: 2 }}
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
        >
          {plans.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          label="Session Title"
          sx={{ mb: 2 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          fullWidth
          variant="contained"
          size={isMobile ? "large" : "medium"}
          startIcon={<PlayArrowIcon />}
          disabled={!planId || !title.trim()}
          onClick={start}
        >
          Start Session
        </Button>
      </>
    )}

    {/* ───────────────── Live mode ───────────────── */}
    {startedAt && activePlan && (
      <>
        {/* Session meta (title / plan / started) */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mt: 0.5, mb: 1, flexWrap: "wrap" }}
        >
          <Chip
            size="small"
            label={title || "(untitled)"}
            sx={{
              bgcolor: "rgba(99,102,241,0.10)",
              border: "1px solid rgba(99,102,241,0.35)",
              color: "text.primary",
              fontWeight: 500,
            }}
          />
          {activePlan?.name && (
            <Chip
              size="small"
              label={activePlan.name}
              sx={{
                bgcolor: "rgba(99,102,241,0.10)",
                border: "1px solid rgba(99,102,241,0.35)",
                color: "text.primary",
                fontWeight: 500,
              }}
            />
          )}
          <Chip
            size="small"
            label={`${toDateSafe(startedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}`}
            sx={{
              bgcolor: "rgba(99,102,241,0.10)",
              border: "1px solid rgba(99,102,241,0.35)",
              color: "text.primary",
              fontWeight: 500,
            }}
          />
        </Stack>

        {/* Elapsed / Lap strip */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: isMobile ? 1 : 2 }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <TimerIcon fontSize="small" sx={{ color: "primary.main" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Elapsed: <strong>{lap}</strong>
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <LocationIcon
              fontSize="small"
              sx={{ color: loopOn ? "error.main" : "text.secondary" }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Current Lap: <strong>L{loopOn ? loopIdx : Math.max(1, loopIdx - 1)}</strong>{" "}
              <Typography
                component="span"
                variant="caption"
                sx={{ ml: 0.5, color: "text.secondary" }}
              >
                {loopOn ? "(running)" : ""}
              </Typography>
            </Typography>
          </Stack>
        </Stack>

        {/* Active ZUPT countdown */}
        {active && (
          <Box textAlign="center" mb={2}>
            <CountdownRing
              secondsLeft={remain}
              total={active.wait || 0}
              size={isMobile ? 80 : 130}
              stroke={isMobile ? 6 : 8}
            />
            <Typography
              variant="h6"
              sx={{
                mt: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 1,
              }}
            >
              <LocationIcon fontSize="small" /> {active.name}
              <IconButton
                onClick={undoLast}
                size={isMobile ? "small" : "medium"}
                sx={{ color: "error.main", ml: 0.5 }}
              >
                <UndoIcon />
              </IconButton>
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* ZUPT chips */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Select ZUPT location:
          </Typography>
          <IconButton
            size="small"
            sx={{ ml: 0.5 }}
            onClick={() => setReverse((p) => !p)}
            title="Flip order"
          >
            <SwapVertIcon fontSize="inherit" sx={{ transform: "rotate(90deg)" }} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", gap: 1, overflowX: "auto", py: 1 }}>
          {(reverse ? [...(activePlan.zupts || [])].reverse() : activePlan.zupts || []).map(
            (z, i) => {
              const done = captured.has(z.name);
              const disabled = timerRunning || done;
              return (
                <Chip
                  key={z.id || z.name}
                  label={z.name}
                  icon={done ? <CheckIcon /> : <TimerIcon />}
                  color={done ? chipTone(i) : "default"}
                  variant={done ? "filled" : "outlined"}
                  clickable={!disabled}
                  onClick={!disabled ? () => clickZ(z) : undefined}
                />
              );
            }
          )}
        </Box>

        {/* Stamps table */}
        {!!stamps.length && (
          <Box mt={4} mb={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Recorded timestamps:
            </Typography>
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ maxHeight: 240, mb: 2, pb: 8 }}
            >
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
                      <TableCell>{fmt(toDateSafe(t.time))}</TableCell>
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

    {/* ───────────────── Sticky Action Bar ───────────────── */}
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
          backgroundColor: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.25)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          zIndex: theme.zIndex.drawer + 2,
        }}
      >
        <Stack direction="row" spacing={isMobile ? 1 : 2} justifyContent="center" flexWrap="wrap">
          <Button
            fullWidth={isMobile}
            sx={{ flex: isMobile ? 1 : undefined, py: 1.5 }}
            variant="contained"
            color={loopOn ? "error" : "primary"}
            startIcon={loopOn ? <StopIcon /> : <LocationIcon />}
            onClick={toggleLoop}
            size={isMobile ? "small" : "medium"}
          >
            {loopOn ? `Stop L${loopIdx}` : `Record L${loopIdx}`}
          </Button>

          <Button
            fullWidth={isMobile}
            sx={{ flex: isMobile ? 1 : undefined }}
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={manual}
            disabled={timerRunning}
            size={isMobile ? "small" : "medium"}
          >
            Manual
          </Button>

          <Button
            fullWidth={isMobile}
            sx={{ flex: isMobile ? 1 : undefined }}
            variant="contained"
            color="success"
            startIcon={<DoneAllIcon />}
            onClick={finish}
            size={isMobile ? "small" : "medium"}
          >
            Finish
          </Button>
        </Stack>
      </Paper>
    )}

    {/* ───────────────── Snackbars & Dialogs ───────────────── */}
    <Snackbar
      open={!!snack}
      autoHideDuration={2400}
      onClose={() => setSnack("")}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert severity="success" variant="filled" sx={{ width: "100%" }}>
        {snack}
      </Alert>
    </Snackbar>

    {/* Compact Status Dialogs */}
    <Dialog open={openPanel === "net"} onClose={() => setOpenPanel(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Network status</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2">
          You’re offline because the network is unavailable. Actions are queued locally and will upload automatically when you’re
          back online.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenPanel(null)}>Close</Button>
      </DialogActions>
    </Dialog>

    <Dialog open={openPanel === "queued"} onClose={() => setOpenPanel(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Queued changes</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2">
          {queuedCount === 0
            ? "No queued changes."
            : `${queuedCount} change${queuedCount > 1 ? "s" : ""} will upload when you’re back online.`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenPanel(null)}>Close</Button>
      </DialogActions>
    </Dialog>

    <Dialog open={openPanel === "finished"} onClose={() => setOpenPanel(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Finished (pending upload)</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2">
          {finishedCount === 0
            ? "No finished sessions pending."
            : `${finishedCount} finished session${finishedCount > 1 ? "s are" : " is"} waiting to upload.`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenPanel(null)}>Close</Button>
      </DialogActions>
    </Dialog>
  </Box>
);
}