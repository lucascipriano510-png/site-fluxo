import React from 'react';
import { X, MapPin, Truck, ShieldCheck, MessageCircle } from 'lucide-react';

// ──────────────────────────────────────────────────────────────
// Páginas institucionais (rodapé): Sobre a Loja / Política de Troca /
// Privacidade (LGPD). Antes eram links mortos (#) — matavam a confiança.
// Texto usa os dados do config (marca/cidade/whats) pra nunca desatualizar.
// ──────────────────────────────────────────────────────────────
const InfoModal = ({ page, config, onClose }) => {
  if (!page) return null;
  const waNumber = String(config?.whatsapp || '').replace(/\D/g, '');
  const city = String(config?.location || 'Uberaba, MG');
  const cityShort = city.split(',')[0].trim();
  const brand = config?.brandName || 'Fluxo Outlet';
  const PAGES = {
    sobre: {
      icon: <MapPin size={16}/>,
      title: 'Sobre a Loja',
      sections: [
        { h: 'Quem somos', p: `A ${brand} é loja física de streetwear e peças premium em ${city}. Coleções limitadas, peça selecionada uma a uma — sem atacado de qualidade duvidosa.` },
        { h: 'Como funciona', p: 'Você escolhe no site e finaliza pelo WhatsApp, com atendimento humano antes e depois da compra.' },
        { h: 'Entrega', p: `Entrega no mesmo dia em ${cityShort} (frete grátis), retirada na loja ou envio para todo o Brasil com frete combinado no atendimento.` },
      ],
    },
    trocas: {
      icon: <Truck size={16}/>,
      title: 'Política de Troca',
      sections: [
        { h: 'Troca de tamanho ou cor', p: 'Até 7 dias corridos após o recebimento, com a peça sem uso, sem lavagem e com etiqueta. É só chamar no WhatsApp com o número do pedido.' },
        { h: 'Arrependimento (compra online)', p: 'Você pode desistir da compra em até 7 dias corridos após receber (art. 49 do Código de Defesa do Consumidor), com devolução do valor pago.' },
        { h: 'Peça com defeito', p: 'Defeito de fabricação tem prazo de até 30 dias (art. 26 do CDC). Manda foto no WhatsApp que a gente resolve com troca ou reembolso.' },
        { h: 'Como solicitar', p: 'Chama no WhatsApp com o número do pedido e foto da peça. O frete da troca é combinado no atendimento.' },
      ],
    },
    privacidade: {
      icon: <ShieldCheck size={16}/>,
      title: 'Privacidade',
      sections: [
        { h: 'O que coletamos', p: 'Nome e WhatsApp informados no pedido, itens e valores comprados, e cookies de medição de anúncios (Meta Pixel).' },
        { h: 'Para que usamos', p: 'Processar e acompanhar seu pedido, avisar quando uma peça voltar ao estoque e medir o resultado dos nossos anúncios.' },
        { h: 'Com quem compartilhamos', p: 'Não vendemos seus dados. Dados de medição vão para a Meta de forma criptografada (hash) e a infraestrutura roda em provedores técnicos (Supabase/Vercel).' },
        { h: 'Seus direitos (LGPD)', p: 'Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo nosso WhatsApp.' },
      ],
    },
  };
  const data = PAGES[page];
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-sm flex items-end lg:items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full lg:max-w-md bg-zinc-950 border border-white/10 rounded-t-3xl lg:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)] flex flex-col"
        style={{ maxHeight: '82dvh' }}
      >
        <div className="flex items-start justify-between gap-3 p-6 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-400">{data.icon}</span>
            <h3 className="text-[13px] font-black uppercase tracking-wide text-white leading-tight">{data.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-500 hover:text-white shrink-0 touch-manipulation"><X size={18}/></button>
        </div>
        <div className="overflow-y-auto px-6 space-y-5" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
          {data.sections.map(s => (
            <div key={s.h}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1.5">{s.h}</p>
              <p className="text-[13px] leading-relaxed text-zinc-300">{s.p}</p>
            </div>
          ))}
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 bg-zinc-900 border border-white/10 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all touch-manipulation"
            >
              <MessageCircle size={14}/> Falar com a loja
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
