"use client";

/**
 * Minimal SVG area sparkline. No charting lib needed for a single trend
 * line — pure SVG path built from a bucketed array of numbers, per the
 * ui-ux-pro-max "Sparkline" pattern: no axes/labels, just shape + one
 * accent color, meant to sit inside a small card as a glance-metric.
 */
export function Sparkline({
  data,
  color = "#E8622C",
  height = 48,
  width = 220,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) {
    return <div style={{ height }} className="flex items-center text-[10px] text-black/30 dark:text-white/30">sem dados suficientes</div>;
  }

  const max = Math.max(...data, 1);
  const min = 0;
  const stepX = width / (data.length - 1);
  const scaleY = (v: number) => height - ((v - min) / (max - min || 1)) * (height - 4) - 2;

  const points = data.map((v, i) => [i * stepX, scaleY(v)] as const);
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkline-fill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {/* last point marker: draws the eye to "right now" */}
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.5} fill={color} />
    </svg>
  );
}
