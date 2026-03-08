// src/components/runner/StampsTable.jsx
import React from "react";
import {
  Box, Typography, Paper,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody
} from "@mui/material";

import { TZ_IANA, toDateSafe } from "../../services/runnerHelpers";

/* header cell shared styling */
const headSx = {
  fontWeight: 700,
  bgcolor: "background.paper",
  borderBottom: "1px solid",
  borderColor: "divider",
  fontSize: 13,
};

/* colour for the name column */
function nameColor(name) {
  if (/^L\d+\s+Start$/i.test(name)) return "success.main";
  if (/^L\d+\s+Stop$/i.test(name)) return "error.main";
  return "primary.main";
}

/* detect loop‐marker rows for subtle highlight */
function isLoopRow(name) {
  return /^L\d+\s+(Start|Stop)$/i.test(name);
}

function StampsTable({ stamps, tz }) {
  const fmt = (d) =>
    d.toLocaleTimeString("en-US", { timeZone: TZ_IANA[tz], hour12: false });

  if (!stamps.length) return null;

  return (
    <Box mt={4} mb={12}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Recorded timestamps:
      </Typography>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ maxHeight: 280, borderRadius: 2, mb: 2 }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...headSx, width: 36 }}>#</TableCell>
              <TableCell sx={{ ...headSx, minWidth: 100 }}>Name</TableCell>
              <TableCell sx={headSx}>Time&nbsp;({tz})</TableCell>
              <TableCell sx={headSx}>Dur&nbsp;(s)</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {stamps.map((t, i) => {
              const loopMarker = isLoopRow(t.zuptName);
              return (
                <TableRow
                  key={i}
                  sx={{
                    "&:nth-of-type(even)": { backgroundColor: "action.hover" },
                    "&:hover": {
                      backgroundColor: (th) =>
                        th.palette.mode === "dark"
                          ? "rgba(99,102,241,0.08)"
                          : "rgba(99,102,241,0.04)",
                    },
                    ...(loopMarker && {
                      bgcolor: (th) =>
                        th.palette.mode === "dark"
                          ? "rgba(99,102,241,0.12)"
                          : "rgba(99,102,241,0.06)",
                    }),
                  }}
                >
                  {/* Row number */}
                  <TableCell
                    sx={{
                      color: "text.secondary",
                      fontSize: 12,
                      fontFamily: "monospace",
                    }}
                  >
                    {i + 1}
                  </TableCell>

                  {/* ZUPT name — colour-coded */}
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: nameColor(t.zuptName),
                    }}
                  >
                    {t.zuptName}
                  </TableCell>

                  {/* Time — monospace */}
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                    {fmt(toDateSafe(t.time))}
                  </TableCell>

                  {/* Duration — monospace */}
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                    {t.duration}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default React.memo(StampsTable);
