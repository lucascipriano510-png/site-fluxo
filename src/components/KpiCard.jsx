import React from 'react';
import Sparkline from './Sparkline';

// Tokens locais (espelham a paleta do instruções site.txt — card self-contained)
const CARD = { background: '#10131A', border: '1px solid rgba(255,255,255,0.06)' };
const LABEL = { color: '#71717A', letterSpacing: '0.1em' };
const NUM = { fontVariantNumeric: 'tabular-nums' };

const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

const DeltaBadge = ({ cur, prev }) => {
  const d = pct(cur, prev);
  if (d === null) return null;
  const up = d >= 0;
  return (
    <span
      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
      style={{ color: up ? '#00E08A' : '#FF5A5A', background: up ? 'rgba(0,224,138,0.1)' : 'rgba(255,90,90,0.1)' }}
    >
      {up ? '+' : ''}{d}%
    </span>
  );
};

/**
 * KpiCard — card de KPI padronizado do Master Control.
 * Estrutura (spec instruções site.txt): Nome · Delta% · Valor · Sparkline.
 */
export default function KpiCard({
  label,
  value,
  cur,
  prev,
  valueColor = '#FFFFFF',
  valueSize = '1.75rem',
  series = [],
  accent = '#00E08A',
  fullWidth = false,
  borderColor,
}) {
  const showDelta = cur !== undefined && prev !== undefined;
  return (
    <div className={`rounded-2xl p-4 ${fullWidth ? 'col-span-2' : ''}`} style={{ ...CARD, ...(borderColor ? { borderColor } : null) }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium uppercase" style={LABEL}>{label}</p>
        {showDelta && <DeltaBadge cur={cur} prev={prev} />}
      </div>
      <span className="font-bold leading-none block" style={{ fontSize: valueSize, color: valueColor, ...NUM }}>{value}</span>
      {series && series.length >= 2 && (
        <div className="mt-2.5 -mb-1">
          <Sparkline data={series} color={accent} height={22} />
        </div>
      )}
    </div>
  );
}
