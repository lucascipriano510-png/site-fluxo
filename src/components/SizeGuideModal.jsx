import React from 'react';
import { X, Ruler, MessageCircle } from 'lucide-react';

// ──────────────────────────────────────────────────────────────
// Guia de medidas: tabela aproximada por tipo de peça (camisa/calça/calçado),
// deduzido de categoria + formato dos tamanhos. Medidas aproximadas (±2 cm);
// dúvida real vai pro WhatsApp — vender o tamanho certo = menos troca.
// ──────────────────────────────────────────────────────────────
const SIZE_GUIDE_TABLES = {
  roupas: {
    title: 'Camisetas · Blusas · Moletons',
    cols: ['Tam', 'Tórax (cm)', 'Compr. (cm)'],
    rows: [
      ['P', '96–100', '68'],
      ['M', '100–106', '70'],
      ['G', '106–112', '72'],
      ['GG', '112–120', '74'],
      ['XG', '120–128', '76'],
    ],
  },
  calcas: {
    title: 'Calças · Bermudas · Shorts',
    cols: ['Tam', 'Cintura (cm)'],
    rows: [
      ['36', '74–78'], ['38', '78–82'], ['40', '82–86'], ['42', '86–90'],
      ['44', '90–96'], ['46', '96–102'], ['48', '102–108'],
    ],
  },
  calcados: {
    title: 'Calçados',
    cols: ['BR', 'Pé (cm)'],
    rows: [
      ['37', '23,5'], ['38', '24,2'], ['39', '24,8'], ['40', '25,5'],
      ['41', '26,2'], ['42', '26,8'], ['43', '27,5'], ['44', '28,2'],
    ],
  },
};
export const sizeGuideKind = (product) => {
  const ctx = `${product?.category || ''} ${product?.subcategory || ''} ${product?.name || ''}`;
  if (/CAL[ÇC]AD|T[ÊE]NIS|SAPAT|CHINEL|SAND[ÁA]L/i.test(ctx)) return 'calcados';
  const sizes = (product?.sizes || []).map(s => String(typeof s === 'string' ? s : (s?.size || '')).trim());
  if (sizes.some(s => /^\d+$/.test(s))) return 'calcas';
  return 'roupas';
};
// Produto de tamanho único (U) não precisa de guia — o botão nem aparece.
export const hasSizeGuide = (product) => (product?.sizes || []).some(s => {
  const n = String(typeof s === 'string' ? s : (s?.size || '')).trim().toUpperCase();
  return n && n !== 'U' && n !== 'UNICO' && n !== 'ÚNICO';
});

const SizeGuideModal = ({ product, onClose, whatsapp }) => {
  if (!product) return null;
  const guide = SIZE_GUIDE_TABLES[sizeGuideKind(product)];
  const waNumber = String(whatsapp || '').replace(/\D/g, '');
  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-sm flex items-end lg:items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full lg:max-w-sm bg-zinc-950 border border-white/10 rounded-t-3xl lg:rounded-3xl p-6 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-flux/10 text-flux"><Ruler size={16}/></span>
            <div>
              <h3 className="text-[13px] font-black uppercase tracking-wide text-white leading-tight">Guia de Medidas</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase">{guide.title}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-500 hover:text-white shrink-0 touch-manipulation"><X size={18}/></button>
        </div>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-center">
            <thead>
              <tr className="bg-zinc-900">
                {guide.cols.map(c => (
                  <th key={c} className="py-2.5 px-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guide.rows.map((row, i) => (
                <tr key={row[0]} className={i % 2 ? 'bg-zinc-900/40' : ''}>
                  {row.map((cell, j) => (
                    <td key={j} className={`py-2.5 px-2 text-[12px] tabular-nums ${j === 0 ? 'font-black text-white' : 'font-bold text-zinc-300'}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-500 font-bold leading-snug">Medidas aproximadas (±2 cm) — cada modelagem varia um pouco. Na dúvida entre dois tamanhos, chama a gente que a equipe mede a peça pra você.</p>
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Oi! Tô na dúvida do tamanho dessa peça 👇\n\n*${product.name}*\nSKU: ${product.sku || 'N/A'}\n\nPodem me ajudar com as medidas?`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 bg-whatsapp text-zinc-950 active:scale-[0.98] transition-transform touch-manipulation"
          >
            <MessageCircle size={14}/> Tirar dúvida no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
};

export default SizeGuideModal;
