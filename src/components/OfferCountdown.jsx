import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { breakdown } from '../lib/offers';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Contagem regressiva da Oferta do Dia — sempre rumo à meia-noite alvo.
 *
 * Props:
 *  - target    Date | number (ms)  → instante de expiração (00:00 da virada)
 *  - variant   'compact' (card) | 'full' (detalhe / seção)
 *  - onExpire  callback disparado UMA vez quando o relógio zera
 *  - tone      'offer' (âmbar/vermelho urgente) — padrão
 */
export default function OfferCountdown({ target, variant = 'compact', onExpire, className = '', style }) {
  const reduce = useReducedMotion();
  const targetMs = target instanceof Date ? target.getTime() : Number(target);
  const [tick, setTick] = useState(() => breakdown(targetMs));
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const update = () => {
      const b = breakdown(targetMs);
      setTick(b);
      if (b.expired && !firedRef.current) {
        firedRef.current = true;
        if (typeof onExpire === 'function') onExpire();
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMs]);

  if (!targetMs || Number.isNaN(targetMs) || tick.expired) return null;

  const { days, hours, minutes, seconds } = tick;

  // ---------- COMPACT (card) ----------
  if (variant === 'compact') {
    const label = days > 0
      ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    const urgent = days === 0 && hours < 3; // últimas horas → pulsa
    return (
      <motion.span
        className={className}
        animate={urgent && !reduce ? { opacity: [1, 0.55, 1] } : {}}
        transition={urgent && !reduce ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 7px', borderRadius: '6px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(239,68,68,0.16))',
          border: '0.5px solid rgba(245,158,11,0.35)',
          color: '#fcd34d',
          fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          ...style,
        }}
      >
        <Clock size={9} strokeWidth={2.6} style={{ flexShrink: 0 }} />
        {label}
      </motion.span>
    );
  }

  // ---------- FULL (detalhe / seção) ----------
  const units = days > 0
    ? [['Dias', days], ['Hrs', hours], ['Min', minutes], ['Seg', seconds]]
    : [['Hrs', hours], ['Min', minutes], ['Seg', seconds]];

  const Box = ({ lbl, val }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{
        position: 'relative', minWidth: '46px', height: '46px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '12px', overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(24,24,27,0.95), rgba(9,9,11,0.95))',
        border: '1px solid rgba(245,158,11,0.22)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 18px rgba(0,0,0,0.45)',
      }}>
        <span style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent)', pointerEvents: 'none',
        }} />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={val}
            initial={reduce ? false : { y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 14, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: '22px', fontWeight: 900, color: '#fafafa',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1,
            }}
          >
            {pad(val)}
          </motion.span>
        </AnimatePresence>
      </div>
      <span style={{
        fontSize: '7.5px', fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.18em', color: 'rgba(252,211,77,0.75)',
      }}>{lbl}</span>
    </div>
  );

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', ...style }}>
      {units.map(([lbl, val], i) => (
        <React.Fragment key={lbl}>
          <Box lbl={lbl} val={val} />
          {i < units.length - 1 && (
            <span style={{
              color: 'rgba(245,158,11,0.55)', fontWeight: 900, fontSize: '20px',
              lineHeight: '46px', alignSelf: 'flex-start',
            }}>:</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
