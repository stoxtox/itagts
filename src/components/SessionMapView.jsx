// src/components/SessionMapView.jsx
import React, { useEffect, useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default marker icon paths (broken by CRA/Webpack bundling)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/* ── visit colors ── */
const VISIT_COLORS = [
  "#4F46E5", // indigo — 1st visit
  "#F97316", // orange — 2nd visit
  "#10B981", // green  — 3rd visit
  "#EF4444", // red    — 4th visit
  "#8B5CF6", // violet — 5th+
];

function getVisitColor(idx) {
  return VISIT_COLORS[Math.min(idx, VISIT_COLORS.length - 1)];
}

/* ── single-visit marker icon ── */
function createSingleIcon(color, label) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `
      <div style="
        width:28px; height:28px; border-radius:50%;
        background:${color}; border:3px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
        display:flex; align-items:center; justify-content:center;
        color:#fff; font-size:11px; font-weight:700; line-height:1;
      ">${label}</div>
    `,
  });
}

/* ── stacked multi-visit marker icon — shows colored rings ── */
function createStackedIcon(visits) {
  const count = visits.length;
  // Build small colored dots in a row inside the marker
  const dots = visits
    .map((v) => {
      const c = getVisitColor(v.visitIdx);
      return `<span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block;"></span>`;
    })
    .join("");

  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
    html: `
      <div style="
        width:36px; height:36px; border-radius:50%;
        background:${getVisitColor(0)}; border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        color:#fff; font-size:12px; font-weight:800; line-height:1;
        position:relative;
      ">
        ${count}
        <div style="display:flex;gap:2px;margin-top:1px;">${dots}</div>
      </div>
    `,
  });
}

/* ── ordinal helper ── */
function ordinal(n) {
  const v = n + 1;
  if (v === 1) return "1st";
  if (v === 2) return "2nd";
  if (v === 3) return "3rd";
  return `${v}th`;
}

/* ── auto-fit bounds when points change ── */
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length === 0) return;
    if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  }, [map, bounds]);
  return null;
}

/* ── main component ── */
export default function SessionMapView({ rows, isDark }) {
  const points = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.lat !== "" && r.lon !== "" && !isNaN(Number(r.lat)) && !isNaN(Number(r.lon))
      ),
    [rows]
  );

  // Group points by coordinate key, track visit index per location
  const { grouped, allEnriched } = useMemo(() => {
    const visitCount = {};
    const enriched = points.map((p, idx) => {
      const coordKey = `${Number(p.lat).toFixed(6)},${Number(p.lon).toFixed(6)}`;
      const visitIdx = visitCount[coordKey] || 0;
      visitCount[coordKey] = visitIdx + 1;
      return { ...p, visitIdx, coordKey, orderIdx: idx };
    });

    // Group by coordKey
    const map = {};
    for (const ep of enriched) {
      if (!map[ep.coordKey]) map[ep.coordKey] = [];
      map[ep.coordKey].push(ep);
    }
    return { grouped: map, allEnriched: enriched };
  }, [points]);

  const bounds = useMemo(
    () => points.map((p) => [Number(p.lat), Number(p.lon)]),
    [points]
  );

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const lineColor = isDark ? "#7c7cff" : "#4F46E5";

  // Empty state
  if (points.length === 0) {
    return (
      <Box
        sx={{
          height: 380,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 2,
          bgcolor: "action.hover",
          border: "1px dashed",
          borderColor: "divider",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No coordinates available for map view
        </Typography>
      </Box>
    );
  }

  const hasDuplicates = allEnriched.some((p) => p.visitIdx > 0);
  const maxVisit = Math.max(...allEnriched.map((p) => p.visitIdx));

  return (
    <Box>
      <MapContainer
        key={isDark ? "dark" : "light"}
        bounds={bounds}
        boundsOptions={{ padding: [30, 30], maxZoom: 16 }}
        scrollWheelZoom
        style={{ height: 380, width: "100%", borderRadius: 8 }}
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />

        {bounds.length > 1 && (
          <Polyline positions={bounds} color={lineColor} weight={2} opacity={0.6} />
        )}

        {/* One marker per unique location — combined popup for stacked visits */}
        {Object.entries(grouped).map(([coordKey, visits]) => {
          const first = visits[0];
          const pos = [Number(first.lat), Number(first.lon)];

          const icon =
            visits.length === 1
              ? createSingleIcon(getVisitColor(0), first.orderIdx + 1)
              : createStackedIcon(visits);

          return (
            <Marker key={coordKey} position={pos} icon={icon}>
              <Popup maxWidth={280}>
                <div style={{ fontFamily: "inherit" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                    {first.lat}, {first.lon}
                    {first.h ? ` · H: ${first.h}` : ""}
                  </div>
                  <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "6px 0" }} />
                  {visits.map((v) => (
                    <div
                      key={v.orderIdx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 0",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: getVisitColor(v.visitIdx),
                          flexShrink: 0,
                          border: "2px solid #fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                      <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                        <strong>{v.name}</strong>
                        <span style={{ color: "#888", marginLeft: 6 }}>
                          {ordinal(v.visitIdx)} visit
                        </span>
                        <br />
                        <span style={{ color: "#666" }}>Time: {v.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Popup>
            </Marker>
          );
        })}

        <FitBounds bounds={bounds} />
      </MapContainer>

      {/* Legend — only shown when duplicate coordinates exist */}
      {hasDuplicates && (
        <Box
          sx={{
            display: "flex",
            gap: 2,
            mt: 1,
            px: 1,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {VISIT_COLORS.slice(0, maxVisit + 1).map((color, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box
                sx={{
                  width: 12, height: 12, borderRadius: "50%",
                  bgcolor: color, border: "2px solid", borderColor: "divider",
                }}
              />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {ordinal(i)} visit
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
