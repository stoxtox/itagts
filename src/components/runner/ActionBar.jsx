// src/components/runner/ActionBar.jsx
import React from "react";
import { Paper, Stack, Button, Tooltip, IconButton, Box, useTheme } from "@mui/material";
import StopIcon from "@mui/icons-material/Stop";
import LocationIcon from "@mui/icons-material/Room";
import AddIcon from "@mui/icons-material/AddCircle";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import KeyboardIcon from "@mui/icons-material/Keyboard";

function ActionBar({ loopOn, loopIdx, isMobile, timerRunning, onToggleLoop, onManual, onFinish }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        p: isMobile ? 1.2 : 2,
        borderRadius: 0,
        borderTop: "1px solid",
        borderColor: isDark ? "rgba(99,102,241,0.25)" : "divider",
        backgroundColor: isDark ? "rgba(30,30,47,0.95)" : "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: theme.zIndex.drawer + 2,
      }}
    >
      <Stack direction="row" spacing={isMobile ? 1 : 2} justifyContent="center" alignItems="center" flexWrap="wrap" sx={{ maxWidth: 860, mx: "auto" }}>
        <Button
          fullWidth={isMobile}
          sx={{
            flex: isMobile ? 1 : undefined,
            py: isMobile ? 2 : 1.5,
            minHeight: isMobile ? 56 : 44,
            fontWeight: 700,
            fontSize: isMobile ? "1rem" : undefined,
          }}
          variant="contained"
          color={loopOn ? "error" : "primary"}
          startIcon={loopOn ? <StopIcon /> : <LocationIcon />}
          onClick={onToggleLoop}
          size={isMobile ? "small" : "medium"}
        >
          {loopOn ? `Stop L${loopIdx}` : `Record L${loopIdx}`}
        </Button>

        <Button
          fullWidth={isMobile}
          sx={{
            flex: isMobile ? 1 : undefined,
            py: isMobile ? 2 : 1.5,
            minHeight: isMobile ? 48 : undefined,
            bgcolor: isDark ? "rgba(255,255,255,0.10)" : "rgba(99,102,241,0.08)",
            color: isDark ? "#E0E0FF" : "primary.main",
            borderColor: isDark ? "rgba(255,255,255,0.25)" : "rgba(99,102,241,0.4)",
            "&:hover": {
              bgcolor: isDark ? "rgba(255,255,255,0.18)" : "rgba(99,102,241,0.14)",
              borderColor: isDark ? "rgba(255,255,255,0.4)" : "rgba(99,102,241,0.6)",
            },
            fontWeight: 600,
          }}
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onManual}
          disabled={timerRunning}
          size={isMobile ? "small" : "medium"}
        >
          Manual
        </Button>

        <Button
          fullWidth={isMobile}
          sx={{
            flex: isMobile ? 1 : undefined,
            py: isMobile ? 2 : 1.5,
            minHeight: isMobile ? 48 : undefined,
          }}
          variant="contained"
          color="success"
          startIcon={<DoneAllIcon />}
          onClick={onFinish}
          size={isMobile ? "small" : "medium"}
        >
          Finish
        </Button>

        {!isMobile && (
          <Tooltip title={
            <Box sx={{ fontSize: 12, lineHeight: 1.6 }}>
              <strong>Keyboard Shortcuts</strong><br/>
              Space: Record/Stop lap<br/>
              1-9: Click ZUPT by position<br/>
              Ctrl+Z: Undo last stamp<br/>
              M: Manual stamp<br/>
              F: Finish session
            </Box>
          }>
            <IconButton size="small" sx={{ color: "text.secondary" }}>
              <KeyboardIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Paper>
  );
}

export default React.memo(ActionBar);
