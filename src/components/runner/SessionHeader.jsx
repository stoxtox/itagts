// src/components/runner/SessionHeader.jsx
import React from "react";
import {
  Box, Paper, Typography, MenuItem, TextField,
  Stack, Chip, Tooltip, Badge, IconButton
} from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import OfflineBoltIcon from "@mui/icons-material/OfflineBolt";

import { TZ_LIST } from "../../services/runnerHelpers";

export default function SessionHeader({
  clock, tz, setTz,
  startedAt, startedOffline,
  isMobile,
  online, queuedCount, finishedCount,
  onOpenPanel
}) {
  const compact = !!startedAt;

  return (
    <Paper
      elevation={compact ? 3 : 6}
      sx={{
        p: compact
          ? (isMobile ? 1 : 1.5)
          : (isMobile ? 2 : 3),
        mb: compact ? 1.5 : (isMobile ? 3 : 4),
        borderRadius: compact ? 2 : 3,
        color: "#fff",
        textAlign: "center",
        bgcolor: "transparent",
        background:
          "radial-gradient(110% 140% at 0% 0%, rgba(99,102,241,1) 0%, rgba(79,70,229,1) 55%, rgba(67,56,202,1) 100%)",
        boxShadow: compact
          ? "0 4px 12px rgba(79,70,229,.25), inset 0 0 0 1px rgba(255,255,255,0.06)"
          : "0 10px 30px rgba(79,70,229,.35), inset 0 0 0 1px rgba(255,255,255,0.06)",
        transition: "all 0.3s ease",
      }}
    >
      <Stack
        direction={compact ? "row" : "column"}
        alignItems="center"
        justifyContent="center"
        spacing={compact ? 1.5 : 0}
      >
        <Typography
          variant={compact ? "h6" : (isMobile ? "h5" : "h4")}
          fontWeight={800}
          letterSpacing={0.2}
          sx={{
            textShadow: "0 1px 10px rgba(0,0,0,.18)",
            lineHeight: 1.2,
          }}
        >
          {clock}
        </Typography>

        {/* Offline-started chip — only in full mode */}
        {!compact && startedAt && startedOffline && (
          <Tooltip title="This session was started while offline">
            <Chip
              size="small"
              color="warning"
              variant="filled"
              icon={<OfflineBoltIcon />}
              label="Started offline"
              sx={{
                mt: 1,
                color: "#111",
                fontWeight: 600,
                bgcolor: "rgba(255,214,102,.95)",
                "& .MuiChip-icon": { color: "#111" },
              }}
            />
          </Tooltip>
        )}

        {/* TZ dropdown — inline in compact, below in full */}
        <TextField
          select
          size="small"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          sx={{
            mt: compact ? 0 : 1.25,
            width: compact ? 90 : 140,
            ".MuiOutlinedInput-root": {
              bgcolor: "rgba(255,255,255,0.12)",
              color: "#fff",
              borderRadius: 2,
              fontSize: compact ? 12 : undefined,
              "& fieldset": { borderColor: "rgba(255,255,255,0.18)" },
              "&:hover fieldset": { borderColor: "rgba(255,255,255,0.35)" },
              ...(compact && {
                py: 0,
                "& .MuiSelect-select": { py: "4px" },
              }),
            },
            ".MuiSvgIcon-root": { color: "#fff" },
          }}
        >
          {TZ_LIST.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>

        {/* Offline status icons — inline in compact mode */}
        {!online && compact && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Offline">
              <IconButton
                size="small"
                sx={{
                  color: "warning.light",
                  bgcolor: "rgba(0,0,0,.18)",
                  p: 0.5,
                }}
              >
                <CloudOffIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            {queuedCount > 0 && (
              <Badge badgeContent={queuedCount} color="info" overlap="circular">
                <IconButton
                  size="small"
                  onClick={() => onOpenPanel("queued")}
                  sx={{ color: "info.light", bgcolor: "rgba(0,0,0,.18)", p: 0.5 }}
                >
                  <CloudUploadIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Badge>
            )}
          </Stack>
        )}
      </Stack>

      {/* Full offline status row — only in non-compact mode */}
      {!online && !compact && (
        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="center"
          alignItems="center"
          sx={{ mt: 1.25 }}
        >
          <Tooltip title="Offline — network unavailable">
            <span>
              <IconButton
                size="small"
                onClick={() => onOpenPanel("net")}
                aria-label="Network status"
                sx={{
                  color: "warning.light",
                  bgcolor: "rgba(0,0,0,.18)",
                  "&:hover": { bgcolor: "rgba(0,0,0,.26)" },
                }}
              >
                <CloudOffIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip
            title={
              queuedCount
                ? `${queuedCount} change${queuedCount > 1 ? "s" : ""} queued`
                : "No queued changes"
            }
          >
            <span>
              <Badge
                badgeContent={queuedCount || 0}
                color={queuedCount ? "info" : "default"}
                overlap="circular"
              >
                <IconButton
                  size="small"
                  onClick={() => onOpenPanel("queued")}
                  aria-label="Queued changes"
                  sx={{
                    color: queuedCount ? "info.light" : "rgba(255,255,255,.7)",
                    bgcolor: "rgba(0,0,0,.18)",
                    "&:hover": { bgcolor: "rgba(0,0,0,.26)" },
                  }}
                >
                  <CloudUploadIcon fontSize="small" />
                </IconButton>
              </Badge>
            </span>
          </Tooltip>

          <Tooltip
            title={
              finishedCount
                ? `${finishedCount} finished session${finishedCount > 1 ? "s" : ""} pending`
                : "Nothing pending"
            }
          >
            <span>
              <Badge
                badgeContent={finishedCount || 0}
                color={finishedCount ? "warning" : "default"}
                overlap="circular"
              >
                <IconButton
                  size="small"
                  onClick={() => onOpenPanel("finished")}
                  aria-label="Finished pending"
                  sx={{
                    color: finishedCount ? "warning.light" : "rgba(255,255,255,.7)",
                    bgcolor: "rgba(0,0,0,.18)",
                    "&:hover": { bgcolor: "rgba(0,0,0,.26)" },
                  }}
                >
                  <AssignmentTurnedInIcon fontSize="small" />
                </IconButton>
              </Badge>
            </span>
          </Tooltip>
        </Stack>
      )}
    </Paper>
  );
}
