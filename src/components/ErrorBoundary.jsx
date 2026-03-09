// src/components/ErrorBoundary.jsx
import React from "react";
import {
  Box, Paper, Typography, Button, Stack, Avatar, Collapse
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import HomeIcon from "@mui/icons-material/Home";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null, showDetails: false };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, showDetails } = this.state;

    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 50%, #f3f4f6 100%)",
          "@media (prefers-color-scheme: dark)": {
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)",
          },
        }}
      >
        <Paper
          elevation={3}
          sx={{ p: 4, maxWidth: 440, width: "100%", mx: 2, textAlign: "center" }}
        >
          <Stack spacing={3} alignItems="center">
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: "error.main",
              }}
            >
              <ErrorOutlineIcon sx={{ fontSize: 36 }} />
            </Avatar>

            <Typography variant="h5" fontWeight={700} color="text.primary">
              Something went wrong
            </Typography>

            <Typography variant="body2" color="text.secondary">
              An unexpected error occurred. You can try reloading the page
              or going back to the home screen.
            </Typography>

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={() => window.location.reload()}
              >
                Reload App
              </Button>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={() => {
                  window.location.href = "/runner";
                }}
              >
                Go Home
              </Button>
            </Stack>

            {/* Collapsible error details */}
            {error && (
              <>
                <Button
                  size="small"
                  color="inherit"
                  endIcon={
                    <ExpandMoreIcon
                      sx={{
                        transform: showDetails ? "rotate(180deg)" : "rotate(0)",
                        transition: "transform 0.2s",
                      }}
                    />
                  }
                  onClick={() =>
                    this.setState({ showDetails: !showDetails })
                  }
                  sx={{ color: "text.secondary", textTransform: "none" }}
                >
                  {showDetails ? "Hide details" : "Show error details"}
                </Button>
                <Collapse in={showDetails} sx={{ width: "100%" }}>
                  <Box
                    sx={{
                      mt: 1,
                      p: 2,
                      bgcolor: "action.hover",
                      borderRadius: 2,
                      textAlign: "left",
                      maxHeight: 200,
                      overflow: "auto",
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="pre"
                      sx={{
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        m: 0,
                      }}
                    >
                      {error.message}
                      {error.stack && `\n\n${error.stack}`}
                    </Typography>
                  </Box>
                </Collapse>
              </>
            )}
          </Stack>
        </Paper>
      </Box>
    );
  }
}
