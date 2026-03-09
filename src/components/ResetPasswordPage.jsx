// src/components/ResetPasswordPage.jsx
import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Button, Stack, TextField,
  Avatar, Alert, CircularProgress, InputAdornment, IconButton
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  useSearchParams,
  Link as RouterLink,
} from "react-router-dom";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "../firebase";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [state, setState] = useState("loading"); // loading | form | success | error
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirmPw;

  // Validate the oobCode on mount
  useEffect(() => {
    if (!oobCode) {
      setState("error");
      setError("Invalid password reset link. No reset code found.");
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setState("form");
      })
      .catch((err) => {
        console.error("Reset code invalid:", err);
        setState("error");
        if (err.code === "auth/expired-action-code") {
          setError("This reset link has expired. Please request a new one.");
        } else if (err.code === "auth/invalid-action-code") {
          setError("This reset link is invalid or has already been used.");
        } else {
          setError("Invalid reset link. Please request a new one.");
        }
      });
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordValid || !passwordsMatch) return;

    setLoading(true);
    setError("");

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setState("success");
    } catch (err) {
      console.error("Reset error:", err);
      if (err.code === "auth/expired-action-code") {
        setError("This reset link has expired. Please request a new one.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use at least 8 characters.");
      } else {
        setError(err.message || "Failed to reset password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (state) {
      case "loading":
        return (
          <Stack spacing={2.5} alignItems="center">
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              Validating reset link...
            </Typography>
          </Stack>
        );

      case "error":
        return (
          <Stack spacing={2.5} alignItems="center">
            <Avatar
              sx={{ width: 64, height: 64, bgcolor: "error.main" }}
            >
              <ErrorIcon sx={{ fontSize: 36 }} />
            </Avatar>
            <Typography variant="h6" fontWeight={700} color="error.main">
              Invalid Link
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {error}
            </Typography>
            <Button
              component={RouterLink}
              to="/forgot-password"
              variant="contained"
              fullWidth
            >
              Request New Reset Link
            </Button>
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
          </Stack>
        );

      case "success":
        return (
          <Stack spacing={2.5} alignItems="center">
            <Avatar
              sx={{ width: 64, height: 64, bgcolor: "success.main" }}
            >
              <CheckCircleIcon sx={{ fontSize: 36 }} />
            </Avatar>
            <Typography variant="h5" fontWeight={700} color="success.main">
              Password Updated!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your password has been reset successfully. You can now sign in with your new password.
            </Typography>
            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              fullWidth
            >
              Sign In
            </Button>
          </Stack>
        );

      case "form":
      default:
        return (
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
              Set new password
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Enter a new password for{" "}
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
              onSubmit={handleSubmit}
              sx={{ width: "100%" }}
            >
              <Stack spacing={2}>
                <TextField
                  label="New Password"
                  type={showPassword ? "text" : "password"}
                  size="small"
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  autoFocus
                  helperText={
                    password && !passwordValid
                      ? "Password must be at least 8 characters"
                      : ""
                  }
                  error={password.length > 0 && !passwordValid}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? (
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
                  required
                  autoComplete="new-password"
                  helperText={
                    confirmPw && !passwordsMatch
                      ? "Passwords don't match"
                      : ""
                  }
                  error={confirmPw.length > 0 && !passwordsMatch}
                />

                <Button
                  type="submit"
                  variant="contained"
                  disabled={!passwordValid || !passwordsMatch || loading}
                  startIcon={
                    loading ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : null
                  }
                  size="large"
                >
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </Stack>
            </Box>
          </Stack>
        );
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
        {renderContent()}
      </Paper>
    </Box>
  );
}
