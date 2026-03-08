// src/components/SessionsPage.jsx
// Mobile-friendly with orphan-plan handling + detail popup, merge, delete & rename
// Shows tiny icons for "started offline" (⚡) and "merged", plus an info (i) icon
// for which plan was used (tooltip). Also de-dupes identical sessions on load.

import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import {
  Box, Paper, Typography, CircularProgress, List, ListItem,
  ListItemText, Divider, IconButton, Stack, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  FormControl, InputLabel, Select, MenuItem, Slider, Button, Checkbox,
  ToggleButtonGroup, ToggleButton, TableContainer,
  Table, TableHead, TableRow, TableCell, TableBody, ListItemIcon,
  useTheme, useMediaQuery, AppBar, Toolbar, TextField, Backdrop,
  Skeleton
} from "@mui/material";
import VisibilityIcon        from "@mui/icons-material/Visibility";
import DownloadIcon          from "@mui/icons-material/Download";
import MergeIcon             from '@mui/icons-material/Merge';
import DeleteForeverIcon     from "@mui/icons-material/DeleteForever";
import EditIcon              from "@mui/icons-material/Edit";
import ContentCopyIcon       from "@mui/icons-material/ContentCopy";
import EmailIcon             from "@mui/icons-material/Email";
import CloseIcon             from "@mui/icons-material/Close";
import OfflineBoltIcon       from "@mui/icons-material/OfflineBolt";
import InfoOutlinedIcon      from "@mui/icons-material/InfoOutlined";
import HistoryIcon           from "@mui/icons-material/History";
import AccessTimeIcon        from "@mui/icons-material/AccessTime";
import CalendarTodayIcon     from "@mui/icons-material/CalendarToday";
import MapIcon               from "@mui/icons-material/Map";
import TableChartIcon        from "@mui/icons-material/TableChart";

