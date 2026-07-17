import React, { useState, useMemo, useEffect } from 'react';
import { Flame, Users, RotateCcw, Megaphone, Check, Send, Eye } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// ============================================================
// VENDAS ATIVAS — máquina de recuperação, reativação e campanha
// Usa os pedidos (orders) que já existem. Sem mexer no resto.
// ============================================================

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const fmt = (v) => BRL.format(Number(v) || 0);

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
// Telefone BR -> formato wa.me (prefixa 55 se faltar)
const waPhone = (p) => {
  let d = onlyDigits(p);
  if (!d || d.length < 10) return '';
  if (d.length <= 11) d = '55' + d;
  return d;
};
const firstName = (n) => (String(n || 'cliente').trim().split(/\s+/)[0] || 'cliente');
const daysAgo = (raw) => Math.floor((Date.now() - new Date(raw).getTime()) / 86400000);
const hoursAgo = (raw) => (Date.now() - new Date(raw).getTime()) / 3600000;
const fillTemplate = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

// ── Controle de "já contatado" (localStorage) — evita furo/spam ──
const CONTACT_KEY = '@fluxo:growth-contacted-v1';
const RECONTACT_DAYS = 14; // some da lista por 14 dias após contato
const loadContacted = () => { try { return JSON.parse(localStorage.getItem(CONTACT_KEY) || '{}'); } catch { return {}; } };
const saveContacted = (obj) => { try { localStorage.setItem(CONTACT_KEY, JSON.stringify(obj)); } catch {} };

