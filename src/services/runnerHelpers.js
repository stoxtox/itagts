// src/services/runnerHelpers.js
// Extracted from PlanRunner.jsx — helpers, constants, localStorage, outbox, state derivation.

import { Timestamp } from "firebase/firestore";

/* ───────── constants ───────── */
export const TZ_LIST = ["UTC", "EST", "CST", "MST", "PDT", "GMT", "CET", "IST", "JST"];
export const TZ_IANA = {
  UTC: "UTC", EST: "America/New_York", CST: "America/Chicago", MST: "America/Denver",
  PDT: "America/Los_Angeles", GMT: "Etc/GMT", CET: "Europe/Paris",
  IST: "Asia/Kolkata", JST: "Asia/Tokyo"
};

export const clockStr = z =>
  new Date().toLocaleTimeString("en-US", { timeZone: TZ_IANA[z], hour12: false });

export const chipTone = i =>
  ["default", "success", "info", "warning", "secondary", "primary", "error"][(i + 1) % 7];

/* ───────── localStorage keys ───────── */
export const PLANS_CACHE_KEY = "plansCache_v1";
export const OUTBOX_KEY = "sessionOutbox_v1";
export const INDEX_KEY = "sessionIndex_v1";
export const STAMPS_KEY_PREFIX = "stamps_";

/* ───────── localStorage helpers ───────── */
export const loadOutbox = () => {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch { return []; }
};
export const saveOutbox = (ops) => {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops)); } catch {}
};

export const loadIndex = () => {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || "{}"); } catch { return {}; }
};
export const saveIndex = (idx) => {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(idx)); } catch {}
};

const stampsKey = (sid) => `${STAMPS_KEY_PREFIX}${sid}`;
export const loadStamps = (sid) => {
  try {
    const raw = localStorage.getItem(stampsKey(sid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return arr.map(t => ({ ...t, time: new Date(t.time) }));
  } catch { return []; }
};
export const saveStamps = (sid, list) => {
  try {
    localStorage.setItem(
      stampsKey(sid),
      JSON.stringify(list.map(t => ({ ...t, time: t.time.toISOString() })))
    );
  } catch {}
};

/* ───────── Outbox idempotency ───────── */
const OP_TRACK_KEY = "outboxProcessed_v1";
export const loadProcessed = () => {
  try { return new Set(JSON.parse(localStorage.getItem(OP_TRACK_KEY) || "[]")); }
  catch { return new Set(); }
};
export const saveProcessed = (set) => {
  try { localStorage.setItem(OP_TRACK_KEY, JSON.stringify([...set])); } catch {}
};
export const genOpId = () => `op_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

/** Replace prior ops of the same type for this session, then push. */
export const pushReplace = (sessionId, type, payload) => {
  const ops = loadOutbox();
  const next = ops.filter(o => !(o.sessionId === sessionId && o.type === type));
  next.push({ opId: genOpId(), type, sessionId, payload });
  saveOutbox(next);
};

/** Guard against adding more than one CREATE for the same local session. */
export const pushCreateOnce = (sessionId, payload) => {
  const ops = loadOutbox();
  if (!ops.some(o => o.type === "create" && o.sessionId === sessionId)) {
    ops.push({ opId: genOpId(), type: "create", sessionId, payload });
    saveOutbox(ops);
  }
};

/** Merge ops per session: keep first create, last update, last finish. */
export const groupAndCoalesce = (ops) => {
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

/* ───────── Safe conversions ───────── */
export const toDateSafe = (v) => {
  if (!v) return new Date(0);
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number" && typeof v?.nanoseconds === "number") {
    return new Date(v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6));
  }
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  return new Date(v);
};
export const toMillis = (v) => toDateSafe(v).getTime();
export const toTimestamp = (v) => Timestamp.fromDate(toDateSafe(v));

/** Deep-rehydrate any {seconds,nanoseconds} or ms into Firestore Timestamps */
export const rehydrateTimestampsInPayload = (payload) => {
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

/* ───────── derive lap & captured ───────── */
export function deriveLoopState(stamps) {
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
