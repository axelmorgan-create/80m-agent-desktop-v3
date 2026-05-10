import React from "react";

export function AtmMascotSvgDefs(): React.JSX.Element {
  return (
    <defs>
      <filter id="drop-shadow">
        <feDropShadow
          dx="0"
          dy="25"
          stdDeviation="20"
          floodColor="#000000"
          floodOpacity="0.4"
        />
      </filter>
      <linearGradient id="beigeBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#d6d2c1" />
        <stop offset="15%" stopColor="#eae7de" />
        <stop offset="45%" stopColor="#cbc9ba" />
        <stop offset="85%" stopColor="#b5b3a3" />
        <stop offset="100%" stopColor="#8d8b7d" />
      </linearGradient>
      <radialGradient id="screenGrad" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#fff9c4" />
        <stop offset="30%" stopColor="#ffeb3b" />
        <stop offset="100%" stopColor="#f57c00" />
      </radialGradient>
      <radialGradient id="blushGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#ffc9c9" stopOpacity="0" />
      </radialGradient>
      <g id="feather-wing">
        <path
          d="M 0,0 C 70,-70 150,-90 220,-110 C 240,-80 210,-40 180,-10 C 220,-5 220,30 180,40 C 210,60 190,90 150,80 C 160,110 130,140 90,120 C 110,150 70,170 30,130 C 20,110 10,60 0,0 Z"
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth="4"
        />
      </g>
      <clipPath id="screen-clip">
        <rect x="235" y="255" width="330" height="200" rx="12" />
      </clipPath>
    </defs>
  );
}
