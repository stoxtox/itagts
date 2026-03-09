// src/components/LoginPage.jsx
import React, { useState } from "react";
import {
  Box, Paper, Typography, Button, Stack,
  TextField, Avatar, InputAdornment, IconButton
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import EmailIcon from "@mui/icons-material/Email";
import TimerIcon from "@mui/icons-material/Timer";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Link as RouterLink } from "react-router-dom";

export default function LoginPage({ onLogin, onEmailLogin, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailLogin = (e) => {
    e.preventDefault();
    if (email && password) onEmailLogin(email, password);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: (t) => t.palette.mode === "dark"
          ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)"
          : "linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 50%, #f3f4f6 100%)",
      }}
    >
      <Paper
        elevation={3}
        sx={{ p: 4, maxWidth: 360, width: "100%", mx: 2, textAlign: "center" }}
      >
        <Stack spacing={3} alignItems="center">
          <Avatar sx={{
            width: 56, height: 56,
            bgcolor: "primary.main",
            mb: -1,
          }}>
            <TimerIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Typography variant="h5" fontWeight={700} sx={{ color: "primary.main" }}>
            Timestamp Portal
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -2 }}>
            Sign in to continue
          </Typography>

          {/* Email / Password form */}
          <Box component="form" onSubmit={handleEmailLogin} sx={{ width: "100%" }} aria-label="Sign in form">
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
              />
              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                size="small"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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

              {/* Forgot password link */}
              <Typography
                component={RouterLink}
                to="/forgot-password"
                variant="body2"
                sx={{
                  alignSelf: "flex-end",
                  mt: -0.5,
                  color: "primary.main",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Forgot password?
              </Typography>

              <Button
                type="submit"
                variant="contained"
                startIcon={<EmailIcon />}
                disabled={loading}
                size="large"
              >
                Sign In
              </Button>
            </Stack>
          </Box>

          {/* Divider */}
          <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
            <Typography variant="caption" color="text.secondary">
              or
            </Typography>
            <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
          </Box>

          <Button
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={onLogin}
            disabled={loading}
            fullWidth
          >
            Sign in with Google
          </Button>

          {/* Sign up link */}
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{" "}
            <Typography
              component={RouterLink}
              to="/signup"
              variant="body2"
              fontWeight={600}
              sx={{
                color: "primary.main",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Sign up
            </Typography>
          </Typography>

          {/* Legal links */}
          <Typography variant="caption" color="text.disabled" sx={{ mt: 1, lineHeight: 1.4 }}>
            By signing in, you agree to our{" "}
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
