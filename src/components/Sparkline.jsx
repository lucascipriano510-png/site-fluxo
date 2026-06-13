import React, { useId } from 'react';

/**
 * Sparkline — mini gráfico de tendência em SVG puro (sem deps, leve p/ render em lote).
 * Usado nos KpiCards do Master Control. Respeita prefers-reduced-motion (sem animação).
 */
export default function Sparkline({ data = [], color = '#00E08A', height = 22 }) {
  const gid = useId();
  const pts = (data || []).filter((n) => Number.isFinite(n));
  if (pts.length < 2) return <div style={{ height }} aria-hidden="true" />;

  const W = 100; // viewBox width (escala via preserveAspectRatio=none)
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = max - min || 1;
  const step = W / (pts.length - 1);
  const y = (v) => height - ((v - min) / range) * (height - 2) - 1;
  const coords = pts.map((v, i) => [i * step, y(v)]);
  const line = coords.map(([x, yy], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yy.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${height} L0,${height} Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${gid})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
