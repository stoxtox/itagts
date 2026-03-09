// src/components/SettingsPage.jsx
import React, { useState, useEffect } from "react";
import {
  Box, Typography, Stack, TextField, Button, Avatar, Switch, Paper, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, Divider, InputAdornment, IconButton
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import PaletteIcon from "@mui/icons-material/Palette";
import GavelIcon from "@mui/icons-material/Gavel";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase";
import { useThemeMode } from "../contexts/ThemeContext";
import { Link as RouterLink, useNavigate } from "react-router-dom";

/* ── Reusable card wrapper ── */
const SettingsCard = ({ icon, title, danger, children, sx, ...props }) => (
  <Paper
    elevation={0}
    sx={{
      p: { xs: 2, sm: 2.5 },
      borderRadius: 3,
      border: "1px solid",
      borderColor: danger ? "error.main" : "divider",
      ...(danger && {
        bgcolor: (t) =>
          t.palette.mode === "dark"
            ? "rgba(239,68,68,0.06)"
            : "rgba(239,68,68,0.03)",
      }),
      ...sx,
    }}
    {...props}
  >
    {title && (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        {icon}
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
      </Stack>
    )}
    {children}
  </Paper>
);

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const { mode, toggleMode } = useThemeMode();
  const isPasswordUser = user?.providerData?.some(
    (p) => p.providerId === "password"
  );
  const isGoogleUser = user?.providerData?.some(
    (p) => p.providerId === "google.com"
  );

  /* ── Profile ── */
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [editingName, setEditingName] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  useEffect(() => {
    setDisplayName(user?.displayName || "");
  }, [user?.displayName]);

  const saveProfile = async () => {
    if (!displayName.trim()) return;
    setProfileSaving(true);
    setProfileMsg("");
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await updateDoc(doc(db, "users", user.uid), {
        name: displayName.trim(),
      });
      setProfileMsg("Profile updated.");
      setEditingName(false);
    } catch (err) {
      console.error(err);
      setProfileMsg(err.message || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const cancelEditName = () => {
    setDisplayName(user?.displayName || "");
    setEditingName(false);
    setProfileMsg("");
  };

  /* ── Member since ── */
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;

  /* ── Initials for avatar ── */
  const initials = (user?.displayName || user?.email || "U")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  /* ── Change Password ── */
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });

  const pwValid =
    newPw.length >= 8 && newPw === confirmPw && currentPw.length > 0;

  const changePassword = async () => {
    if (!pwValid) return;
    setPwSaving(true);
    setPwMsg({ type: "", text: "" });
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwMsg({ type: "success", text: "Password changed successfully." });
    } catch (err) {
      console.error(err);
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setPwMsg({ type: "error", text: "Current password is incorrect." });
      } else {
        setPwMsg({
          type: "error",
          text: err.message || "Failed to change password.",
        });
      }
    } finally {
      setPwSaving(false);
    }
  };

  /* ── Delete Account ── */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const canDelete =
    deleteConfirmEmail.toLowerCase() === user?.email?.toLowerCase() &&
    (isPasswordUser ? deletePw.length > 0 : true);

  const handleDeleteAccount = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      // Reauthenticate
      if (isPasswordUser) {
        const credential = EmailAuthProvider.credential(user.email, deletePw);
        await reauthenticateWithCredential(user, credential);
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithPopup(auth, provider);
      }

      // Delete all user data via Cloud Function
      const deleteUserData = httpsCallable(functions, "deleteUserData");
      await deleteUserData();

      // Redirect to login
      navigate("/login", { replace: true });
    } catch (err) {
      console.error(err);
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setDeleteError("Incorrect password.");
      } else if (err.code === "auth/popup-blocked") {
        setDeleteError(
          "Popup was blocked. Please allow popups and try again."
        );
      } else {
        setDeleteError(err.message || "Failed to delete account.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      {/* ── Back button ── */}
      <Box sx={{ mb: 1 }}>
        <IconButton
          onClick={() => navigate(-1)}
          size="small"
          aria-label="Go back"
          sx={{ ml: -1 }}
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>

      {/* ── Profile Hero Header ── */}
      <Box
        sx={{
          textAlign: "center",
          pb: 3,
          mb: 2.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {/* Large avatar with indigo ring */}
        <Avatar
          src={user?.photoURL}
          alt={user?.displayName}
          sx={{
            width: 80,
            height: 80,
            mx: "auto",
            mb: 1.5,
            border: "3px solid",
            borderColor: "primary.main",
            bgcolor: user?.photoURL ? undefined : "primary.main",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          {!user?.photoURL && initials}
        </Avatar>

        {/* Name — editable inline */}
        {!editingName ? (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="center"
            spacing={0.5}
          >
            <Typography variant="h6" fontWeight={700}>
              {user?.displayName || "No name set"}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setEditingName(true)}
              aria-label="Edit display name"
              sx={{ color: "text.secondary" }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : (
          <Stack
            spacing={1.5}
            alignItems="center"
            sx={{ maxWidth: 280, mx: "auto" }}
          >
            <TextField
              size="small"
              fullWidth
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              label="Display Name"
              autoFocus
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                size="small"
                onClick={saveProfile}
                disabled={
                  profileSaving ||
                  !displayName.trim() ||
                  displayName.trim() === (user?.displayName || "")
                }
                startIcon={
                  profileSaving ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : null
                }
              >
                Save
              </Button>
              <Button
                size="small"
                onClick={cancelEditName}
                disabled={profileSaving}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        )}

        {/* Success message */}
        {profileMsg && (
          <Alert
            severity="success"
            icon={<CheckCircleIcon fontSize="small" />}
            sx={{ py: 0, mt: 1, maxWidth: 300, mx: "auto" }}
          >
            {profileMsg}
          </Alert>
        )}

        {/* Email */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: editingName ? 0 : 0.5 }}
        >
          {user?.email}
        </Typography>

        {/* Chips: Member since + Auth provider */}
        <Stack
          direction="row"
          justifyContent="center"
          spacing={1}
          sx={{ mt: 1.5 }}
        >
          {memberSince && (
            <Chip
              label={`Member since ${memberSince}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: "0.7rem" }}
            />
          )}
          {isGoogleUser && (
            <Chip
              label="Google"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: "0.7rem" }}
            />
          )}
          {isPasswordUser && (
            <Chip
              label="Email"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: "0.7rem" }}
            />
          )}
        </Stack>
      </Box>

      {/* ── Card sections ── */}
      <Stack spacing={2}>
        {/* ── Security Card (password users only) ── */}
        {isPasswordUser && (
          <SettingsCard
            icon={<LockIcon color="primary" />}
            title="Change Password"
          >
            <Stack spacing={2}>
              <TextField
                label="Current Password"
                type={showCurrentPw ? "text" : "password"}
                size="small"
                fullWidth
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          edge="end"
                          aria-label={
                            showCurrentPw ? "Hide password" : "Show password"
                          }
                        >
                          {showCurrentPw ? (
                            <VisibilityOff fontSize="small" />
                          ) : (
                            <Visibility fontSize="small" />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="New Password"
                type={showNewPw ? "text" : "password"}
                size="small"
                fullWidth
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                helperText={
                  newPw && newPw.length < 8
                    ? "Must be at least 8 characters"
                    : ""
                }
                error={newPw.length > 0 && newPw.length < 8}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowNewPw(!showNewPw)}
                          edge="end"
                          aria-label={
                            showNewPw ? "Hide password" : "Show password"
                          }
                        >
                          {showNewPw ? (
                            <VisibilityOff fontSize="small" />
                          ) : (
                            <Visibility fontSize="small" />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Confirm New Password"
                type="password"
                size="small"
                fullWidth
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                helperText={
                  confirmPw && newPw !== confirmPw
                    ? "Passwords don't match"
                    : ""
                }
                error={confirmPw.length > 0 && newPw !== confirmPw}
              />
              <Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={changePassword}
                  disabled={!pwValid || pwSaving}
                  startIcon={
                    pwSaving ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : null
                  }
                >
                  Change Password
                </Button>
              </Box>
              {pwMsg.text && (
                <Alert severity={pwMsg.type} sx={{ py: 0 }}>
                  {pwMsg.text}
                </Alert>
              )}
            </Stack>
          </SettingsCard>
        )}

        {/* ── Appearance Card ── */}
        <SettingsCard
          icon={<PaletteIcon color="primary" />}
          title="Appearance"
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {mode === "dark" ? (
                <DarkModeIcon fontSize="small" color="action" />
              ) : (
                <LightModeIcon fontSize="small" color="action" />
              )}
              <Typography variant="body2">
                {mode === "dark" ? "Dark Mode" : "Light Mode"}
              </Typography>
            </Stack>
            <Switch
              checked={mode === "dark"}
              onChange={toggleMode}
              inputProps={{ "aria-label": "Toggle dark mode" }}
            />
          </Stack>
        </SettingsCard>

        {/* ── Legal Card ── */}
        <SettingsCard icon={<GavelIcon color="primary" />} title="Legal">
          <Stack spacing={0}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              component={RouterLink}
              to="/privacy"
              sx={{
                py: 1.5,
                px: 1,
                textDecoration: "none",
                borderRadius: 1,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Typography variant="body2" color="text.primary">
                Privacy Policy
              </Typography>
              <ChevronRightIcon color="action" fontSize="small" />
            </Stack>
            <Divider />
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              component={RouterLink}
              to="/terms"
              sx={{
                py: 1.5,
                px: 1,
                textDecoration: "none",
                borderRadius: 1,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Typography variant="body2" color="text.primary">
                Terms of Service
              </Typography>
              <ChevronRightIcon color="action" fontSize="small" />
            </Stack>
          </Stack>
        </SettingsCard>

        {/* ── Danger Zone Card ── */}
        <SettingsCard
          icon={<DeleteForeverIcon color="error" />}
          title="Danger Zone"
          danger
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Permanently delete your account and all associated data. This
            action cannot be undone.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={() => {
              setDeleteOpen(true);
              setDeleteConfirmEmail("");
              setDeletePw("");
              setDeleteError("");
            }}
          >
            Delete Account
          </Button>
        </SettingsCard>
      </Stack>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: "error.main" }}>
          Delete Account
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="error">
              This will permanently delete your account, all sessions, and all
              plans. This action cannot be undone.
            </Alert>
            <Typography variant="body2">
              Type <strong>{user?.email}</strong> to confirm:
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder={user?.email}
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              autoComplete="off"
            />
            {isPasswordUser && (
              <TextField
                label="Password"
                type="password"
                size="small"
                fullWidth
                value={deletePw}
                onChange={(e) => setDeletePw(e.target.value)}
                autoComplete="current-password"
              />
            )}
            {deleteError && (
              <Alert severity="error" sx={{ py: 0 }}>
                {deleteError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteAccount}
            disabled={!canDelete || deleting}
            startIcon={
              deleting ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            {deleting ? "Deleting..." : "Delete My Account"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
