import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Gem, SkipForward, Tag } from 'lucide-react';
import { optimizeImage } from '../lib/images';
import { upsertProduct } from '../lib/supabase';

// ── MESA DE GARIMPO (pesquisa módulo 4 — Luxo) ──
// O catálogo tem dezenas de peças com título genérico ("Camisa premium") e o
// dado da casa é brutal: marca no título converte 4× (49% vs 12,9% de sacola).
// Renomear na mão peça a peça foi vetado pelo dono ("trabalho demais") — esta
// mesa transforma em triagem de 2 toques: foto grande, chip da marca, salvar.
// Regra de voz: NUNCA inventar marca — o dono confirma pela etiqueta/foto que
// ele mesmo fotografou. "Sem marca" tira a peça da fila sem mexer no nome.

// Marcas que já apareceram no catálogo + as comuns do garimpo. O chip só
// PROPÕE; o nome final fica editável antes de salvar.
const MARCAS = [
  'Lacoste', 'Armani', 'LV', 'Gucci', 'Balmain', 'Boss', 'Nike', 'Adidas',
  'Jordan', 'Puma', 'Oakley', 'Tommy', 'Ralph Lauren', 'CK', 'Diesel',
  'Dior', 'Prada', 'Versace', 'Burberry', 'Moncler', 'New Balance',
  'Mizuno', 'Vans', 'QuickSilver', 'Cyclone', 'Fendi', 'Reserva', 'Osklen',
];