export default function AdminGrowth({ leads = [], products = [], config = {} }) {
  const [tab, setTab] = useState('recuperar');
  const [contacted, setContacted] = useState(loadContacted);

  const loja = config?.brandName ? String(config.brandName).split(' ').slice(0, 2).join(' ') : 'Fluxo Outlet';
  const siteUrl = config?.siteUrl || 'https://www.fluxooutlet.com.br';

  const isContacted = (key, phone) => {
    const ts = contacted?.[key]?.[phone];
    if (!ts) return false;
    return daysAgo(ts) < RECONTACT_DAYS;
  };
  const markContacted = (key, phone) => {
    setContacted((prev) => {
      const next = { ...prev, [key]: { ...(prev[key] || {}), [phone]: new Date().toISOString() } };
      saveContacted(next);
      return next;
    });
  };
  const resetContacted = (key) => {
    setContacted((prev) => { const next = { ...prev, [key]: {} }; saveContacted(next); return next; });
  };

  const send = (key, phone, name, msg) => {
    const ph = waPhone(phone);
    if (!ph) return;
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
    markContacted(key, ph);
  };

  // ── ENGINE 1 — RECUPERAR (pedidos NOVO esfriando) ──
  const [staleHours, setStaleHours] = useState(2);
  const [tplRecuperar, setTplRecuperar] = useState(
    `Oi {nome}! Vi que você montou um pedido aqui na {loja} ({itens}) mas a gente não finalizou 👀\nTá tudo certo? Posso separar e garantir pra você ainda hoje. Quer fechar? 👇`
  );
  const abandoned = useMemo(() => (leads || [])
    .filter((l) => l.status === 'NOVO' && l._raw?.created_at && hoursAgo(l._raw.created_at) >= staleHours && waPhone(l.phone))
    .sort((a, b) => new Date(b._raw.created_at) - new Date(a._raw.created_at)),
    [leads, staleHours]);
  const abandonedValue = abandoned.reduce((s, l) => s + Number(l.value || 0), 0);

  // ── ENGINE 2 — REATIVAR (clientes sumidos) ──
  const customers = useMemo(() => {
    const map = {};
    (leads || []).filter((l) => l.status === 'CONCLUÍDO' && waPhone(l.phone)).forEach((l) => {
      const k = waPhone(l.phone);
      if (!map[k]) map[k] = { phone: k, name: l.name, orders: 0, total: 0, last: null };
      map[k].orders += 1;
      map[k].total += Number(l.value || 0);
      const d = new Date(l._raw.created_at);
      if (!map[k].last || d > map[k].last) { map[k].last = d; map[k].name = l.name || map[k].name; }
    });
    return Object.values(map);
  }, [leads]);

  const [lapseDays, setLapseDays] = useState(30);
  const [tplReativar, setTplReativar] = useState(
    `Oi {nome}! Faz {dias} dias que você não aparece na {loja} 💚\nChegou coleção nova e separei um mimo pra você voltar. Bora dar uma olhada? 👇\n{link}`
  );
  const lapsed = useMemo(() => customers
    .filter((c) => c.last && daysAgo(c.last) >= lapseDays)
    .sort((a, b) => b.total - a.total),
    [customers, lapseDays]);
  const lapsedValue = lapsed.reduce((s, c) => s + c.total, 0);

  // ── ENGINE 3 — CAMPANHA (disparo segmentado) ──
  const categories = useMemo(() => Array.from(new Set((products || []).map((p) => p.category).filter(Boolean))).sort(), [products]);
  const buyersByCategory = useMemo(() => {
    const prodCat = {}; (products || []).forEach((p) => { prodCat[p.id] = p.category; });
    const map = {};
    (leads || []).filter((l) => l.status === 'CONCLUÍDO' && waPhone(l.phone)).forEach((l) => {
      (l.items || []).forEach((it) => {
        const cat = prodCat[it.id]; if (!cat) return;
        if (!map[cat]) map[cat] = {};
        map[cat][waPhone(l.phone)] = { phone: waPhone(l.phone), name: l.name };
      });
    });
    return map;
  }, [leads, products]);

  const [segment, setSegment] = useState('todos');
  const [tplCampanha, setTplCampanha] = useState(
    `Oi {nome}! Novidade na {loja} 🔥\n\n[escreva sua oferta aqui]\n\nDá uma olhada 👇\n{link}`
  );
  const recipients = useMemo(() => {
    if (segment === 'todos') return customers.map((c) => ({ phone: c.phone, name: c.name }));
    if (segment === 'vip') return customers.filter((c) => c.orders >= 2).sort((a, b) => b.total - a.total).map((c) => ({ phone: c.phone, name: c.name }));
    if (segment === 'sumidos') return lapsed.map((c) => ({ phone: c.phone, name: c.name }));
    if (segment === 'abandonaram') return abandoned.map((l) => ({ phone: waPhone(l.phone), name: l.name }));
    if (segment.startsWith('cat:')) return Object.values(buyersByCategory[segment.slice(4)] || {});
    return [];
  }, [segment, customers, lapsed, abandoned, buyersByCategory]);

  // ── ENGINE 4 — ATENÇÃO (funil da sessão + habituação por elemento) ──
  // Lê os eventos do lib/attention.js (últimos 30 dias) e agrega no cliente.
  // Todo evento carrega {sid, visita} no meta — agregação sem join.
  const [attnRows, setAttnRows] = useState(null);
  const [attnLoading, setAttnLoading] = useState(false);
  useEffect(() => {
    if (tab !== 'atencao' || attnRows !== null || attnLoading) return;
    setAttnLoading(true);
    supabase
      .from('site_lead_signals')
      .select('event, visitor_id, meta, created_at')
      .in('event', ['sessao', 'marco_sessao', 'exposicao_elemento', 'interacao_elemento'])
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20000)
      .then(({ data, error }) => {
        setAttnRows(error ? [] : data || []);
        setAttnLoading(false);
      });
  }, [tab, attnRows, attnLoading]);

  const attn = useMemo(() => {
    if (!attnRows) return null;
    const VISITA_BUCKETS = ['1ª visita', '2ª–3ª visita', '4ª+ visita'];
    const EXP_BUCKETS = ['1ª', '2ª–3ª', '4ª+'];
    const bVisita = (v) => (v <= 1 ? VISITA_BUCKETS[0] : v <= 3 ? VISITA_BUCKETS[1] : VISITA_BUCKETS[2]);
    const bExp = (n) => (n <= 1 ? EXP_BUCKETS[0] : n <= 3 ? EXP_BUCKETS[1] : EXP_BUCKETS[2]);

    const sessoes = {};   // sid -> bucket de visita
    const marcos = {};    // sid -> Set(marco)
    const elementos = {}; // elemento -> bucket exp -> { exp:Set, int:Set }
    const origens = {};

    attnRows.forEach((r) => {
      const m = r.meta || {};
      if (r.event === 'sessao' && m.sid) {
        sessoes[m.sid] = bVisita(Number(m.visita) || 1);
        const o = m.origem || {};
        const fonte = o.utm_source || (o.ref !== 'direto' && o.ref) || 'direto';
        origens[fonte] = (origens[fonte] || 0) + 1;
      } else if (r.event === 'marco_sessao' && m.sid && m.marco) {
        (marcos[m.sid] = marcos[m.sid] || new Set()).add(m.marco);
      } else if ((r.event === 'exposicao_elemento' || r.event === 'interacao_elemento') && m.elemento) {
        const porBucket = (elementos[m.elemento] = elementos[m.elemento] || {});
        const slot = (porBucket[bExp(Number(m.exposicao_n) || 1)] ||= { exp: new Set(), int: new Set() });
        slot[r.event === 'exposicao_elemento' ? 'exp' : 'int'].add(m.sid || r.visitor_id);
      }
    });

    // Funil da sessão por segmento de visita (Testes 1/4/5 do módulo 1)
    const ETAPAS = [
      ['scroll', 'Rolou a página'],
      ['interacao', 'Interagiu'],
      ['produto', 'Abriu peça'],
      ['carrinho', 'Pôs na sacola'],
      ['whatsapp', 'Foi pro WhatsApp'],
    ];
    const funil = VISITA_BUCKETS.map((bucket) => {
      const sids = Object.keys(sessoes).filter((sid) => sessoes[sid] === bucket);
      return {
        bucket,
        sessoes: sids.length,
        etapas: ETAPAS.map(([marco, label]) => ({
          label,
          n: sids.filter((sid) => marcos[sid]?.has(marco)).length,
        })),
      };
    }).filter((f) => f.sessoes > 0);

    const NOME_ELEMENTO = { banner: 'Banner principal', cupom_boas_vindas: 'Cupom de boas-vindas', subbanner: 'Sub-banner', caimento: 'Caimento (calça jogador)', meu_numero: 'Chip "Seu nº" no card', motor_intencao: 'Motor de intenção (grade)' };
    const habituacao = Object.entries(elementos).map(([el, porBucket]) => ({
      elemento: NOME_ELEMENTO[el] || el,
      buckets: EXP_BUCKETS.map((b) => {
        const slot = porBucket[b];
        const exp = slot ? slot.exp.size : 0;
        const int = slot ? slot.int.size : 0;
        return { bucket: b, exp, int, taxa: exp > 0 ? int / exp : null };
      }),
    }));

    const topOrigens = Object.entries(origens).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const totalSessoes = Object.keys(sessoes).length;
    return { funil, habituacao, topOrigens, totalSessoes };
  }, [attnRows]);

  // ── UI helpers ──
  const TABS = [
    { key: 'recuperar', label: 'Recuperar', icon: <RotateCcw size={14} />, count: abandoned.length },
    { key: 'reativar', label: 'Reativar', icon: <Users size={14} />, count: lapsed.length },
    { key: 'campanha', label: 'Campanha', icon: <Megaphone size={14} />, count: null },
    { key: 'atencao', label: 'Atenção', icon: <Eye size={14} />, count: null },
  ];

  return (
    <div className="p-6 animate-in space-y-5 pb-32">
      <div>
        <h3 className="font-black italic uppercase text-white tracking-widest text-lg flex items-center gap-2">
          <Flame size={18} className="text-emerald-500" /> Vendas Ativas
        </h3>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">A máquina caça a venda. Você só dispara.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all ${tab === t.key ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}>
            <span className="flex items-center gap-1.5">{t.icon}<span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span></span>
            {t.count != null && <span className="text-[9px] font-bold opacity-70">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ===== RECUPERAR ===== */}
      {tab === 'recuperar' && (
        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-2xl border border-white/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Dinheiro parado</p>
              <p className="text-2xl font-black text-emerald-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(abandonedValue)}</p>
              <p className="text-[9px] text-zinc-600 font-bold uppercase mt-0.5">{abandoned.length} pedido(s) esfriando</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[8px] font-black uppercase text-zinc-600">Parado há +</span>
              <select value={staleHours} onChange={(e) => setStaleHours(Number(e.target.value))}
                className="bg-zinc-800 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-white outline-none">
                <option value={2}>2 horas</option>
                <option value={6}>6 horas</option>
                <option value={24}>1 dia</option>
                <option value={72}>3 dias</option>
              </select>
            </div>
          </div>

          <TemplateBox label="Mensagem (use {nome}, {itens}, {loja})" value={tplRecuperar} onChange={setTplRecuperar} />

          <ListHeader total={abandoned.length} doneKey="recuperar" contacted={contacted} onReset={resetContacted} />

          {abandoned.length === 0 ? (
            <Empty msg="Nenhum pedido esfriando. 🎉" />
          ) : abandoned.map((l) => {
            const ph = waPhone(l.phone);
            const done = isContacted('recuperar', ph);
            const itens = (l.items || []).map((i) => i.name).slice(0, 2).join(', ') || 'seu pedido';
            const msg = fillTemplate(tplRecuperar, { nome: firstName(l.name), itens, loja });
            return (
              <ContactRow key={l.id} done={done} name={l.name} phone={l.phone}
                meta={`${fmt(l.value)} · há ${Math.floor(hoursAgo(l._raw.created_at))}h · ${itens}`}
                onSend={() => send('recuperar', l.phone, l.name, msg)} />
            );
          })}
        </div>
      )}

      {/* ===== REATIVAR ===== */}
      {tab === 'reativar' && (
        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-2xl border border-white/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Clientes sumidos</p>
              <p className="text-2xl font-black text-emerald-400">{lapsed.length}</p>
              <p className="text-[9px] text-zinc-600 font-bold uppercase mt-0.5">já gastaram {fmt(lapsedValue)} com você</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[8px] font-black uppercase text-zinc-600">Sem comprar há +</span>
              <select value={lapseDays} onChange={(e) => setLapseDays(Number(e.target.value))}
                className="bg-zinc-800 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-white outline-none">
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
                <option value={45}>45 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </div>
          </div>

          <TemplateBox label="Mensagem (use {nome}, {dias}, {loja}, {link})" value={tplReativar} onChange={setTplReativar} />

          <ListHeader total={lapsed.length} doneKey="reativar" contacted={contacted} onReset={resetContacted} />

          {lapsed.length === 0 ? (
            <Empty msg="Nenhum cliente sumido nesse período." />
          ) : lapsed.map((c) => {
            const done = isContacted('reativar', c.phone);
            const dias = daysAgo(c.last);
            const msg = fillTemplate(tplReativar, { nome: firstName(c.name), dias, loja, link: siteUrl });
            const vip = c.orders >= 2;
            return (
              <ContactRow key={c.phone} done={done} name={c.name} phone={c.phone} vip={vip}
                meta={`${c.orders}x · ${fmt(c.total)} · sumiu há ${dias}d`}
                onSend={() => send('reativar', c.phone, c.name, msg)} />
            );
          })}
        </div>
      )}

      {/* ===== CAMPANHA ===== */}
      {tab === 'campanha' && (
        <div className="space-y-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Para quem disparar</p>
            <select value={segment} onChange={(e) => setSegment(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-4 py-3 text-[11px] font-black uppercase text-white outline-none">
              <option value="todos">Todos que já compraram</option>
              <option value="vip">VIPs (compraram 2x+)</option>
              <option value="sumidos">Sumidos (30+ dias)</option>
              <option value="abandonaram">Abandonaram o carrinho</option>
              {categories.map((cat) => <option key={cat} value={`cat:${cat}`}>Compraram: {cat}</option>)}
            </select>
          </div>

          <TemplateBox label="Mensagem (use {nome}, {loja}, {link})" value={tplCampanha} onChange={setTplCampanha} rows={5} />

          <div className="bg-zinc-900 rounded-2xl border border-white/5 p-4 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{recipients.length} destinatário(s)</p>
            <button onClick={() => resetContacted('campanha')} className="text-[9px] font-black uppercase text-zinc-600 hover:text-zinc-400 flex items-center gap-1">
              <RotateCcw size={11} /> Resetar enviados
            </button>
          </div>

          {recipients.length === 0 ? (
            <Empty msg="Nenhum cliente nesse segmento ainda." />
          ) : recipients.map((r) => {
            const done = isContacted('campanha', r.phone);
            const msg = fillTemplate(tplCampanha, { nome: firstName(r.name), loja, link: siteUrl });
            return (
              <ContactRow key={r.phone} done={done} name={r.name} phone={r.phone}
                onSend={() => send('campanha', r.phone, r.name, msg)} />
            );
          })}
        </div>
      )}

      {/* ===== ATENÇÃO ===== */}
      {tab === 'atencao' && (
        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-2xl border border-white/5 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Funil de atenção · 30 dias</p>
            <p className="text-2xl font-black text-emerald-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {attn ? attn.totalSessoes : '—'} <span className="text-[11px] text-zinc-500 uppercase">sessões</span>
            </p>
            <p className="text-[9px] text-zinc-600 font-bold uppercase mt-0.5">Onde a atenção morre — por visita e por exposição</p>
          </div>

          {attnLoading || !attn ? (
            <Empty msg="Carregando sinais…" />
          ) : attn.totalSessoes === 0 ? (
            <Empty msg="Sem sinais ainda — começam a contar a partir de agora." />
          ) : (
            <>
              {/* Funil por segmento de visita: queda entre segmentos = habituação geral */}
              {attn.funil.map((f) => (
                <div key={f.bucket} className="bg-zinc-900 rounded-2xl border border-white/5 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">{f.bucket}</p>
                    <p className="text-[9px] font-bold uppercase text-zinc-500">{f.sessoes} sessões</p>
                  </div>
                  {f.etapas.map((e) => {
                    const pct = f.sessoes > 0 ? e.n / f.sessoes : 0;
                    return (
                      <div key={e.label} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 text-[9px] font-black uppercase tracking-wide text-zinc-400">{e.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.round(pct * 100)}%` }} />
                        </div>
                        <span className="w-12 shrink-0 text-right text-[10px] font-black text-zinc-300" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {Math.round(pct * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Habituação por elemento: taxa de interação × nº da exposição.
                  Taxa caindo da 1ª pra 4ª+ = o elemento morreu pra quem volta. */}
              {attn.habituacao.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Desgaste por exposição</p>
                  {attn.habituacao.map((h) => (
                    <div key={h.elemento} className="bg-zinc-900 rounded-2xl border border-white/5 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white mb-2.5">{h.elemento}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {h.buckets.map((b) => (
                          <div key={b.bucket} className="rounded-xl bg-white/[0.03] border border-white/5 p-2.5 text-center">
                            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{b.bucket} exposição</p>
                            <p className="text-lg font-black text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {b.taxa == null ? '—' : `${Math.round(b.taxa * 100)}%`}
                            </p>
                            <p className="text-[8px] font-bold text-zinc-600 uppercase" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {b.int}/{b.exp} interagiu
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Origens das sessões */}
              {attn.topOrigens.length > 0 && (
                <div className="bg-zinc-900 rounded-2xl border border-white/5 p-4 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">De onde as sessões vêm</p>
                  {attn.topOrigens.map(([fonte, n]) => (
                    <div key={fonte} className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-300 truncate">{fonte}</span>
                      <span className="text-[10px] font-black text-zinc-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ──
function TemplateBox({ label, value, onChange, rows = 3 }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-[12px] text-zinc-200 outline-none focus:border-emerald-500/40 resize-none leading-relaxed" />
    </div>
  );
}

function ListHeader({ total, doneKey, contacted, onReset }) {
  const doneCount = Object.keys(contacted?.[doneKey] || {}).length;
  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{total} na fila</p>
      {doneCount > 0 && (
        <button onClick={() => onReset(doneKey)} className="text-[9px] font-black uppercase text-zinc-600 hover:text-zinc-400 flex items-center gap-1">
          <RotateCcw size={11} /> Resetar ({doneCount})
        </button>
      )}
    </div>
  );
}

function ContactRow({ done, name, phone, meta, vip, onSend }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-all ${done ? 'bg-zinc-900/40 border-white/5 opacity-50' : 'bg-zinc-900 border-white/5'}`}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[12px] font-black"
        style={{ background: vip ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.05)', color: vip ? '#c9a84c' : '#a1a1aa' }}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-black text-white truncate">{(name || 'Cliente').split(' ').slice(0, 2).join(' ')}</p>
          {vip && <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c' }}>VIP</span>}
        </div>
        {meta && <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide truncate mt-0.5">{meta}</p>}
      </div>
      {done ? (
        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-500 shrink-0 px-3"><Check size={13} /> Enviado</span>
      ) : (
        <button onClick={onSend} className="shrink-0 flex items-center gap-1.5 bg-emerald-500 text-zinc-950 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide active:scale-95 transition-transform">
          <Send size={12} /> Enviar
        </button>
      )}
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div className="text-center py-16 bg-zinc-900 rounded-[32px] border border-white/5">
      <p className="text-[11px] font-black uppercase tracking-widest text-zinc-700">{msg}</p>
    </div>
  );
}
