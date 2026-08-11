import React from "react";

export default function NivoraIcon({ 
  size = "1em", 
  color, 
  className = "", 
  style = {},
  animated = true 
}) {
  // If a specific color is passed and it's not the default primary, use it as solid stroke color.
  // Otherwise, default to the beautiful gradient.
  const hasColor = !!color && color !== "var(--theme-primary, #ff6b00)" && color !== "var(--theme-primary)";
  const strokeColor = hasColor ? color : "url(#nivora-grad)";
  
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`nivora-icon ${className}`}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        overflow: "visible",
        ...style
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nivora-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff4500" />
          <stop offset="50%" stopColor="#ff8c00" />
          <stop offset="100%" stopColor="#ffd700" />
        </linearGradient>
        <style>
          {`
            @keyframes nivora-draw {
              0% {
                stroke-dashoffset: 200;
              }
              100% {
                stroke-dashoffset: 0;
              }
            }
            @keyframes nivora-pulse {
              0% {
                transform: scale(1);
                filter: drop-shadow(0 0 2px rgba(255, 108, 0, 0.4));
              }
              50% {
                transform: scale(1.05);
                filter: drop-shadow(0 0 8px rgba(255, 108, 0, 0.8));
              }
              100% {
                transform: scale(1);
                filter: drop-shadow(0 0 2px rgba(255, 108, 0, 0.4));
              }
            }
            .nivora-path {
              stroke-dasharray: 200;
              stroke-dashoffset: 0;
              ${animated ? "animation: nivora-draw 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;" : ""}
            }
            .nivora-icon-active {
              transform-origin: center;
              ${animated ? "animation: nivora-pulse 2s infinite ease-in-out;" : ""}
            }
          `}
        </style>
      </defs>
      <g className={animated && !hasColor ? "nivora-icon-active" : ""}>
        {/* Curvy 'N' Path */}
        <path
          className="nivora-path"
          d="M 24 73 C 21 53, 26 28, 41 28 C 55 28, 51 72, 65 72 C 77 72, 80 50, 81.5 28"
          fill="none"
          stroke={strokeColor}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Arrow Head */}
        <path
          d="M 70 33 L 81.5 28 L 84 39"
          fill="none"
          stroke={strokeColor}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
