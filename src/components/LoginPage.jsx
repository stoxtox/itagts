// src/components/LoginPage.jsx
import React from "react";
import { Box, Paper, Typography, Button, Stack } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

export default function LoginPage({ onLogin }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f3f4f6"
      }}
    >
      <Paper
        elevation={3}
        sx={{ p: 4, maxWidth: 360, width: "100%", textAlign: "center" }}
      >
        <Stack spacing={3}>
          <Typography variant="h5" fontWeight={700}>
            Timestamp Portal
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in with your Google account to continue
          </Typography>
          <Button
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={onLogin}
          >
            Login with Google
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
