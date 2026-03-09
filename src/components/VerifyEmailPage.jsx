// src/components/VerifyEmailPage.jsx
import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Button, Stack, TextField,
  Avatar, Alert, CircularProgress
} from "@mui/material";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  useNavigate,
  useLocation,
  Link as RouterLink,
} from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, functions } from "../firebase";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Read signup data from router state
  const { email, name, password } = location.state || {};

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Redirect if no state (user navigated directly)
  useEffect(() => {
    if (!email || !password) {
      navigate("/signup", { replace: true });
    }
  }, [email, password, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;

    setError("");
    setLoading(true);

    try {
      // 1. Verify the OTP
      const verifyOTP = httpsCallable(functions, "verifyOTP");
      await verifyOTP({ email, code: code.trim() });

      // 2. Create the Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 3. Set display name
      await updateProfile(cred.user, { displayName: name });

      // 4. Create Firestore user doc
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        name,
        email,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      });

      setSuccess(true);
      // Auth state listener in NavigationTabs will auto-redirect to app

    } catch (err) {
      console.error("Verify error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Please sign in instead.");
      } else {
        const message = err?.message || "Verification failed. Please try again.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setError("");

    try {
      const sendOTP = httpsCallable(functions, "sendOTP");
      await sendOTP({ email, name });
      setResendCooldown(60);
    } catch (err) {
      console.error("Resend error:", err);
      setError(err?.message || "Failed to resend code.");
    }
  };

  if (!email) return null;

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
        {success ? (
          /* ── Success State ── */
          <Stack spacing={2.5} alignItems="center">
            <Avatar
              sx={{ width: 64, height: 64, bgcolor: "success.main" }}
            >
              <CheckCircleIcon sx={{ fontSize: 36 }} />
            </Avatar>
            <Typography variant="h5" fontWeight={700} color="success.main">
              Account Created!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Welcome, {name}! Redirecting you to the app...
            </Typography>
            <CircularProgress size={24} />
          </Stack>
        ) : (
          /* ── Verification Form ── */
          <Stack spacing={2.5} alignItems="center">
            <Avatar
              sx={{ width: 56, height: 56, bgcolor: "primary.main" }}
            >
              <MarkEmailReadIcon sx={{ fontSize: 30 }} />
            </Avatar>

            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ color: "primary.main" }}
            >
              Verify your email
            </Typography>

            <Typography variant="body2" color="text.secondary">
              We sent a 6-digit code to{" "}
              <Typography
                component="span"
                variant="body2"
                fontWeight={600}
                color="text.primary"
              >
                {email}
              </Typography>
            </Typography>

            {error && (
              <Alert severity="error" sx={{ width: "100%" }}>
                {error}
              </Alert>
            )}

            <Box
              component="form"
              onSubmit={handleVerify}
              sx={{ width: "100%" }}
            >
              <Stack spacing={2}>
                <TextField
                  placeholder="000000"
                  size="medium"
                  fullWidth
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(val);
                  }}
                  slotProps={{
                    input: {
                      sx: {
                        textAlign: "center",
                        fontSize: "1.8rem",
                        fontWeight: 700,
                        letterSpacing: "0.4em",
                        fontFamily: "monospace",
                        py: 1,
                      },
                    },
                    htmlInput: {
                      maxLength: 6,
                      inputMode: "numeric",
                      autoComplete: "one-time-code",
                      style: { textAlign: "center" },
                    },
                  }}
                  autoFocus
                />

                <Button
                  type="submit"
                  variant="contained"
                  disabled={code.length !== 6 || loading}
                  startIcon={
                    loading ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : null
                  }
                  size="large"
                >
                  {loading ? "Verifying..." : "Verify & Create Account"}
                </Button>
              </Stack>
            </Box>

            {/* Resend */}
            <Typography variant="body2" color="text.secondary">
              Didn't receive the code?{" "}
              {resendCooldown > 0 ? (
                <Typography
                  component="span"
                  variant="body2"
                  color="text.disabled"
                >
                  Resend in {resendCooldown}s
                </Typography>
              ) : (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    color: "primary.main",
                    fontWeight: 600,
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" },
                  }}
                  onClick={handleResend}
                >
                  Resend code
                </Typography>
              )}
            </Typography>

            {/* Back link */}
            <Typography variant="body2">
              <Typography
                component={RouterLink}
                to="/signup"
                variant="body2"
                sx={{
                  color: "text.secondary",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                ← Back to sign up
              </Typography>
            </Typography>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
