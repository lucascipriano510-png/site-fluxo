import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MessageCircle, Ruler } from 'lucide-react';
import { interacaoElemento, observarExposicao } from '../lib/attention';
import { getMySize } from '../lib/mySize';

// ── UNIDADE EXPLORÁVEL DE CAIMENTO (pesquisa módulo 2 — item 1 da ordem de ataque) ──
// O WhatsApp real mostrou que a conversa de calça morre na dúvida de caimento
// ("a P é muito pequena?", "46 serve, 48 fica folgadinho") e que "será que serve
// em mim?" é pergunta com resposta ameaçadora — o cliente EVITA o guia de medidas.
// A unidade aplica a ciência da curiosidade: lacuna ESPECÍFICA na voz do cliente
// + resposta concreta alcançável; o medo da troca é desarmado AQUI, antes da
// seção de tamanho logo abaixo. Nada de decisão fica escondido: o fato principal
// (veste colada) é sempre visível; as perguntas só aprofundam.
// ESCOPO: só CALÇA JOGADOR (54 vistas → 5,6% sacola, pior conversão do catálogo).
// As demais calças ficam de CONTROLE — não expandir sem ler o antes/depois na
// aba Atenção (elemento 'caimento': exposição × abertura por pergunta).
export const hasComoVeste = (p) =>
  String(p?.category || '').trim().toUpperCase() === 'CALÇA' &&
  String(p?.subcategory || '').trim().toUpperCase() === 'JOGADOR';

const PERGUNTAS = [
  {
    id: 'entre_numeros',
    q: 'Fiquei entre dois números',
    a: 'Vai no número que você usa de sempre: colada é pra ficar no corpo. Curte mais folgadinho? Sobe um número. Na dúvida, confere a cintura em cm no guia.',
    acao: 'medidas',
  },
  {
    id: 'nao_servir',
    q: 'E se não servir em mim?',
    a: 'Troca fácil: até 7 dias com a peça sem uso e com etiqueta, direto pelo WhatsApp. Loja física em Uberaba — não tem erro.',
  },
  {
    id: 'ver_peca',
    q: 'Quero ver a peça antes',
    a: 'Chama no zap que a gente manda mais fotos da peça — e a equipe mede pra você se pedir.',
    acao: 'whatsapp',
  },
];

const ComoVeste = ({ product, whatsapp, onOpenSizeGuide }) => {
  const [aberta, setAberta] = React.useState(null);
  // Telemetria conta a PRIMEIRA abertura de cada pergunta por produto aberto —
  // toggle repetido é ajuste de leitura, não exploração nova.
  const contadas = React.useRef(new Set());
  const ref = React.useRef(null);
  React.useEffect(() => observarExposicao(ref.current, 'caimento'), []);
  React.useEffect(() => { setAberta(null); contadas.current = new Set(); }, [product?.id]);

  if (!hasComoVeste(product)) return null;
  // Se a vitrine já aprendeu o número do cliente (lib/mySize), a resposta fala
  // com ele: "vai no seu 42" convence mais que regra genérica (módulo 3 —
  // desejo exige que o resultado "se aplique a mim").
  const meu = getMySize(product);
  const waNumber = String(whatsapp || '').replace(/\D/g, '');
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(`Oi! Me manda mais fotos da *${product.name}* (Ref. ${product.sku || 'N/A'})? Quero ver o caimento.`)}`;

  const abrir = (id) => {
    const fechar = aberta === id;
    setAberta(fechar ? null : id);
    if (!fechar && !contadas.current.has(id)) {
      contadas.current.add(id);
      interacaoElemento('caimento', { pergunta: id, sku: product.sku || null });
    }
  };

  return (
    <div ref={ref} className="flex flex-col gap-4 border-t border-white/5 pt-8">
      <p className="text-[11px] font-black text-white uppercase tracking-[0.22em]">Como ela veste</p>
      <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Jogador é skinny: veste colada na perna, no corpo — a pegada da calça é essa.
      </p>
      <div className="flex flex-col gap-2">
        {PERGUNTAS.map((p) => (
          <div key={p.id} className="rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => abrir(p.id)}
              aria-expanded={aberta === p.id}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left touch-manipulation"
            >
              <span className="text-[12px] font-black uppercase tracking-wide text-zinc-200">{p.q}</span>
              <ChevronDown size={15} className={`shrink-0 text-flux-deep transition-transform duration-200 ${aberta === p.id ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {aberta === p.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 flex flex-col gap-3">
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {p.id === 'entre_numeros' && meu
                        ? `Vai no seu ${meu} de sempre: colada é pra ficar no corpo. Curte mais folgadinho? Sobe um número. Na dúvida, confere a cintura em cm no guia.`
                        : p.a}
                    </p>
                    {p.acao === 'medidas' && onOpenSizeGuide && (
                      <button
                        type="button"
                        onClick={onOpenSizeGuide}
                        className="self-start flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-flux touch-manipulation active:opacity-70 transition-opacity"
                      >
                        <Ruler size={12}/> Ver medidas da cintura
                      </button>
                    )}
                    {p.acao === 'whatsapp' && waNumber && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-whatsapp touch-manipulation active:opacity-70 transition-opacity"
                      >
                        <MessageCircle size={12}/> Pedir foto no WhatsApp
                      </a>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComoVeste;
