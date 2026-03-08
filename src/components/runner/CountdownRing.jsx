// src/components/runner/CountdownRing.jsx
import React from "react";
import { useTheme } from "@mui/material/styles";
import { keyframes } from "@mui/material";

/* Pulse animation for urgent countdown (≤5 s) */
const urgentPulse = keyframes`
  0%   { opacity: 0.85; }
  50%  { opacity: 1; }
  100% { opacity: 0.85; }
`;

function CountdownRing({ secondsLeft, total, size = 130, stroke = 9 }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const trackColor = isDark ? "#374151" : "#E5E7EB";
  const textColor = theme.palette.text.primary;

  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? 1 - secondsLeft / total : 0;
  const off = circ * pct;

  // Color progression: green → amber → red
  const color = pct < 0.33 ? "#10B981" : pct < 0.67 ? "#F59E0B" : "#EF4444";

  // Glow intensity scales with urgency
  const glowSize = pct < 0.33 ? 4 : pct < 0.67 ? 8 : 14;
  const isUrgent = secondsLeft <= 5 && secondsLeft > 0;

  // Font sizes scale with ring size
  const secsFontSize = size < 110 ? 28 : 34;

  return (
    <svg
      width={size}
      height={size}
      style={{
        display: "block",
        filter: `drop-shadow(0 0 ${glowSize}px ${color})`,
        transition: "filter 0.5s ease",
        ...(isUrgent
          ? { animation: `${urgentPulse} 0.8s ease-in-out infinite` }
          : {}),
      }}
    >
      {/* Faint tinted background fill */}
      <circle
        r={r}
        cx={size / 2}
        cy={size / 2}
        fill={color}
        opacity={0.06}
      />

      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {/* Track */}
        <circle
          r={r}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          r={r}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 300ms" }}
        />
      </g>

      {/* Center text: seconds remaining */}
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontWeight="800"
        fontSize={secsFontSize}
        fill={textColor}
      >
        {secondsLeft}
      </text>

      {/* Unit label */}
      <text
        x="50%"
        y="64%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontWeight="500"
        fontSize={size < 110 ? 10 : 12}
        fill={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}
      >
        seconds
      </text>
    </svg>
  );
}

export default React.memo(CountdownRing);
