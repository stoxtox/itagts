// src/components/NavigationTabs.jsx
import React, { useEffect, useState, Suspense, lazy } from "react";
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
  Alert,
  Tooltip,
  BottomNavigation,
  BottomNavigationAction,
  Skeleton
} from "@mui/material";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import BuildIcon         from "@mui/icons-material/Build";
import DescriptionIcon   from "@mui/icons-material/Description";
import HistoryIcon       from "@mui/icons-material/History";
import LogoutIcon        from "@mui/icons-material/Logout";
import DarkModeIcon      from "@mui/icons-material/DarkMode";
import LightModeIcon     from "@mui/icons-material/LightMode";
import NewReleasesIcon   from "@mui/icons-material/NewReleases";

import { useThemeMode } from "../contexts/ThemeContext";
import WhatsNewDialog from "./WhatsNewDialog";
import LoginPage from "./LoginPage";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

/* Lazy-loaded route components (code splitting) */
const PlanRunner   = lazy(() => import("./PlanRunner"));
const PlanBuilder  = lazy(() => import("./PlanBuilder"));
const PlansPage    = lazy(() => import("./PlansPage"));
const SessionsPage = lazy(() => import("./SessionsPage"));

/* ---------- helpers ---------- */
const viewFromPath = (pathname = "/") => {
  const slug = pathname.split("/")[1] || "";
  return ["runner", "creator", "plans", "sessions"].includes(slug)
    ? slug
    : "runner";
};
const pathFromView = (view) => `/${view}`;

const VIEWS = {
  runner:  { label: "Runner",   icon: DirectionsRunIcon },
  creator: { label: "Creator",  icon: BuildIcon         },
  plans:   { label: "Plans",    icon: DescriptionIcon   },
  sessions:{ label: "Sessions", icon: HistoryIcon       }
};

const VIEW_KEYS = ["runner", "creator", "plans", "sessions"];

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

  // EMAIL/PASSWORD LOGIN
  const emailLogin = async (email, password) => {
    try {
      setLoading(true);
      let res;
      try {
        res = await signInWithEmailAndPassword(auth, email, password);
      } catch (signInErr) {
        if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential") {
          res = await createUserWithEmailAndPassword(auth, email, password);
          const uid = res.user.uid;
          const ref = doc(db, "users", uid);
          await setDoc(ref, {
            uid,
            name: email.split("@")[0],
            email,
            createdAt: new Date().toISOString()
          });
          return;
        }
        throw signInErr;
      }
      const exists = await userDocExists(res.user.uid);
      if (!exists) {
        const uid = res.user.uid;
        const ref = doc(db, "users", uid);
        await setDoc(ref, {
          uid,
          name: email.split("@")[0],
          email,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(err);
      setAuthError(err.message || "Email login failed.");
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
  };

  // dark mode toggle
  const { mode, toggleMode } = useThemeMode();

  // profile menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const openMenu  = (e) => setMenuAnchor(e.currentTarget);
  const closeMenu = ()  => setMenuAnchor(null);

  // What's New dialog
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  // hide bottom nav during active runner session
  const [sessionActive, setSessionActive] = useState(false);

  // choose body
  const body = {
    runner:   <PlanRunner onSessionActive={setSessionActive} />,
    creator:  <PlanBuilder />,
    plans:    <PlansPage />,
    sessions: <SessionsPage />
  }[activeView];

  // RENDER — loading
  if (!authLoaded) {
    return (
      <Backdrop open sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 1 }}>
        <CircularProgress size={80} />
      </Backdrop>
    );
  }

  // RENDER — not logged in
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
                onEmailLogin={emailLogin}
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

  // RENDER — logged in
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: sessionActive ? 0 : "80px", transition: "padding-bottom 0.3s ease" }}>
      {/* top header bar */}
      <Paper
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          px: 2.5,
          py: 1.5,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center"
               sx={{ maxWidth: 860, mx: "auto" }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: "primary.main" }}>
            Timestamp Portal
          </Typography>

          <IconButton onClick={openMenu} size="small" sx={{ p: 0.5 }}>
            <Avatar
              src={user.photoURL}
              alt={user.displayName}
              sx={{
                width: 34, height: 34,
                bgcolor: user.photoURL ? undefined : "primary.main",
                fontSize: 14, fontWeight: 700,
              }}
            >
              {!user.photoURL && (user.displayName || user.email || "U")
                .split(/[\s@]/)
                .filter(Boolean)
                .slice(0, 2)
                .map(w => w[0].toUpperCase())
                .join("")}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={closeMenu}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          >
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={toggleMode}>
              <ListItemIcon>
                {mode === "dark" ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </ListItemIcon>
              {mode === "dark" ? "Light mode" : "Dark mode"}
            </MenuItem>
            <MenuItem onClick={() => { closeMenu(); setWhatsNewOpen(true); }}>
              <ListItemIcon><NewReleasesIcon fontSize="small" /></ListItemIcon>
              What's New
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { closeMenu(); logout(); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
          <WhatsNewDialog open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
        </Stack>
      </Paper>

      {/* main content */}
      <Box sx={{ maxWidth: 860, mx: "auto", px: 2, pt: 2.5 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Suspense fallback={
            <Stack spacing={2} sx={{ py: 2 }}>
              <Skeleton variant="rounded" height={80} />
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={44} />
            </Stack>
          }>
            {body}
          </Suspense>
        </Paper>
      </Box>

      {/* bottom tab bar — hidden during active session */}
      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          bottom: sessionActive ? -80 : 0,
          left: 0,
          right: 0,
          zIndex: 10,
          borderTop: "1px solid",
          borderColor: "divider",
          transition: "bottom 0.3s ease",
          pointerEvents: sessionActive ? "none" : "auto",
        }}
      >
        <BottomNavigation
          value={VIEW_KEYS.indexOf(activeView)}
          onChange={(_, newIdx) => jump(VIEW_KEYS[newIdx])}
          showLabels
          sx={{
            maxWidth: 860,
            mx: "auto",
            height: 64,
            "& .MuiBottomNavigationAction-root": {
              minWidth: 0,
              py: 1,
              color: "text.secondary",
              "&.Mui-selected": {
                color: "primary.main",
              },
            },
            "& .MuiBottomNavigationAction-label": {
              fontSize: "0.7rem",
              fontWeight: 600,
              "&.Mui-selected": {
                fontSize: "0.7rem",
              },
            },
          }}
        >
          {VIEW_KEYS.map((key) => {
            const { label, icon: Icon } = VIEWS[key];
            return (
              <BottomNavigationAction
                key={key}
                label={label}
                icon={<Icon />}
              />
            );
          })}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