import { db } from "../firebase";
import {
  collection, query, where, getDocs, doc,
  getDoc, updateDoc, deleteDoc, addDoc, Timestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const SessionMapView = lazy(() => import("./SessionMapView"));

/* ───────── safe date helpers ───────── */
const toDateSafe = (v) => {
  if (!v) return new Date(0);
  if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  if (v instanceof Date) return v;
  return new Date(v); // ISO or millis
};
const toMillisSafe = (v) => toDateSafe(v).getTime();

/* ───────── helpers ───────── */
const UTC_TO_GPS_OFFSET = 18;
const GPS_EPOCH = Date.UTC(1980, 0, 6);
const SEC_WEEK  = 604_800;
const addSec = (d,s) => new Date(d.getTime()+s*1000);
const hhmmss = d =>
  `${d.getUTCHours().toString().padStart(2,"0")}` +
  `${d.getUTCMinutes().toString().padStart(2,"0")}` +
  `${d.getUTCSeconds().toString().padStart(2,"0")}`;
const utcToGps = utc=>{
  const g = addSec(utc,UTC_TO_GPS_OFFSET);
  const s = Math.floor((g-GPS_EPOCH)/1000);
  return { wn: Math.floor(s/SEC_WEEK), sow: s%SEC_WEEK };
};
const norm = s => (s ?? "").replace(/^\s*\d+\s*[:.\-]\s*/,"").replace(/[\s._-]+/g,"").toLowerCase();
const shortDate = ts =>
  toDateSafe(ts).toLocaleString("en-US",{
    year:"2-digit",month:"numeric",day:"numeric",
    hour:"numeric",minute:"2-digit",hour12:true
  }).replace(" AM","am").replace(" PM","pm");

const buildSessionText = s=>{
  const title = `**${s.sessionTitle||s.planName} – ${shortDate(s.startedAt)}**`;
  const ts=[...(s.timestamps||[])]
    .sort((a,b)=>toMillisSafe(a.time)-toMillisSafe(b.time));
  const loops={}, manuals=[];
  ts.forEach(t=>{
    const n=t.zuptName||""; const stamp=hhmmss(toDateSafe(t.time));
    const mS=n.match(/^L(\d+)\s*Start$/i); const mE=n.match(/^L(\d+)\s*Stop$/i);
    if(mS){ const i=mS[1]; loops[i]={...(loops[i]||{}),start:stamp};}
    else if(mE){ const i=mE[1]; loops[i]={...(loops[i]||{}),stop:stamp};}
    else if(n.startsWith("MANUAL:")) manuals.push(`• ${stamp} – ${n.replace(/^MANUAL:\s*/i,"")}`);
  });
  const lines=[];
  Object.keys(loops).sort((a,b)=>+a-+b).forEach(k=>{
    const {start="—",stop="—"}=loops[k]; lines.push(`L${k} ${start} ${stop}`);
  });
  if(manuals.length) lines.push(...manuals);
  return [title,...lines].join("\n");
};

/* ───────── component ───────── */
export default function SessionsPage() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const user     = getAuth().currentUser;

  const [sessions,setSessions] = useState(null);
  const [plans,   setPlans]    = useState({});
  const [detail,  setDetail]   = useState(null);
  const [loading, setLoading]  = useState(true);

  /* UI */
  const [basis,setBasis]     = useState("UTC");
  const [step,setStep]       = useState(0);
  const [view,setView]       = useState("ZUPT");
  const [displayMode,setDisplayMode] = useState("table");
  const [snack,setSnack]     = useState("");
  const [selected,setSelected]= useState(new Set());

  /* rename dialog */
  const [editId,setEditId]     = useState(null);
  const [editText,setEditText] = useState("");

  /* ---------- fetch helper with DUP PURGE ---------- */
  const fetchAll = useCallback(async ()=>{
    if(!user) return;
    setLoading(true);

    // Fetch all sessions for user
    const ss=await getDocs(query(
      collection(db,"sessions"),
      where("uid","==",user.uid)
    ));
    let sessionList=ss.docs.map(d=>({id:d.id,...d.data()}));

    // Build duplicate buckets by (name, startedAt, endedAt)
    const nameOf = s => (s.sessionTitle || s.planName || "").trim().toLowerCase();
    const dupKey = (s) => `${nameOf(s)}||${toMillisSafe(s.startedAt)}||${toMillisSafe(s.endedAt||0)}`;

    // Decide keeper: prefer non-local id, has endedAt, more stamps
    const score = (s) => {
      const nonLocal = typeof s.id === "string" && !s.id.startsWith("local:");
      const hasEnd   = !!s.endedAt;
      const nstamps  = (s.timestamps?.length)||0;
      return (nonLocal?1:0)*1e9 + (hasEnd?1:0)*1e6 + nstamps;
    };

    const buckets = new Map();
    for (const s of sessionList) {
      const k = dupKey(s);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(s);
    }

    const toDelete = [];
    const keptByKey = new Map();
    for (const [k, arr] of buckets.entries()) {
      if (arr.length === 1) { keptByKey.set(k, arr[0]); continue; }
      arr.sort((a,b)=>score(b)-score(a));
      const keeper = arr[0];
      keptByKey.set(k, keeper);
      for (let i=1;i<arr.length;i++){
        const s = arr[i];
        if (typeof s.id === "string" && !s.id.startsWith("local:")) {
          toDelete.push(s.id);
        }
      }
    }
    if (toDelete.length){
      await Promise.allSettled(toDelete.map(id => deleteDoc(doc(db,"sessions",id))));
    }

    sessionList = Array.from(keptByKey.values())
      .sort((a,b)=>toMillisSafe(b.startedAt)-toMillisSafe(a.startedAt));

    // Plan map (orphan detection)
    const planMap={};
    await Promise.all(
      [...new Set(sessionList.map(s=>s.planId))].map(async id=>{
        try{
          const snap=await getDoc(doc(db,"plans",id));
          planMap[id]=snap.exists()?snap.data():null;
        }catch{ planMap[id]=null;}
      })
    );

    setSessions(sessionList);
    setPlans(planMap);
    setSelected(new Set());
    setLoading(false);
  },[user]);

  useEffect(()=>{fetchAll();},[fetchAll]);

  /* helpers */
  const zInfo=(plan,key)=>plan?.zupts?.find(z=>z.id===key||norm(z.name)===norm(key));

  /* ---------- delete / merge ---------- */
  const deleteSelected=async()=>{
    if(!selected.size){setSnack("No sessions selected");return;}
    if(!window.confirm(`Delete ${selected.size} selected sessions?`))return;
    await Promise.all([...selected].map(id=>deleteDoc(doc(db,"sessions",id))));
    fetchAll(); setSnack("Selected sessions deleted 🗑️");
  };

  const mergeSelected=async()=>{
    if(selected.size<2){setSnack("Select ≥ 2 sessions to merge");return;}
    const selArr=sessions.filter(s=>selected.has(s.id));
    const planId=selArr[0].planId;
    if(!selArr.every(s=>s.planId===planId)){
      setSnack("All selected sessions must belong to the same plan");return;
    }
    if(!window.confirm(`Merge ${selArr.length} sessions into one?`))return;

    const mergedT=selArr
      .flatMap(s=>(s.timestamps||[]))
      .map(t=>({...t, time: toDateSafe(t.time)}))
      .sort((a,b)=>a.time.getTime()-b.time.getTime())
      .map(t=>({...t, time: Timestamp.fromDate(t.time)}));

    const earliestDate = selArr.reduce(
      (min,s)=> Math.min(min, toMillisSafe(s.startedAt)),
      toMillisSafe(selArr[0].startedAt)
    );
    const earliest = Timestamp.fromDate(new Date(earliestDate));

    const mergedEndTs = selArr.some(s=>s.endedAt)
      ? selArr.reduce((max,s)=>{
          const m = s.endedAt ? toMillisSafe(s.endedAt) : null;
          return m !== null ? Math.max(max, m) : max;
        }, 0)
      : Date.now();
    const mergedEnd = Timestamp.fromDate(new Date(mergedEndTs));

    const title=selArr[0].sessionTitle||selArr[0].planName;

    await addDoc(collection(db,"sessions"),{
      uid:user.uid, planId,
      planName:selArr[0].planName,
      sessionTitle:`${title}`,
      isMerged:true,
      timezone:selArr[0].timezone,
      startedAt:earliest,
      endedAt:mergedEnd,
      timestamps:mergedT,
      createdAt:Timestamp.now()
    });
    await Promise.all(selArr.map(s=>deleteDoc(doc(db,"sessions",s.id))));
    setSnack("Sessions merged ✅");
    fetchAll();
  };

  /* ---------- rows & export ---------- */
  const buildRows=s=>{
    const plan=plans[s.planId]??{anchors:{}};
    const anc=["A1","A2","A3","B1","B2","B3"].map(k=>plan.anchors?.[k]??"");
    const counts={};

    return (s.timestamps||[]).flatMap(t=>{
      const zi=zInfo(plan,t.zuptId||t.zuptName);
      if(view==="ZUPT"&&!zi)return [];

      const off=step===0?0:Math.min(step,t.duration??0);
      const utc=addSec(toDateSafe(t.time),off);
      const cell=basis==="UTC"?hhmmss(utc):utcToGps(utc).sow;

      const base=zi?zi.name:t.zuptName;
      const idx=counts[base]??0; counts[base]=idx+1;
      const name=idx===0?base:`${base}_${idx}`;

      return {name,time:cell,lat:zi?.lat??"",lon:zi?.lon??"",h:zi?.height??"",anchors:anc};
    });
  };

  const exportTxt=s=>{
    const rows=buildRows(s);
    const {wn}=utcToGps(toDateSafe(s.startedAt));
    const header=`${view==="ZUPT"?"ZUPT":"STAMP"}\t`+
                 `${basis==="UTC"?"UTC_hhmmss":`GPS_SOW (WN ${wn})`}`+
                 "\tlat\tlon\theight\tA1\tA2\tA3\tB1\tB2\tB3";
    const txt=[
      s.sessionTitle||s.planName,
      `Plan: ${plans[s.planId]?plans[s.planId].name:"(deleted)"}`,
      "",
      header,
      ...rows.map(r=>[r.name,r.time,r.lat,r.lon,r.h,...r.anchors].join("\t"))
    ].join("\n");

    const url=URL.createObjectURL(new Blob([txt],{type:"text/plain"}));
    Object.assign(document.createElement("a"),{
      href:url,
      download:`Session-${s.sessionTitle||s.planName||s.id}-${basis}-${view}.txt`
    }).click();
    URL.revokeObjectURL(url);
    setSnack("TXT exported");
  };

  /* ---------- loaders ---------- */
  if(loading){
    return (
      <Box sx={{maxWidth:isMobile?"100%":900,mx:"auto",px:isMobile?1:2,pt:1,pb:6}}>
        <Stack spacing={1.5}>
          {[1,2,3,4].map(i => (
            <Paper key={i} variant="outlined" sx={{ p: 0, overflow: "hidden" }}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5 }}>
                <Skeleton variant="rectangular" width={20} height={20} sx={{ borderRadius: 0.5 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" height={22} />
                  <Stack direction="row" spacing={1} mt={0.5}>
                    <Skeleton variant="text" width={90} height={16} />
                    <Skeleton variant="rounded" width={60} height={16} />
                    <Skeleton variant="text" width={80} height={16} />
                  </Stack>
                </Box>
                <Skeleton variant="circular" width={28} height={28} />
                <Skeleton variant="circular" width={28} height={28} />
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Box>
    );
  }
  if(!sessions.length) return (
    <Box sx={{ textAlign: "center", py: 6 }}>
      <HistoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No sessions yet
      </Typography>
      <Typography variant="body2" color="text.disabled">
        Run a plan session to see your recorded timestamps here.
      </Typography>
    </Box>
  );

  /* ---------- UI ---------- */
  const toggleAll = () => {
    if (selected.size === sessions.length) setSelected(new Set());
    else setSelected(new Set(sessions.map(s => s.id)));
  };

  return(
    <Box sx={{maxWidth:isMobile?"100%":900,mx:"auto",px:isMobile?1:2,pt:1,pb:6}}>
      {/* ─── header row ─── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Checkbox
            size="small"
            checked={selected.size === sessions.length && sessions.length > 0}
            indeterminate={selected.size > 0 && selected.size < sessions.length}
            onChange={toggleAll}
            sx={{ p: 0.5 }}
          />
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {selected.size > 0 ? `${selected.size} of ${sessions.length}` : `${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
          </Typography>
        </Stack>
      </Stack>

      {/* ─── session cards ─── */}
      <Stack spacing={1.5}>
        {sessions.map(s => {
          const isSelected = selected.has(s.id);
          const stampCount = s.timestamps?.length || 0;
          const planName = plans[s.planId]?.name || s.planName || "(unknown)";
          const planDeleted = plans[s.planId] === null;
          const startedOffline = s.startedOffline || (typeof s.id === "string" && s.id.startsWith("local:"));

          return (
            <Paper
              key={s.id}
              variant="outlined"
              sx={{
                p: 0,
                overflow: "hidden",
                borderColor: isSelected ? "primary.main" : "divider",
                borderWidth: isSelected ? 2 : 1,
                borderLeftWidth: 4,
                borderLeftColor: isSelected ? "primary.main" : "secondary.light",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "primary.light", boxShadow: "0 2px 8px rgba(79,70,229,0.08)" },
              }}
            >
              <Stack direction="row" alignItems="stretch">
                {/* checkbox area */}
                <Box sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  px: 1, bgcolor: isSelected ? "primary.50" : "transparent",
                }}>
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    onChange={(_, ck) => setSelected(p => {
                      const n = new Set(p); ck ? n.add(s.id) : n.delete(s.id); return n;
                    })}
                    sx={{ p: 0.5 }}
                  />
                </Box>

                {/* main content — clickable to view detail */}
                <Box
                  onClick={() => setDetail(s)}
                  sx={{
                    flex: 1, py: 1.5, px: 1.5, cursor: "pointer",
                    minWidth: 0,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  {/* title row */}
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    <Typography sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }} noWrap>
                      {s.sessionTitle || s.planName}
                    </Typography>
                    {startedOffline && (
                      <Tooltip title="Started offline">
                        <OfflineBoltIcon sx={{ fontSize: 15, color: "warning.main" }} />
                      </Tooltip>
                    )}
                    {s.isMerged && (
                      <Tooltip title="Merged session">
                        <MergeIcon sx={{ fontSize: 15, color: "primary.main" }} />
                      </Tooltip>
                    )}
                  </Stack>

                  {/* meta row */}
                  <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      {shortDate(s.startedAt)}
                    </Typography>
                    <Box sx={{
                      display: "inline-flex", alignItems: "center",
                      bgcolor: stampCount > 0 ? "primary.50" : "grey.100",
                      color: stampCount > 0 ? "primary.main" : "text.disabled",
                      borderRadius: 1, px: 0.75, py: 0.1,
                      fontSize: 11, fontWeight: 600,
                    }}>
                      {stampCount} ZUPT{stampCount !== 1 ? "s" : ""}
                    </Box>
                    {planDeleted ? (
                      <Typography variant="caption" color="error" fontWeight={600}>
                        plan deleted
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled" noWrap sx={{ maxWidth: 140 }}>
                        {planName}
                      </Typography>
                    )}
                  </Stack>
                </Box>

                {/* action buttons */}
                <Stack direction="row" alignItems="center" spacing={0} sx={{ pr: 0.5 }}>
                  <Tooltip title="Rename">
                    <IconButton
                      size="small"
                      onClick={() => { setEditId(s.id); setEditText(s.sessionTitle || ""); }}
                    >
                      <EditIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Export TXT">
                    <IconButton size="small" onClick={() => exportTxt(s)}>
                      <DownloadIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      {/* ─── floating toolbar (selection actions) ─── */}
      {selected.size > 0 && (
        <Paper elevation={6} sx={{
          position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",
          width:{xs:"calc(90% - 32px)",sm:"520px",md:"580px"},
          px:2,py:1.25,borderRadius:4,zIndex:10,display:"flex",
          bgcolor: "primary.main", color: "white",
          alignItems:"center", justifyContent: "center",gap:1,flexWrap:{xs:"wrap",sm:"nowrap"}
        }}>
          <Typography sx={{fontWeight:600,fontSize:14,mr:0.5}}>{selected.size} selected</Typography>

          <Button size="small" sx={{color:"white",minWidth:0}} startIcon={<ContentCopyIcon/>}
            onClick={async()=>{
              const txt=[...selected]
                .map(id=>sessions.find(s=>s.id===id))
                .map(buildSessionText).join("\n\n");
              await navigator.clipboard.writeText(txt);
              setSnack("Copied summary 📋");
            }}
          >
            Copy
          </Button>
          <Button size="small" sx={{color:"white",minWidth:0}} startIcon={<EmailIcon/>}
            onClick={()=>{
              const body=encodeURIComponent(
                [...selected].map(id=>sessions.find(s=>s.id===id))
                  .map(buildSessionText).join("\n\n"));
              window.location.href=`mailto:?subject=${encodeURIComponent("Session Summaries")}&body=${body}`;
            }}
          >
            E-mail
          </Button>
          <Button size="small" sx={{color:"white",minWidth:0}} startIcon={<MergeIcon/>}
            disabled={selected.size<2}
            onClick={mergeSelected}
          >
            Merge
          </Button>
          <Button size="small" sx={{color:"error.light",minWidth:0}} startIcon={<DeleteForeverIcon/>}
            onClick={deleteSelected}
          >
            Delete
          </Button>

          <IconButton size="small" sx={{color:"white",ml:0.5}} onClick={()=>setSelected(new Set())}><CloseIcon fontSize="small"/></IconButton>
        </Paper>
      )}

      {/* ─── full detail dialog ─── */}
      <Dialog open={!!detail} onClose={()=>{setDetail(null);setDisplayMode("table");}}
              maxWidth="md" fullWidth fullScreen={isMobile} scroll="body"
              PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, overflow: "hidden" } }}>
        {detail&&(()=>{            // IIFE
          const wn=utcToGps(toDateSafe(detail.startedAt)).wn;
          const rows=buildRows(detail);
          const startedOffline = detail.startedOffline || (typeof detail.id === "string" && detail.id.startsWith("local:"));
          const detailPlanName = plans[detail.planId]?.name || detail.planName || "(unknown)";
          const planDeleted = plans[detail.planId] === null;
          const stampCount = detail.timestamps?.length || 0;
          const startD = toDateSafe(detail.startedAt);
          const endD = detail.endedAt ? toDateSafe(detail.endedAt) : null;
          const durationSec = endD ? Math.round((endD - startD) / 1000) : null;
          const durationStr = durationSec != null
            ? durationSec >= 3600
              ? `${Math.floor(durationSec/3600)}h ${Math.floor((durationSec%3600)/60)}m ${durationSec%60}s`
              : durationSec >= 60
                ? `${Math.floor(durationSec/60)}m ${durationSec%60}s`
                : `${durationSec}s`
            : null;

          return(
            <>
              {/* ─── Header banner ─── */}
              <Box sx={{
                background: "linear-gradient(135deg, rgba(99,102,241,1) 0%, rgba(79,70,229,1) 55%, rgba(67,56,202,1) 100%)",
                color: "#fff",
                px: { xs: 2, sm: 3 },
                pt: { xs: 2, sm: 2.5 },
                pb: { xs: 2, sm: 2.5 },
                position: "relative",
              }}>
                <IconButton
                  onClick={()=>setDetail(null)}
                  sx={{ position: "absolute", top: 8, right: 8, color: "rgba(255,255,255,0.8)", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.12)" } }}
                  size="small"
                >
                  <CloseIcon />
                </IconButton>

                <Typography variant={isMobile ? "h6" : "h5"} fontWeight={700} sx={{ pr: 4, textShadow: "0 1px 6px rgba(0,0,0,0.15)" }}>
                  {detail.sessionTitle||detail.planName}
                </Typography>

                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" alignItems="center">
                  <Box sx={{
                    display: "inline-flex", alignItems: "center", gap: 0.5,
                    bgcolor: "rgba(255,255,255,0.15)", borderRadius: 1.5, px: 1, py: 0.25,
                    fontSize: 12, fontWeight: 600, backdropFilter: "blur(4px)",
                  }}>
                    <MapIcon sx={{ fontSize: 14 }} />
                    {planDeleted ? "Plan deleted" : detailPlanName}
                  </Box>
                  <Box sx={{
                    display: "inline-flex", alignItems: "center", gap: 0.5,
                    bgcolor: "rgba(255,255,255,0.15)", borderRadius: 1.5, px: 1, py: 0.25,
                    fontSize: 12, fontWeight: 600, backdropFilter: "blur(4px)",
                  }}>
                    {stampCount} ZUPT{stampCount !== 1 ? "s" : ""}
                  </Box>
                  {durationStr && (
                    <Box sx={{
                      display: "inline-flex", alignItems: "center", gap: 0.5,
                      bgcolor: "rgba(255,255,255,0.15)", borderRadius: 1.5, px: 1, py: 0.25,
                      fontSize: 12, fontWeight: 600, backdropFilter: "blur(4px)",
                    }}>
                      <AccessTimeIcon sx={{ fontSize: 14 }} />
                      {durationStr}
                    </Box>
                  )}
                  {startedOffline && (
                    <Box sx={{
                      display: "inline-flex", alignItems: "center", gap: 0.5,
                      bgcolor: "rgba(255,214,102,0.9)", color: "#111", borderRadius: 1.5, px: 1, py: 0.25,
                      fontSize: 12, fontWeight: 600,
                    }}>
                      <OfflineBoltIcon sx={{ fontSize: 14 }} />
                      Offline
                    </Box>
                  )}
                </Stack>
              </Box>

              <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
                {/* ─── Time info strip ─── */}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 1, sm: 3 }}
                  sx={{
                    mb: 2.5, py: 1.5, px: 2,
                    bgcolor: "action.hover", borderRadius: 2,
                    border: "1px solid", borderColor: "divider",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                    <CalendarTodayIcon sx={{ fontSize: 18, color: "primary.main" }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1 }}>
                        Started
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {startD.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                    <CalendarTodayIcon sx={{ fontSize: 18, color: endD ? "success.main" : "text.disabled" }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1 }}>
                        Ended
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {endD
                          ? endD.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
                          : "In progress"}
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>

                {planDeleted && (
                  <Alert severity="warning" variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
                    Original plan deleted — coordinates unavailable.
                  </Alert>
                )}

                {/* ─── Controls ─── */}
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ mb: 2 }}
                >
                  <Select
                    size="small"
                    value={basis}
                    onChange={e=>setBasis(e.target.value)}
                    sx={{
                      minWidth: 140, borderRadius: 2, fontSize: 13, fontWeight: 600,
                      bgcolor: "action.hover",
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
                      "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "primary.main" },
                      "& .MuiSelect-select": { py: 0.75, pl: 1.5 },
                    }}
                    MenuProps={{
                      PaperProps: {
                        sx: { borderRadius: 2, mt: 0.5, boxShadow: 6 },
                      },
                    }}
                  >
                    <MenuItem value="UTC" sx={{ fontSize: 13, fontWeight: 500 }}>UTC (hhmmss)</MenuItem>
                    <MenuItem value="GPS_SOW" sx={{ fontSize: 13, fontWeight: 500 }}>GPS SOW – wk {wn}</MenuItem>
                  </Select>

                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={view}
                    onChange={(_,v)=>v&&setView(v)}
                    sx={{
                      "& .MuiToggleButton-root": {
                        px: 1.5, py: 0.5, fontSize: 12, fontWeight: 600,
                        borderRadius: "8px !important", border: "none",
                        color: "text.secondary",
                        "&.Mui-selected": { bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } },
                      },
                      bgcolor: "action.hover", borderRadius: 2, p: 0.25,
                    }}
                  >
                    <ToggleButton value="ZUPT">ZUPT</ToggleButton>
                    <ToggleButton value="ALL">All</ToggleButton>
                  </ToggleButtonGroup>

                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={displayMode}
                    onChange={(_,v)=>v&&setDisplayMode(v)}
                    sx={{
                      "& .MuiToggleButton-root": {
                        px: 1, py: 0.5, fontSize: 12, fontWeight: 600,
                        borderRadius: "8px !important", border: "none",
                        color: "text.secondary",
                        "&.Mui-selected": { bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } },
                      },
                      bgcolor: "action.hover", borderRadius: 2, p: 0.25,
                    }}
                  >
                    <ToggleButton value="table"><TableChartIcon sx={{ fontSize: 16, mr: 0.5 }} />Table</ToggleButton>
                    <ToggleButton value="map"><MapIcon sx={{ fontSize: 16, mr: 0.5 }} />Map</ToggleButton>
                  </ToggleButtonGroup>

                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{
                      bgcolor: "action.hover", borderRadius: 2, px: 1.5, py: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap sx={{ mr: 0.5 }}>
                      Step (s)
                    </Typography>
                    <Slider
                      value={step} min={0} max={20} step={1} size="small"
                      valueLabelDisplay="auto"
                      onChange={(_,v)=>setStep(v)}
                      sx={{
                        width: 80,
                        "& .MuiSlider-track": {
                          bgcolor: "primary.main",
                        },
                        "& .MuiSlider-rail": {
                          bgcolor: "grey.400",
                          opacity: 0.8,
                        },
                        "& .MuiSlider-thumb": {
                          bgcolor: "primary.main",
                          width: 14,
                          height: 14,
                          "&:hover, &.Mui-focusVisible": {
                            boxShadow: (t) => `0 0 0 6px ${t.palette.primary.main}33`,
                          },
                        },
                      }}
                    />
                    <Typography
                      variant="caption" fontWeight={700}
                      sx={{
                        minWidth: 20, textAlign: "center",
                        color: (t) => t.palette.mode === "dark" ? "grey.300" : "primary.main",
                      }}
                    >
                      {step}
                    </Typography>
                  </Stack>

                  <Box sx={{ flex: 1 }} />

                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<DownloadIcon/>}
                    onClick={()=>exportTxt(detail)}
                    sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, px: 2 }}
                  >
                    Export
                  </Button>
                </Stack>

                {/* ─── Data: table or map ─── */}
                {displayMode === "map" ? (
                  <Suspense fallback={<Box sx={{ height: 380, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress /></Box>}>
                    <SessionMapView rows={rows} isDark={theme.palette.mode === "dark"} />
                  </Suspense>
                ) : (
                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{ maxHeight: 380, borderRadius: 2 }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", minWidth: 100 }}>
                          ZUPT / Stamp
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
                          {basis==="UTC" ? "UTC hhmmss" : `GPS SOW (wn ${wn})`}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>Lat</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>Lon</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>H</TableCell>
                        {["A1","A2","A3","B1","B2","B3"]
                          .map(a => <TableCell key={a} sx={{ fontWeight: 700, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", fontSize: 12 }}>{a}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.length
                        ? rows.map((r,i)=>(
                            <TableRow
                              key={i}
                              sx={{
                                "&:nth-of-type(even)": { backgroundColor: "action.hover" },
                                "&:hover": { backgroundColor: (t) => t.palette.mode === "dark" ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.04)" },
                                ...(r.name.match(/^L\d+\s+(Start|Stop)$/) ? {
                                  bgcolor: (t) => t.palette.mode === "dark" ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.06)",
                                } : {}),
                              }}
                            >
                              <TableCell sx={{
                                fontWeight: 600,
                                color: r.name.match(/^L\d+\s+Start$/) ? "success.main"
                                     : r.name.match(/^L\d+\s+Stop$/) ? "error.main"
                                     : "primary.main",
                                fontSize: 13,
                              }}>
                                {r.name}
                              </TableCell>
                              <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{r.time}</TableCell>
                              <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{r.lat}</TableCell>
                              <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{r.lon}</TableCell>
                              <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{r.h}</TableCell>
                              {r.anchors.map((v,j) => <TableCell key={j} sx={{ fontFamily: "monospace", fontSize: 12 }}>{v}</TableCell>)}
                            </TableRow>
                          ))
                        : <TableRow>
                            <TableCell colSpan={11} align="center" sx={{ py: 4, color: "text.secondary" }}>
                              No matching stamps
                            </TableCell>
                          </TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
                )}
              </DialogContent>
            </>
          );})()}
      </Dialog>

      {/* ─── rename dialog ─── */}
      <Dialog open={!!editId} onClose={()=>setEditId(null)}>
        <DialogTitle>Rename session</DialogTitle>
        <DialogContent>
          <TextField fullWidth autoFocus label="Title"
            value={editText} onChange={e=>setEditText(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setEditId(null)}>Cancel</Button>
          <Button variant="contained" onClick={async ()=>{
            await updateDoc(doc(db,"sessions",editId),{sessionTitle:editText});
            setSessions(list=>list.map(s=>s.id===editId?{...s,sessionTitle:editText}:s));
            setEditId(null); setSnack("Session renamed ✏️");
          }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* ─── snackbar ─── */}
      <Snackbar open={!!snack} autoHideDuration={2600}
        onClose={()=>setSnack("")}
        anchorOrigin={{vertical:"bottom",horizontal:"center"}}>
        <Alert severity="success" variant="filled" sx={{width:"100%"}}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  );
}
