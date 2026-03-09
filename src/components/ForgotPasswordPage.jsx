// src/components/ForgotPasswordPage.jsx
import React, { useState } from "react";
import {
  Box, Paper, Typography, Button, Stack, TextField,
  Avatar, Alert, CircularProgress
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmailIcon from "@mui/icons-material/Email";
import { Link as RouterLink } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError("");
    setLoading(true);

    try {
      const sendPasswordReset = httpsCallable(functions, "sendPasswordReset");
      await sendPasswordReset({ email: email.trim() });
      setSent(true);
    } catch (err) {
      console.error("Reset error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)"
            : "linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 50%, #f3f4f6 100%)",
      }}
    >
      <Paper
        elevation={3}
        sx={{ p: 4, maxWidth: 400, width: "100%", mx: 2, textAlign: "center" }}
      >
        {sent ? (
          /* ── Success State ── */
          <Stack spacing={2.5} alignItems="center">
            <Avatar
              sx={{ width: 64, height: 64, bgcolor: "success.main" }}
            >
              <CheckCircleIcon sx={{ fontSize: 36 }} />
            </Avatar>

            <Typography variant="h5" fontWeight={700} color="success.main">
              Check your email
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.6 }}
            >
              If an account exists with{" "}
              <Typography
                component="span"
                variant="body2"
                fontWeight={600}
                color="text.primary"
              >
                {email}
              </Typography>
              , we've sent a password reset link. Check your inbox and spam folder.
            </Typography>

            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              fullWidth
            >
              Back to Sign In
            </Button>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                cursor: "pointer",
                "&:hover": { textDecoration: "underline" },
              }}
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Try a different email
            </Typography>
          </Stack>
        ) : (
          /* ── Form State ── */
          <Stack spacing={2.5} alignItems="center">
            <Avatar
              sx={{ width: 56, height: 56, bgcolor: "primary.main" }}
            >
              <LockResetIcon sx={{ fontSize: 30 }} />
            </Avatar>

            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ color: "primary.main" }}
            >
              Reset your password
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Enter your email and we'll send you a link to reset your password.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ width: "100%" }}>
                {error}
              </Alert>
            )}

            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ width: "100%" }}
            >
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  type="email"
                  size="small"
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={
                    loading ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <EmailIcon />
                    )
                  }
                  disabled={!email.trim() || loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </Stack>
            </Box>

            <Typography variant="body2">
              <Typography
                component={RouterLink}
                to="/login"
                variant="body2"
                sx={{
                  color: "text.secondary",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                ← Back to sign in
              </Typography>
            </Typography>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
