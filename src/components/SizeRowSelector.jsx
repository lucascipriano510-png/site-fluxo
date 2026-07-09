import React from 'react';
import { Bell, Minus, Plus } from 'lucide-react';
import { buildSizeGrid } from '../lib/sizeGrid';

// ──────────────────────────────────────────────────────────────
// Seletor de tamanho (estilo Netshoes): UMA fileira de botões compactos com a
// grade completa da loja. Esgotado = risco DIAGONAL no botão inteiro + toque
// abre o avise-me. Quantidade por tamanho fica em steppers abaixo da fileira
// (não cabe dentro de botão compacto). Usado no card mobile E desktop.
// ──────────────────────────────────────────────────────────────
export const SIZE_STRIKE_STYLE = {
  backgroundImage: 'linear-gradient(to top right, transparent calc(50% - 1px), rgba(113,113,122,0.9) calc(50% - 1px), rgba(113,113,122,0.9) calc(50% + 1px), transparent calc(50% + 1px))',
};
const SizeRowSelector = ({ product, selectedSizes, setSelectedSizes, onPick, onAlert }) => {
  const entries = buildSizeGrid(product);
  const anySoldOut = entries.some((e) => e.stock <= 0);
  const picked = entries.filter((e) => (selectedSizes[e.size] || 0) > 0);
  const removeOne = (size) => setSelectedSizes((prev) => { const n = { ...prev }; if (n[size] > 1) n[size]--; else delete n[size]; return n; });
  const unpick = (size) => setSelectedSizes((prev) => { const n = { ...prev }; delete n[size]; return n; });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" data-testid="size-row">
        {entries.map(({ size, stock }) => {
          const qty = selectedSizes[size] || 0;
          const soldOut = stock <= 0;
          if (soldOut) return (
            <button
              key={size}
              onClick={() => onAlert(size)}
              style={SIZE_STRIKE_STYLE}
              aria-label={`Tamanho ${size} esgotado — pedir aviso`}
              className="h-11 flex-1 min-w-[42px] max-w-[64px] rounded-lg border border-zinc-800 bg-zinc-900/40 font-black transition-all active:scale-95 touch-manipulation hover:border-emerald-500/40 flex flex-col items-center justify-center gap-[3px] leading-none"
            >
              <span className="text-[12px] text-zinc-500">{size}</span>
              <span className="text-[7px] text-emerald-400 uppercase tracking-wide flex items-center gap-0.5"><Bell size={7}/> Avise-me</span>
            </button>
          );
          return (
            <button
              key={size}
              onClick={() => (qty > 0 ? unpick(size) : onPick(size, stock))}
              aria-label={`Tamanho ${size}`}
              className={`relative h-11 flex-1 min-w-[42px] max-w-[64px] rounded-lg border font-black text-[13px] transition-all active:scale-95 touch-manipulation ${qty > 0 ? 'bg-white border-white text-zinc-950' : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:border-white hover:text-white'}`}
            >
              {size}
              {qty > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black grid place-items-center tabular-nums">{qty}</span>}
              {qty === 0 && stock <= 3 && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true"/>}
            </button>
          );
        })}
      </div>
      {anySoldOut && (
        <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5">
          <Bell size={10} className="text-emerald-400 shrink-0"/> Riscado esgotou — toca nele pra ser avisado quando voltar
        </p>
      )}
      {picked.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {picked.map(({ size, stock }) => (
            <div key={size} className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2">
              <span className="text-[11px] font-black text-white uppercase min-w-[64px]">Tam {size}</span>
              <div className="flex items-center gap-3 bg-zinc-950 rounded-lg px-2 py-1 border border-zinc-800">
                <button onClick={() => removeOne(size)} aria-label={`Tirar um do tamanho ${size}`} className="text-zinc-400 hover:text-white touch-manipulation p-2 -m-1"><Minus size={12}/></button>
                <span className="text-[12px] font-black text-white w-4 text-center tabular-nums">{selectedSizes[size]}</span>
                <button onClick={() => onPick(size, stock)} aria-label={`Mais um do tamanho ${size}`} className="text-zinc-400 hover:text-white touch-manipulation p-2 -m-1"><Plus size={12}/></button>
              </div>
              {stock <= 3 && <span className="text-[9px] font-black uppercase text-red-400 ml-auto">restam {stock}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SizeRowSelector;
