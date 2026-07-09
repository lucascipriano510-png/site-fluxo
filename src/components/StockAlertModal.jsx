import React from 'react';
import { X, Bell, Check, MessageCircle } from 'lucide-react';
import { requestStockAlert } from '../lib/stockAlerts';

// ──────────────────────────────────────────────────────────────
// Modal "Avise-me quando voltar": cliente deixa o telefone num tamanho/produto
// esgotado -> vira lead (tabela stock_notifications). Aparece de baixo no mobile.
// ──────────────────────────────────────────────────────────────
const StockAlertModal = ({ target, onClose, showToast, whatsapp }) => {
  const [phone, setPhone] = React.useState('');
  const [name, setName] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  React.useEffect(() => { if (target) { setPhone(''); setName(''); setDone(false); } }, [target]);
  if (!target) return null;
  const { product, size } = target;
  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    const res = await requestStockAlert({ product, size, phone, name });
    setSending(false);
    if (res.ok) setDone(true);
    else showToast?.(res.error || 'Confira o telefone', 'error');
  };
  // Encomendar agora: quem pediu aviso já decidiu comprar — atalho direto pro
  // WhatsApp da loja com a peça/tamanho na mensagem fecha a encomenda na hora.
  const waNumber = String(whatsapp || '').replace(/\D/g, '');
  const orderLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Oi! Quero ENCOMENDAR essa peça 👇\n\n*${product?.name || ''}*${size ? `\nTamanho: *${size}*` : ''}${product?.sku ? `\nSKU: ${product.sku}` : ''}\n\nTem previsão de chegar?`)}`
    : null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end lg:items-center justify-center" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full lg:max-w-sm bg-zinc-950 border border-white/10 rounded-t-3xl lg:rounded-3xl p-6 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-400">{done ? <Check size={16}/> : <Bell size={16}/>}</span>
            <div>
              <h3 className="text-[13px] font-black uppercase tracking-wide text-white leading-tight">{done ? 'Tamo junto!' : 'Avise-me quando voltar'}</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase">{product?.name}{size ? ` · Tam ${size}` : ''}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-500 hover:text-white shrink-0"><X size={18}/></button>
        </div>
        {done ? (
          <>
            <p className="text-[12px] text-zinc-300 leading-snug font-bold">Anotado! Assim que essa peça voltar, você é o primeiro a saber no WhatsApp. 🔥</p>
            {orderLink && (
              <>
                <p className="text-[11px] text-zinc-500 leading-snug">Não quer esperar? Dá pra encomendar direto com a gente:</p>
                <a
                  href={orderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 bg-emerald-500 text-zinc-950 active:scale-[0.98] transition-transform"
                >
                  <MessageCircle size={14}/> Quero encomendar agora
                </a>
              </>
            )}
            <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest text-zinc-400 bg-zinc-900 border border-white/10 active:scale-[0.98] transition-transform">Fechar</button>
          </>
        ) : (
          <>
            <p className="text-[11px] text-zinc-400 leading-snug">Deixa seu WhatsApp que a gente te chama assim que essa peça voltar ao estoque.</p>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(34) 9 9999-9999"
              autoFocus
              className="w-full p-4 bg-zinc-900 border border-white/10 rounded-2xl text-[15px] font-bold text-white outline-none focus:border-emerald-500/50"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome (opcional)"
              className="w-full p-4 bg-zinc-900 border border-white/10 rounded-2xl text-[15px] font-bold text-white outline-none focus:border-emerald-500/50"
            />
            <button
              type="submit"
              disabled={sending}
              className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${sending ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500 text-zinc-950 active:scale-[0.98]'}`}
            >
              {sending ? 'Enviando…' : <><Bell size={14}/> Quero ser avisado</>}
            </button>
          </>
        )}
      </form>
    </div>
  );
};

export default StockAlertModal;
