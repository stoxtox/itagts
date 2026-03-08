// src/components/runner/SessionSetupForm.jsx
import React from "react";
import {
  Box, Paper, Button, Typography, MenuItem, TextField,
  Divider, Skeleton, Stack
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

function SessionSetupForm({
  plans, planId, setPlanId, title, setTitle,
  isMobile, onStart, unfinished, onResume, formKey, isLoading
}) {
  return (
    <>
      {/* Resume unfinished */}
      {unfinished.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Resume unfinished:
          </Typography>
          {unfinished.map((s) => (
            <Button
              key={s.id}
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              sx={{ mr: 1, mb: 1 }}
              onClick={() => onResume(s)}
            >
              ▶ {s.sessionTitle || s.title || s.planName}
              {s.local ? " (local)" : s.startedOffline ? " (offline)" : ""}
            </Button>
          ))}
          <Divider sx={{ my: 2 }} />
        </Box>
      )}

      {/* Session start form */}
      {isLoading ? (
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={44} />
        </Stack>
      ) : (
        <Paper
          key={formKey}
          variant="outlined"
          sx={{
            p: 2.5, borderRadius: 2,
            bgcolor: "action.hover",
            borderLeftWidth: 4,
            borderLeftColor: "primary.main",
          }}
        >
          <TextField
            select
            fullWidth
            label="Select Plan"
            sx={{ mb: 2 }}
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            {plans.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Session Title"
            sx={{ mb: 2 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button
            fullWidth
            variant="contained"
            size={isMobile ? "large" : "medium"}
            startIcon={<PlayArrowIcon />}
            disabled={!planId || !title.trim()}
            onClick={onStart}
          >
            Start Session
          </Button>
        </Paper>
      )}
    </>
  );
}

export default React.memo(SessionSetupForm);
