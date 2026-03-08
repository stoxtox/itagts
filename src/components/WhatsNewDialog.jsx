// src/components/WhatsNewDialog.jsx
import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Stack, Chip, Divider, IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import MapIcon from "@mui/icons-material/Map";
import TimerIcon from "@mui/icons-material/Timer";
import TableChartIcon from "@mui/icons-material/TableChart";
import TuneIcon from "@mui/icons-material/Tune";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SummarizeIcon from "@mui/icons-material/Summarize";
import BrushIcon from "@mui/icons-material/Brush";

/* ── Version history (newest first) ── */
const VERSIONS = [
  {
    version: "1.3.0",
    date: "Mar 7, 2026",
    tag: "latest",
    items: [
      {
        icon: <TimerIcon fontSize="small" />,
        title: "Enhanced Countdown Timer",
        description:
          "Glowing ring with color progression (green \u2192 amber \u2192 red), urgent pulse animation when \u22645s remaining, and ZUPT name displayed below the ring.",
      },
      {
        icon: <TuneIcon fontSize="small" />,
        title: "Compact Clock Header",
        description:
          "The UTC clock header now slims down to a single line during active sessions, saving valuable screen space in the field.",
      },
      {
        icon: <BrushIcon fontSize="small" />,
        title: "Polished Session Info Section",
        description:
          "Redesigned session info with stat cards for Elapsed time and Current Lap, cleaner layout, and improved dark mode visibility throughout.",
      },
      {
        icon: <TableChartIcon fontSize="small" />,
        title: "Improved Stamps Table",
        description:
          "Row numbers, color-coded names (green for Start, red for Stop), alternating row backgrounds, monospace data columns, and hover effects.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "Mar 7, 2026",
    items: [
      {
        icon: <NotificationsActiveIcon fontSize="small" />,
        title: "Audio & Haptic Feedback",
        description:
          "Double-beep sound + vibration when ZUPT countdown finishes. Uses Web Audio API \u2014 no external files needed.",
      },
      {
        icon: <CheckCircleIcon fontSize="small" />,
        title: "ZUPT Progress Tracking",
        description:
          "Progress badge (e.g. 3/7) and progress bar in the ZUPT grid. Auto-scrolls to next uncaptured ZUPT with pulse animation.",
      },
      {
        icon: <SummarizeIcon fontSize="small" />,
        title: "Finish Confirmation & Summary",
        description:
          "Confirmation dialog before finishing a session. Post-session summary shows stamp count, ZUPTs captured, duration, and sync status.",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "Mar 6, 2026",
    items: [
      {
        icon: <MapIcon fontSize="small" />,
        title: "Session Map View",
        description:
          "Toggle between Table and Map views in session details. Leaflet-powered map with colored markers for each visit, grouped popups for duplicate coordinates.",
      },
      {
        icon: <BrushIcon fontSize="small" />,
        title: "Dark Mode Improvements",
        description:
          "Better slider visibility, adjusted step numbers, refined table header borders, and improved contrast across the Sessions page.",
      },
    ],
  },
];

export default function WhatsNewDialog({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: "80vh" } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          fontWeight: 700,
          pr: 6,
        }}
      >
        <NewReleasesIcon color="primary" />
        What&apos;s New
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: "absolute", right: 12, top: 12, color: "text.secondary" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {VERSIONS.map((release, vi) => (
          <Box key={release.version}>
            {/* Version header */}
            <Box
              sx={{
                px: 3,
                py: 1.5,
                bgcolor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(99,102,241,0.08)"
                    : "rgba(99,102,241,0.04)",
                display: "flex",
                alignItems: "center",
                gap: 1,
                position: "sticky",
                top: 0,
                zIndex: 1,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                v{release.version}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {release.date}
              </Typography>
              {release.tag === "latest" && (
                <Chip
                  label="Latest"
                  size="small"
                  color="primary"
                  sx={{ ml: "auto", fontWeight: 600, height: 22, fontSize: 11 }}
                />
              )}
            </Box>

            {/* Feature items */}
            <Stack spacing={0} sx={{ px: 3, py: 1 }}>
              {release.items.map((item, ii) => (
                <Box
                  key={ii}
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    py: 1.5,
                    borderBottom:
                      ii < release.items.length - 1
                        ? "1px solid"
                        : "none",
                    borderColor: "divider",
                  }}
                >
                  <Box
                    sx={{
                      mt: 0.25,
                      color: "primary.main",
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, lineHeight: 1.3 }}
                    >
                      {item.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 0.25,
                        color: (t) =>
                          t.palette.mode === "dark" ? "grey.400" : "text.secondary",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.description}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>

            {vi < VERSIONS.length - 1 && <Divider />}
          </Box>
        ))}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
