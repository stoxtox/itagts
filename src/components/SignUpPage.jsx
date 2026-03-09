// src/components/SignUpPage.jsx
import React, { useState } from "react";
import {
  Box, Paper, Typography, Button, Stack, TextField,
  Avatar, InputAdornment, IconButton, Alert, CircularProgress
} from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";
import GoogleIcon from "@mui/icons-material/Google";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export default function SignUpPage({ onGoogleSignup, loading: googleLoading }) {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const formValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    passwordValid &&
    passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValid) return;

    setError("");
    setLoading(true);

    try {
      const sendOTP = httpsCallable(functions, "sendOTP");
      await sendOTP({ email: email.trim(), name: name.trim() });

      // Navigate to OTP verification — pass credentials in router state (in-memory only)
      navigate("/verify-email", {
        state: {
          email: email.trim(),
          name: name.trim(),
          password,
        },
      });
    } catch (err) {
      console.error("sendOTP error:", err);
      const message = err?.message || "Failed to send verification code.";
      setError(message);
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
        py: 4,
      }}
    >
      <Paper
        elevation={3}
        sx={{ p: 4, maxWidth: 400, width: "100%", mx: 2, textAlign: "center" }}
      >
        <Stack spacing={2.5} alignItems="center">
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: "primary.main",
            }}
          >
            <TimerIcon sx={{ fontSize: 32 }} />
          </Avatar>

          <Typography
            variant="h5"
            fontWeight={700}
            sx={{ color: "primary.main" }}
          >
            Timestamp Portal
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
            Create your account
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: "100%" }}>
              {error}
            </Alert>
          )}

          {/* Sign Up Form */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ width: "100%" }}
            aria-label="Sign up form"
          >
            <Stack spacing={2}>
              <TextField
                label="Full Name"
                size="small"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />

              <TextField
                label="Email"
                type="email"
                size="small"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                size="small"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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
                          aria-label={showPassword ? "Hide password" : "Show password"}
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
                label="Confirm Password"
                type="password"
                size="small"
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                helperText={
                  confirmPassword && !passwordsMatch
                    ? "Passwords don't match"
                    : ""
                }
                error={confirmPassword.length > 0 && !passwordsMatch}
              />

              <Button
                type="submit"
                variant="contained"
                startIcon={
                  loading ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <PersonAddIcon />
                  )
                }
                disabled={!formValid || loading || googleLoading}
              >
                {loading ? "Sending code..." : "Create Account"}
              </Button>
            </Stack>
          </Box>

          <Typography variant="caption" color="text.secondary">
            We'll send a verification code to your email
          </Typography>

          {/* Google Sign Up */}
          {onGoogleSignup && (
            <>
              <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
                <Typography variant="caption" color="text.secondary">or</Typography>
                <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
              </Box>

              <Button
                variant="outlined"
                startIcon={<GoogleIcon />}
                onClick={onGoogleSignup}
                disabled={loading || googleLoading}
                fullWidth
              >
                Sign up with Google
              </Button>
            </>
          )}

          {/* Link to login */}
          <Typography variant="body2" color="text.secondary">
            Already have an account?{" "}
            <Typography
              component={RouterLink}
              to="/login"
              variant="body2"
              sx={{
                color: "primary.main",
                fontWeight: 600,
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Sign in
            </Typography>
          </Typography>

          {/* Legal links */}
          <Typography variant="caption" color="text.disabled" sx={{ mt: 1, lineHeight: 1.4 }}>
            By creating an account, you agree to our{" "}
            <Typography
              component={RouterLink}
              to="/terms"
              variant="caption"
              sx={{ color: "text.secondary", textDecoration: "underline" }}
            >
              Terms of Service
            </Typography>
            {" "}and{" "}
            <Typography
              component={RouterLink}
              to="/privacy"
              variant="caption"
              sx={{ color: "text.secondary", textDecoration: "underline" }}
            >
              Privacy Policy
            </Typography>
            .
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
