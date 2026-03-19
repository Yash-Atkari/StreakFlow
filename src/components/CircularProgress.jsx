export default function CircularProgress({ value }) {
  const radius = 30;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;

  const strokeDashoffset =
    circumference - (value / 100) * circumference;

  return (
    <div style={{ width: "70px", height: "70px" }}>
      <svg height="70" width="70">

        {/* Background */}
        <circle
          stroke="#374151"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx="35"
          cy="35"
        />

        {/* Progress */}
        <circle
          stroke="#ff6b00"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{
            strokeDashoffset,
            transition: "stroke-dashoffset 0.35s",
          }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx="35"
          cy="35"
        />

        {/* Text */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="white"
          fontSize="14"
        >
          {value}%
        </text>

      </svg>
    </div>
  );
}