// Detecção de marca no título (fila = quem NÃO tem). \b não pega acento, mas
// nomes de marca aqui são ASCII; 'LV' precisa de borda pra não casar em "aLVo".
const TEM_MARCA = new RegExp(`\\b(${MARCAS.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');

// Formato do dono (e do título que converteu 49%): MARCA primeiro, sem repetir
// o tipo da peça — a categoria já diz que é camisa. "Camisa premium" + Lacoste
// → "Lacoste premium" (+ chips → "Lacoste premium Preta"). O tipo na 1ª
// palavra é descartado; qualificador (premium, jogador, destroyed…) fica.
const TIPO_PECA = /^(camisa|camiseta|calca|bermuda|short|bone|tenis|blusa|jaqueta|moletom|regata|corta-?vento|chinelo|sandalia|sapato|meia|cueca|bolsa|mochila|oculos|cinto|carteira)s?$/i;
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const proporNome = (nome, marca) => {
  const palavras = String(nome || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const resto = palavras.length && TIPO_PECA.test(semAcento(palavras[0])) ? palavras.slice(1) : palavras;
  return [marca, ...resto].join(' ').replace(/\s+/g, ' ').trim();
};

// "Camisa Lacoste" 15× é o mesmo grid de clones com marca — peça única pede
// NOME de peça única (individuação, módulo 4). Chips de estilo/cor compõem o
// resto do nome em 1-2 toques; a cor cadastrada da peça vem primeiro.
const ESTILOS_POR_CATEGORIA = [
  [/BON|CHAP[ÉE]U/i, ['Aba curva', 'Aba reta', 'Trucker']],
  [/CAL[ÇC]AD|T[ÊE]NIS|SAPAT|CHINEL/i, ['Casual', 'Corrida', 'Slip on']],
  [/CAL[ÇC]A|BERMUDA|SHORT|JEANS/i, ['Jeans', 'Moletom', 'Cargo', 'Sarja', 'Jogador', 'Tactel', 'Destroyed']],
];
const ESTILOS_PADRAO = ['Polo', 'Piquet', 'Gola careca', 'Gola V', 'Manga longa', 'Regata', 'Dry', 'Listrada', 'Bordada', 'Estampada', 'Time'];
const CORES = ['Preto', 'Branco', 'Azul', 'Marinho', 'Verde', 'Vermelho', 'Cinza', 'Chumbo', 'Bege', 'Off white', 'Amarelo', 'Vinho', 'Marrom'];
const estilosDaPeca = (p) => {
  const ctx = `${p?.category || ''} ${p?.subcategory || ''} ${p?.name || ''}`;
  const hit = ESTILOS_POR_CATEGORIA.find(([re]) => re.test(ctx));
  return hit ? hit[1] : ESTILOS_PADRAO;
};
const coresDaPeca = (p) => {
  const propria = String(p?.color || '').trim();
  if (!propria) return CORES;
  const semDup = CORES.filter((c) => c.toLowerCase() !== propria.toLowerCase());
  return [propria, ...semDup];
};
// Compõe nome final: base (tipo+marca+resto) + extras que ainda não estão nele.
const comporNome = (peca, marca, extras) => {
  const base = proporNome(peca.name, marca);
  const baixo = base.toLowerCase();
  return [base, ...extras.filter((x) => !baixo.includes(x.toLowerCase()))].join(' ').replace(/\s+/g, ' ').trim();
};

// "Sem marca mesmo" persiste por aparelho (a mesa é ferramenta do dono).
const SKIP_KEY = '@fluxo:garimpo-sem-marca';
const lerSkips = () => { try { return JSON.parse(localStorage.getItem(SKIP_KEY)) || {}; } catch { return {}; } };

// Contagem da fila pro botão de entrada no Estoque (mesmo critério da mesa).
export const contarFilaGarimpo = (products) => (products || []).filter((p) =>
  !p.is_kit && p.is_active !== false && (p.stock || 0) > 0 &&
  !TEM_MARCA.test(p.name || '') && !lerSkips()[p.id]
).length;

const AdminGarimpo = ({ products, setProducts, showToast, onClose }) => {
  const [skips, setSkips] = useState(lerSkips);
  const [marcaAtiva, setMarcaAtiva] = useState(null);
  const [proposta, setProposta] = useState('');
  const [marcaLivre, setMarcaLivre] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [feitas, setFeitas] = useState(0);
  // "Depois" adia SÓ dentro da mesa (estado local) — nunca reordena o array
  // global de produtos, que também alimenta a vitrine do cliente.
  const [adiadas, setAdiadas] = useState({});

  const fila = useMemo(() => (products || [])
    .filter((p) =>
      !p.is_kit && p.is_active !== false && (p.stock || 0) > 0 &&
      !TEM_MARCA.test(p.name || '') && !skips[p.id]
    )
    .sort((a, b) => (adiadas[a.id] || 0) - (adiadas[b.id] || 0)),
  [products, skips, adiadas]);

  const peca = fila[0] || null;
  // Extras (estilo/cor) toggle e recompõem a proposta; edição manual no campo
  // é livre, mas o próximo toque em chip recompõe do zero (edita por último).
  const [extras, setExtras] = useState([]);

  const escolherMarca = (marca) => {
    setMarcaAtiva(marca);
    setExtras([]);
    setProposta(proporNome(peca.name, marca));
  };

  const toggleExtra = (x) => {
    const next = extras.includes(x) ? extras.filter((e) => e !== x) : [...extras, x];
    setExtras(next);
    setProposta(comporNome(peca, marcaAtiva, next));
  };

  // Nome repetido = clone de volta; avisa pra detalhar mais um chip.
  const repetidas = useMemo(() => {
    const alvo = proposta.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!alvo || !peca) return 0;
    return (products || []).filter((p) => p.id !== peca.id && String(p.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === alvo).length;
  }, [proposta, products, peca]);

  const proxima = () => { setMarcaAtiva(null); setProposta(''); setMarcaLivre(''); setExtras([]); };

  const marcarSemMarca = () => {
    const next = { ...skips, [peca.id]: true };
    setSkips(next);
    try { localStorage.setItem(SKIP_KEY, JSON.stringify(next)); } catch {}
    proxima();
  };

  const salvar = async () => {
    const nome = proposta.trim().replace(/\s+/g, ' ');
    if (!nome || salvando) return;
    setSalvando(true);
    try {
      const data = await upsertProduct({ ...peca, name: nome });
      setProducts((prev) => prev.map((p) => (p.id === peca.id ? (data || { ...p, name: nome }) : p)));
      setFeitas((n) => n + 1);
      showToast(`Agora é "${nome}"`);
      proxima();
    } catch (err) {
      showToast('Erro ao salvar: ' + (err?.message || ''), 'error');
    }
    setSalvando(false);
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho da mesa */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={onClose} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors py-2">
          <ArrowLeft size={14}/> Estoque
        </button>
        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
          <Gem size={13}/> {fila.length} na fila{feitas > 0 ? ` · ${feitas} feita${feitas > 1 ? 's' : ''}` : ''}
        </span>
      </div>

      {!peca ? (
        <div className="bg-zinc-900 rounded-[32px] border border-white/5 p-10 text-center space-y-3">
          <Gem size={28} className="mx-auto text-emerald-500"/>
          <p className="text-white font-black uppercase text-sm tracking-wide">Fila zerada</p>
          <p className="text-[11px] font-bold text-zinc-500">Todo o catálogo ativo tem marca legível no título (ou foi marcado como sem marca).</p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-[32px] border border-white/5 overflow-hidden">
          {/* Foto grande — o dono reconhece a marca pela peça que ele mesmo garimpou */}
          <div className="relative w-full aspect-[4/5] bg-zinc-950">
            <img src={optimizeImage(peca.image, 700, 85)} alt={peca.name} className="w-full h-full object-cover" decoding="async" />
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/85 to-transparent">
              <p className="text-white font-black uppercase text-sm leading-tight">{peca.name}</p>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">{peca.category}{peca.subcategory ? ` · ${peca.subcategory}` : ''} · {peca.sku} · {peca.stock} un</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Chips de marca */}
            <div className="flex flex-wrap gap-2">
              {MARCAS.map((m) => (
                <button
                  key={m}
                  onClick={() => escolherMarca(m)}
                  className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-wide border transition-all touch-manipulation ${marcaAtiva === m ? 'bg-emerald-500 text-zinc-950 border-emerald-500' : 'bg-zinc-950 text-zinc-300 border-white/10 active:scale-95'}`}
                >{m}</button>
              ))}
            </div>

            {/* Marca fora da lista */}
            <div className="flex gap-2">
              <input
                value={marcaLivre}
                onChange={(e) => setMarcaLivre(e.target.value)}
                placeholder="Outra marca…"
                className="flex-1 bg-zinc-950 border border-white/5 py-3 px-4 rounded-xl text-[12px] font-bold text-white outline-none focus:border-emerald-500/50"
              />
              <button
                onClick={() => marcaLivre.trim() && escolherMarca(marcaLivre.trim())}
                className="px-4 bg-zinc-800 text-white rounded-xl text-[11px] font-black uppercase touch-manipulation active:scale-95"
              ><Tag size={13}/></button>
            </div>

            {/* Detalhe da peça — individuação: nome de peça única, não clone com marca */}
            {marcaAtiva && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Detalhe a peça (opcional)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {estilosDaPeca(peca).map((x) => (
                      <button key={x} onClick={() => toggleExtra(x)} className={`px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase border transition-all touch-manipulation ${extras.includes(x) ? 'bg-white text-zinc-950 border-white' : 'bg-zinc-950 text-zinc-400 border-white/10 active:scale-95'}`}>{x}</button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {coresDaPeca(peca).map((x) => (
                      <button key={x} onClick={() => toggleExtra(x)} className={`px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase border transition-all touch-manipulation ${extras.includes(x) ? 'bg-emerald-400 text-zinc-950 border-emerald-400' : 'bg-zinc-950 text-zinc-500 border-white/10 active:scale-95'}`}>{x}</button>
                    ))}
                  </div>
                </div>
                <input
                  value={proposta}
                  onChange={(e) => setProposta(e.target.value)}
                  className="w-full bg-zinc-950 border border-emerald-500/40 py-3.5 px-4 rounded-xl text-[13px] font-black text-white uppercase outline-none focus:border-emerald-500"
                />
                {repetidas > 0 && (
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-400">Já {repetidas === 1 ? 'existe 1 peça' : `existem ${repetidas} peças`} com esse nome — detalha com estilo ou cor pra individualizar.</p>
                )}
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 touch-manipulation ${salvando ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500 text-zinc-950 active:scale-95'}`}
                >
                  <Check size={14}/> {salvando ? 'Salvando…' : 'Salvar e próxima'}
                </button>
              </div>
            )}

            {/* Saídas sem renomear */}
            <div className="flex gap-2 pt-1">
              <button onClick={marcarSemMarca} className="flex-1 py-3 rounded-xl bg-zinc-950 border border-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-widest touch-manipulation active:scale-95">Sem marca mesmo</button>
              <button onClick={() => { setAdiadas((prev) => ({ ...prev, [peca.id]: Date.now() })); proxima(); }} className="flex-1 py-3 rounded-xl bg-zinc-950 border border-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 touch-manipulation active:scale-95"><SkipForward size={12}/> Depois</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGarimpo;
