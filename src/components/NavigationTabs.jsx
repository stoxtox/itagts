// src/components/NavigationTabs.jsx
import React, { useEffect, useState } from "react";
import {
  Box, Paper, Stack, Typography, Avatar, IconButton,
  Button, Menu, MenuItem, Divider, ListItemIcon, Backdrop,
  CircularProgress
} from "@mui/material";
import MoreVertIcon          from "@mui/icons-material/MoreVert";
import DirectionsRunIcon     from "@mui/icons-material/DirectionsRun";
import BuildIcon             from "@mui/icons-material/Build";
import DescriptionIcon       from "@mui/icons-material/Description";
import HistoryIcon           from "@mui/icons-material/History";
import LogoutIcon            from "@mui/icons-material/Logout";

import PlanRunner   from "./PlanRunner";
import PlanBuilder  from "./PlanBuilder";
import PlansPage    from "./PlansPage";
import SessionsPage from "./SessionsPage";
import LoginPage    from "./LoginPage";

import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signOut, onAuthStateChanged
} from "firebase/auth";

import {
  useNavigate, useLocation,
  Routes, Route, Navigate
} from "react-router-dom";

/* ---------- helpers ---------- */
const viewFromPath = (pathname = "/") => {
  const slug = pathname.split("/")[1] || "";
  return ["runner", "creator", "plans", "sessions"].includes(slug)
    ? slug
    : "runner";
};
const pathFromView = (view) => `/${view}`;

const VIEWS = {
  runner  : { label: "Run Timestamp",  icon: DirectionsRunIcon },
  creator : { label: "Plan Creator",   icon: BuildIcon         },
  plans   : { label: "Your Plans",     icon: DescriptionIcon   },
  sessions: { label: "Saved Sessions", icon: HistoryIcon       }
};

export default function NavigationTabs() {
  /* ---------- auth ---------- */
  const auth      = getAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [user,        setUser]        = useState(null);
  const [authLoaded,  setAuthLoaded]  = useState(false); // ✅ track first auth result

  // listen once; mark authLoaded after first callback fires
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoaded(true);
    });
    return unsub;
  }, [auth]);

  /* jump to /runner immediately after a fresh login */
  useEffect(() => {
    if (user && location.pathname === "/login") {
      navigate("/runner", { replace: true });
    }
  }, [user, location.pathname, navigate]);

  /* login / logout helpers */
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const login  = () => signInWithPopup(auth, provider);
  const logout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  /* ---------- active view ---------- */
  const [activeView, setActiveView] = useState(() =>
    viewFromPath(location.pathname)
  );
  useEffect(() => {
    const next = viewFromPath(location.pathname);
    if (next !== activeView) setActiveView(next);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = (view) => {
    setActiveView(view);
    navigate(pathFromView(view), { replace: true });
    closeMenu();
  };

  /* ---------- menu ---------- */
  const [menuAnchor, setMenuAnchor] = useState(null);
  const openMenu  = (e) => setMenuAnchor(e.currentTarget);
  const closeMenu = ()  => setMenuAnchor(null);

  /* ---------- body component ---------- */
  const body = {
    runner   : <PlanRunner />,
    creator  : <PlanBuilder />,
    plans    : <PlansPage />,
    sessions : <SessionsPage />
  }[activeView];

  /* ---------- render ---------- */

  // 1️⃣  STILL LOADING AUTH? ➜ show a sleek backdrop loader
  if (!authLoaded) {
    return (
      <Backdrop open sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 1 }}>
        <CircularProgress size={80} />
      </Backdrop>
    );
  }

  // 2️⃣  NO USER (after auth resolved) ➜ normal /login routing
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={login} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 3️⃣  AUTHENTICATED ➜ main UI
  const { label, icon: HeaderIcon } = VIEWS[activeView];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f3f4f6", py: 5 }}>
      <Paper elevation={3} sx={{ maxWidth: 860, mx: "auto", p: 3, borderRadius: 2 }}>
        {/* header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <HeaderIcon />
            <Typography variant="h5" fontWeight="bold">{label}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar src={user.photoURL} alt={user.displayName} />
            <IconButton onClick={openMenu}><MoreVertIcon /></IconButton>

            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
              <MenuItem disabled>{user.email}</MenuItem>
              <Divider />
              {Object.entries(VIEWS).map(([key, { label, icon: Icon }]) => (
                <MenuItem key={key} onClick={() => jump(key)}>
                  <ListItemIcon><Icon fontSize="small" /></ListItemIcon>
                  {label}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem onClick={logout}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>

        {/* page body */}
        <Box sx={{ mt: 2 }}>{body}</Box>
      </Paper>
    </Box>
  );
}
