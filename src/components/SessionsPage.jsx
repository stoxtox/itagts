// src/components/SessionsPage.jsx
// Mobile-friendly with orphan-plan handling + detail popup, merge, delete & rename

import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Paper, Typography, CircularProgress, List, ListItem,
  ListItemText, Divider, IconButton, Stack, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  FormControl, InputLabel, Select, MenuItem, Slider, Button, Checkbox,
  ToggleButtonGroup, ToggleButton, TableContainer,
  Table, TableHead, TableRow, TableCell, TableBody, ListItemIcon,
  useTheme, useMediaQuery, AppBar, Toolbar, Chip, TextField,
  Skeleton, Backdrop
} from "@mui/material";
import VisibilityIcon    from "@mui/icons-material/Visibility";
import DownloadIcon      from "@mui/icons-material/Download";
import MergeIcon         from "@mui/icons-material/LibraryAdd";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditIcon          from "@mui/icons-material/Edit";
import ContentCopyIcon   from "@mui/icons-material/ContentCopy";
import EmailIcon         from "@mui/icons-material/Email";
import CloseIcon         from "@mui/icons-material/Close";

import { db } from "../firebase";
import {
  collection, query, where, getDocs, doc,
  getDoc, updateDoc, deleteDoc, addDoc, Timestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

/* ───────── helpers (unchanged) ───────── */
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
const norm = s => s.replace(/^\s*\d+\s*[:.\-]\s*/,"").replace(/[\s._-]+/g,"").toLowerCase();
const shortDate = ts =>
  ts.toDate().toLocaleString("en-US",{
    year:"2-digit",month:"numeric",day:"numeric",
    hour:"numeric",minute:"2-digit",hour12:true
  }).replace(" AM","am").replace(" PM","pm");

const buildSessionText = s=>{
  const title = `**${s.sessionTitle||s.planName} – ${shortDate(s.startedAt)}**`;
  const ts=[...(s.timestamps||[])].sort((a,b)=>a.time.toMillis()-b.time.toMillis());
  const loops={}, manuals=[];
  ts.forEach(t=>{
    const n=t.zuptName||""; const stamp=hhmmss(t.time.toDate());
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
  const [loading, setLoading]  = useState(true);     // ⬅️ loader flag

  /* UI */
  const [basis,setBasis]     = useState("UTC");
  const [step,setStep]       = useState(0);
  const [view,setView]       = useState("ZUPT");
  const [snack,setSnack]     = useState("");
  const [selected,setSelected]= useState(new Set());

  /* rename dialog */
  const [editId,setEditId]     = useState(null);
  const [editText,setEditText] = useState("");

  /* ---------- fetch helper ---------- */
  const fetchAll = useCallback(async ()=>{
    if(!user) return;
    setLoading(true);
    const ss=await getDocs(query(
      collection(db,"sessions"),
      where("uid","==",user.uid)
    ));
    const sessionList=ss.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>b.startedAt.toMillis()-a.startedAt.toMillis());  // newest start first

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

    const mergedT=selArr.flatMap(s=>s.timestamps||[])
      .sort((a,b)=>a.time.toMillis()-b.time.toMillis());
    const earliest=selArr.reduce(
      (min,s)=>s.startedAt.toMillis()<min.toMillis()?s.startedAt:min, selArr[0].startedAt);
    const mergedEnd=selArr.some(s=>s.endedAt)?selArr.reduce(
      (max,s)=>!max||s.endedAt?.toMillis()>max.toMillis()?s.endedAt:max,null)
      :Timestamp.now();
    const title=selArr[0].sessionTitle||selArr[0].planName;

    await addDoc(collection(db,"sessions"),{
      uid:user.uid, planId,
      planName:selArr[0].planName,
      sessionTitle:`${title} (merged)`,
      isMerged:true,            // 👈 flag for badge
      timezone:selArr[0].timezone,
      startedAt:earliest, endedAt:mergedEnd,
      timestamps:mergedT, createdAt:Timestamp.now()
    });
    await Promise.all(selArr.map(s=>deleteDoc(doc(db,"sessions",s.id))));
    setSnack("Sessions merged ✅");
    fetchAll();
  };

  /* ---------- rows & export (unchanged) ---------- */
  const buildRows=s=>{
    const plan=plans[s.planId]??{anchors:{}};
    const anc=["A1","A2","A3","B1","B2","B3"].map(k=>plan.anchors?.[k]??"");
    const counts={};

    return (s.timestamps||[]).flatMap(t=>{
      const zi=zInfo(plan,t.zuptId||t.zuptName);
      if(view==="ZUPT"&&!zi)return [];

      const off=step===0?0:Math.min(step,t.duration??0);
      const utc=addSec(t.time.toDate(),off);
      const cell=basis==="UTC"?hhmmss(utc):utcToGps(utc).sow;

      const base=zi?zi.name:t.zuptName;
      const idx=counts[base]??0; counts[base]=idx+1;
      const name=idx===0?base:`${base}_${idx}`;

      return {name,time:cell,lat:zi?.lat??"",lon:zi?.lon??"",h:zi?.height??"",anchors:anc};
    });
  };

  const exportTxt=s=>{
    const rows=buildRows(s);
    const {wn}=utcToGps(s.startedAt.toDate());
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
      <Backdrop open sx={{color:"#fff", zIndex:(t)=>t.zIndex.drawer+1}}>
        <CircularProgress size={80}/>
      </Backdrop>
    );
  }
  if(!sessions.length) return <Typography>No sessions found.</Typography>;

  /* ---------- UI ---------- */
  return(
    <Box sx={{maxWidth:isMobile?"100%":900,mx:"auto",px:isMobile?1:2,pt:2,pb:6}}>
      {/* ─── header ─── */}
      <Stack direction={isMobile?"column":"row"} justifyContent="space-between"
             spacing={isMobile?1:0} mb={1}>
        <Typography variant="h6">Your Sessions</Typography>

        <Stack direction="row" spacing={1} flexWrap="nowrap"
               sx={{width:isMobile?"100%":"auto"}}>
          <Button size="small" variant="contained" color="secondary"
            startIcon={<MergeIcon/>} disabled={selected.size<2}
            onClick={mergeSelected} fullWidth={isMobile}
            sx={{whiteSpace:"nowrap",minWidth:0}}>
            Merge
          </Button>
          <Button size="small" variant="contained" color="error"
            startIcon={<DeleteForeverIcon/>} disabled={selected.size===0}
            onClick={deleteSelected} fullWidth={isMobile}
            sx={{whiteSpace:"nowrap",minWidth:0}}>
            Delete
          </Button>
        </Stack>
      </Stack>

      {/* ─── session list ─── */}
      <Paper variant="outlined">
        <List dense>
          {sessions.map(s=>(
            <React.Fragment key={s.id}>
              <ListItem
                secondaryAction={
                  <Stack direction="row" spacing={0}>
                  <Tooltip title="Rename">
                    <IconButton
                      size={isMobile ? "small" : "medium"}
                      onClick={() => {
                        setEditId(s.id);
                        setEditText(s.sessionTitle || "");
                      }}
                    >
                      <EditIcon sx={isMobile ? { fontSize: 18 } : undefined} />
                    </IconButton>
                  </Tooltip>
                
                  <Tooltip title="View details">
                    <IconButton
                      size={isMobile ? "small" : "medium"}
                      onClick={() => setDetail(s)}
                    >
                      <VisibilityIcon sx={isMobile ? { fontSize: 18 } : undefined} />
                    </IconButton>
                  </Tooltip>
                
                  <Tooltip title="Export TXT">
                    <IconButton
                      size={isMobile ? "small" : "medium"}
                      onClick={() => exportTxt(s)}
                    >
                      <DownloadIcon sx={isMobile ? { fontSize: 18 } : undefined} />
                    </IconButton>
                  </Tooltip>
                </Stack>                
                }
              >
                <ListItemIcon sx={{minWidth:32,pr:0}}>
                  <Checkbox edge="start" size="small"
                    checked={selected.has(s.id)}
                    onChange={(_,ck)=>setSelected(p=>{
                      const n=new Set(p); ck?n.add(s.id):n.delete(s.id); return n;})}
                  />
                </ListItemIcon>

                <ListItemText
                  primary={
                    <>
                      {s.sessionTitle||s.planName}
                      {s.isMerged && (
                        <Typography
                        sx={{
                          ml: 1,
                          color: "primary.main",
                          fontWeight: 600,
                          fontSize: isMobile ? 10 : 12,  // very small on mobile
                          lineHeight: 1
                        }}
                        component="span"
                      >
                        (merged)
                      </Typography>
                      )}
                      {plans[s.planId]===null&&(
                        <Typography component="span" color="error" ml={1}
                        sx={{fontWeight: 600,fontSize: isMobile ? 10 : 12}}>
                          (plan deleted)
                        </Typography>
                      )}
                    </>
                  }
                  secondary={`${shortDate(s.startedAt)} • ZUPTs: ${s.timestamps?.length||0}`}
                  primaryTypographyProps={{fontSize:15,fontWeight:600}}
                  secondaryTypographyProps={{fontSize:10}}
                />
              </ListItem>
              <Divider component="li"/>
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* ─── floating toolbar (copy / email) ─── */}
      {selected.size > 0 && (
        <Paper elevation={6} sx={{
          position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",
          width:{xs:"calc(90% - 32px)",sm:"480px",md:"560px"},
          px:1,py:1,borderRadius:4,zIndex:10,display:"flex",
                                /* glass effect */
                                backgroundColor: "rgba(255,255,255,0.15)",   // translucent “pane”
                                border: "1px solid rgba(255,255,255,0.25)",  // light frosted edge
                                backdropFilter: "blur(5px)",                // stronger blur for depth
                                WebkitBackdropFilter: "blur(5px)",

          alignItems:"center", justifyContent: "center",gap:1,flexWrap:{xs:"wrap",sm:"nowrap"}
        }}>

          <Typography sx={{fontWeight:500}}>{selected.size} selected</Typography>
          <Button startIcon={<ContentCopyIcon/>}
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
          <Button startIcon={<EmailIcon/>}
            onClick={()=>{
              const body=encodeURIComponent(
                [...selected].map(id=>sessions.find(s=>s.id===id))
                  .map(buildSessionText).join("\n\n"));
              window.location.href=`mailto:?subject=${encodeURIComponent("Session Summaries")}&body=${body}`;
            }}
          >
            E-mail
          </Button>
          <IconButton onClick={()=>setSelected(new Set())}><CloseIcon/></IconButton>
        </Paper>
      )}

      {/* ─── full detail dialog (eye icon) ─── */}
      <Dialog open={!!detail} onClose={()=>setDetail(null)}
              maxWidth="md" fullWidth fullScreen={isMobile} scroll="body">
        {detail&&(()=>{            // IIFE
          const wn=utcToGps(detail.startedAt.toDate()).wn;
          const rows=buildRows(detail);
          return(
            <>
              {/* title bar */}
              {isMobile?(
                <AppBar sx={{position:"relative"}} elevation={0} color="transparent">
                  <Toolbar variant="dense">
                    <IconButton edge="start" onClick={()=>setDetail(null)}>
                      <CloseIcon/>
                    </IconButton>
                    <Typography sx={{ml:1,fontWeight:600}}>
                      {detail.sessionTitle||detail.planName}
                    </Typography>
                  </Toolbar>
                </AppBar>
              ):(
                <DialogTitle sx={{pr:6}}>
                  {detail.sessionTitle||detail.planName}
                  <IconButton onClick={()=>setDetail(null)}
                              sx={{position:"absolute",right:8,top:8}}>
                    <CloseIcon/>
                  </IconButton>
                </DialogTitle>
              )}

              <DialogContent dividers>
                <Typography variant="body2">
                  Started: {detail.startedAt.toDate().toLocaleString()}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Ended: {detail.endedAt
                    ? detail.endedAt.toDate().toLocaleString()
                    : "—"}
                </Typography>
                {plans[detail.planId]===null&&(
                  <Typography variant="caption" color="error">
                    Original plan deleted — coordinates unavailable.
                  </Typography>
                )}
                <Divider sx={{my:2}}/>

                {/* control bar */}
                <Stack direction={isMobile?"column":"row"} spacing={2}
                       flexWrap="wrap" mb={2}>
                  <FormControl size="small"
                    sx={{minWidth:180,width:isMobile?"100%":"auto"}}>
                    <InputLabel>Time Basis</InputLabel>
                    <Select value={basis} label="Time Basis"
                            onChange={e=>setBasis(e.target.value)}>
                      <MenuItem value="UTC">UTC (hhmmss)</MenuItem>
                      <MenuItem value="GPS_SOW">GPS (SOW) – week {wn}</MenuItem>
                    </Select>
                  </FormControl>

                  <ToggleButtonGroup size="small" exclusive value={view}
                    onChange={(_,v)=>v&&setView(v)}
                    sx={{width:isMobile?"100%":"auto"}}>
                    <ToggleButton value="ZUPT" sx={{flex:1}}>ZUPT only</ToggleButton>
                    <ToggleButton value="ALL"  sx={{flex:1}}>All stamps</ToggleButton>
                  </ToggleButtonGroup>

                  <Box sx={{width:isMobile?"100%":200,px:2}}>
                    <Typography variant="caption">Variant step (s)</Typography>
                    <Slider value={step} min={0} max={20} step={1}
                            valueLabelDisplay="auto"
                            onChange={(_,v)=>setStep(v)}/>
                  </Box>

                  <Button variant="outlined" fullWidth={isMobile}
                          onClick={()=>exportTxt(detail)}>
                    Export TXT
                  </Button>
                </Stack>

                {/* table */}
                <TableContainer component={Paper} variant="outlined"
                                sx={{maxHeight:340}}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>ZUPT / Stamp</TableCell>
                        <TableCell>{basis==="UTC"
                          ?"UTC hhmmss":`GPS SOW (wn ${wn})`}</TableCell>
                        <TableCell>Lat</TableCell><TableCell>Lon</TableCell>
                        <TableCell>H</TableCell>
                        {["A1","A2","A3","B1","B2","B3"]
                          .map(a=><TableCell key={a}>{a}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.length
                        ? rows.map((r,i)=>(
                            <TableRow key={i}
                              sx={{"&:nth-of-type(even)":{
                                backgroundColor:"action.hover"}}}>
                              <TableCell>{r.name}</TableCell><TableCell>{r.time}</TableCell>
                              <TableCell>{r.lat}</TableCell><TableCell>{r.lon}</TableCell>
                              <TableCell>{r.h}</TableCell>
                              {r.anchors.map((v,j)=><TableCell key={j}>{v}</TableCell>)}
                            </TableRow>
                          ))
                        : <TableRow>
                            <TableCell colSpan={10} align="center">
                              — No matching stamps —
                            </TableCell>
                          </TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
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
