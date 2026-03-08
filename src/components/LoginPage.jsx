// src/components/LoginPage.jsx
import React, { useState } from "react";
import {
  Box, Paper, Typography, Button, Stack,
  TextField, Divider, Avatar
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import EmailIcon from "@mui/icons-material/Email";
import TimerIcon from "@mui/icons-material/Timer";

export default function LoginPage({ onLogin, onEmailLogin, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        sx={{ p: 4, maxWidth: 360, width: "100%", textAlign: "center" }}
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
          <Box component="form" onSubmit={handleEmailLogin}>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                size="small"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <TextField
                label="Password"
                type="password"
                size="small"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<EmailIcon />}
                disabled={loading}
              >
                Sign in with Email
              </Button>
            </Stack>
          </Box>

          <Divider>or</Divider>

          <Button
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={onLogin}
            disabled={loading}
          >
            Login with Google
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
