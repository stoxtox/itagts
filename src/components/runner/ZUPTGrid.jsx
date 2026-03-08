// src/components/runner/ZUPTGrid.jsx
import React, { useRef, useEffect } from "react";
import { Box, Typography, Chip, IconButton, LinearProgress, keyframes } from "@mui/material";
import CheckIcon from "@mui/icons-material/CheckCircle";
import TimerIcon from "@mui/icons-material/Timer";
import SwapVertIcon from "@mui/icons-material/SwapVert";

import { chipTone } from "../../services/runnerHelpers";

/* subtle pulse animation for "next up" chip */
const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
  70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
  100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
`;

function ZUPTGrid({ zupts, captured, timerRunning, reverse, setReverse, onClickZupt }) {
  const ordered = reverse ? [...zupts].reverse() : zupts;
  const containerRef = useRef(null);
  const chipRefs = useRef({});

  const doneCount = captured.size;
  const total = zupts.length;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;

  // Find the first uncaptured ZUPT name (in current order)
  const nextUp = ordered.find((z) => !captured.has(z.name))?.name || null;

  // Auto-scroll to the "next up" chip when captured changes
  useEffect(() => {
    if (!nextUp || !chipRefs.current[nextUp]) return;
    chipRefs.current[nextUp].scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [nextUp, doneCount]);

  return (
    <>
      {/* Header with progress */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 0.5, gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Select ZUPT location:
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: doneCount === total ? "success.main" : "primary.main",
            bgcolor: (t) =>
              t.palette.mode === "dark"
                ? "rgba(99,102,241,0.15)"
                : "rgba(99,102,241,0.08)",
            px: 1,
            py: 0.25,
            borderRadius: 1,
          }}
        >
          {doneCount} / {total}
        </Typography>
        <IconButton
          size="small"
          sx={{ ml: "auto" }}
          onClick={() => setReverse((p) => !p)}
          title="Flip order"
        >
          <SwapVertIcon fontSize="inherit" sx={{ transform: "rotate(90deg)" }} />
        </IconButton>
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          mb: 1,
          height: 4,
          borderRadius: 2,
          bgcolor: "action.hover",
          "& .MuiLinearProgress-bar": {
            borderRadius: 2,
            bgcolor: doneCount === total ? "success.main" : "primary.main",
          },
        }}
      />

      {/* Chip row with auto-scroll */}
      <Box
        ref={containerRef}
        sx={{
          display: "flex",
          gap: 1,
          overflowX: "auto",
          py: 1,
          /* hide scrollbar but keep functionality */
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": { borderRadius: 2, bgcolor: "divider" },
        }}
      >
        {ordered.map((z, i) => {
          const done = captured.has(z.name);
          const isNext = z.name === nextUp;
          const disabled = timerRunning || done;
          return (
            <Chip
              key={z.id || z.name}
              ref={(el) => { chipRefs.current[z.name] = el; }}
              label={z.name}
              icon={done ? <CheckIcon /> : <TimerIcon />}
              color={done ? chipTone(i) : isNext ? "primary" : "default"}
              variant={done ? "filled" : isNext ? "filled" : "outlined"}
              clickable={!disabled}
              onClick={!disabled ? () => onClickZupt(z) : undefined}
              sx={{
                minHeight: { xs: 48, sm: 36 },
                fontSize: { xs: "0.875rem", sm: "0.8125rem" },
                "& .MuiChip-label": { px: { xs: 1.5, sm: 1 } },
                "& .MuiChip-icon": { fontSize: { xs: 20, sm: 18 } },
                transition: "all 0.3s ease",
                // Captured chips: slightly de-emphasized
                ...(done && {
                  opacity: 0.7,
                  transform: "scale(0.92)",
                }),
                // Next-up chip: pulse animation
                ...(isNext &&
                  !timerRunning && {
                    animation: `${pulse} 2s ease-in-out infinite`,
                    fontWeight: 700,
                  }),
              }}
            />
          );
        })}
      </Box>
    </>
  );
}

export default React.memo(ZUPTGrid);
