// src/components/NavigationTabs.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  Backdrop,
  CircularProgress,
  Snackbar,
  Alert
} from "@mui/material";
import MoreVertIcon      from "@mui/icons-material/MoreVert";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import BuildIcon         from "@mui/icons-material/Build";
import DescriptionIcon   from "@mui/icons-material/Description";
import HistoryIcon       from "@mui/icons-material/History";
import LogoutIcon        from "@mui/icons-material/Logout";

import PlanRunner   from "./PlanRunner";
import PlanBuilder  from "./PlanBuilder";
import PlansPage    from "./PlansPage";
import SessionsPage from "./SessionsPage";
import LoginPage    from "./LoginPage";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

import {
  useNavigate,
  useLocation,
  Routes,
  Route,
  Navigate
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
  runner:  { label: "Run Timestamp",  icon: DirectionsRunIcon },
  creator: { label: "Plan Creator",   icon: BuildIcon         },
  plans:   { label: "Your Plans",     icon: DescriptionIcon   },
  sessions:{ label: "Saved Sessions", icon: HistoryIcon       }
};

export default function NavigationTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  // auth + UI state
  const [user,       setUser]       = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [authError,  setAuthError]  = useState("");

  // monitor auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoaded(true);
    });
    return unsub;
  }, []);

  // google provider
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  // check if /users/{uid} exists
  const userDocExists = async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists();
  };

  // LOGIN
  const login = async () => {
    try {
      setLoading(true);
      const res = await signInWithPopup(auth, provider);
      const exists = await userDocExists(res.user.uid);
      if (!exists) {
        await signOut(auth);
        throw new Error("No account found. Please sign up first.");
      }
    } catch (err) {
      // ignore benign popup cancellations
      if (
        err.code !== "auth/cancelled-popup-request" &&
        err.code !== "auth/popup-closed-by-user"
      ) {
        console.error(err);
        setAuthError(err.message || "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  // SIGN UP
  const signup = async () => {
    try {
      setLoading(true);
      const res  = await signInWithPopup(auth, provider);
      const uid  = res.user.uid;
      const ref  = doc(db, "users", uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        await signOut(auth);
        throw new Error("Account exists. Please choose Login.");
      }
      await setDoc(ref, {
        uid,
        name:      res.user.displayName,
        email:     res.user.email,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      if (
        err.code !== "auth/cancelled-popup-request" &&
        err.code !== "auth/popup-closed-by-user"
      ) {
        console.error(err);
        setAuthError(err.message || "Sign-up failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  // LOGOUT
  const logout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  // routing state
  const [activeView, setActiveView] = useState(() =>
    viewFromPath(location.pathname)
  );
  useEffect(() => {
    const next = viewFromPath(location.pathname);
    if (next !== activeView) setActiveView(next);
  }, [location.pathname]);

  const jump = (view) => {
    setActiveView(view);
    navigate(pathFromView(view), { replace: true });
    closeMenu();
  };

  // menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const openMenu  = (e) => setMenuAnchor(e.currentTarget);
  const closeMenu = ()  => setMenuAnchor(null);

  // choose body
  const body = {
    runner:   <PlanRunner />,
    creator:  <PlanBuilder />,
    plans:    <PlansPage />,
    sessions: <SessionsPage />
  }[activeView];

  // RENDER
  if (!authLoaded) {
    return (
      <Backdrop open sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 1 }}>
        <CircularProgress size={80} />
      </Backdrop>
    );
  }

  if (!user) {
    return (
      <>
        <Routes>
          <Route
            path="/login"
            element={
              <LoginPage
                onLogin={login}
                onSignup={signup}
                loading={loading}
              />
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Snackbar
          open={!!authError}
          autoHideDuration={6000}
          onClose={() => setAuthError("")}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity="error"
            onClose={() => setAuthError("")}
            sx={{ width: "100%" }}
          >
            {authError}
          </Alert>
        </Snackbar>
      </>
    );
  }

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

        {/* body */}
        <Box sx={{ mt: 2 }}>{body}</Box>
      </Paper>
    </Box>
  );
}
