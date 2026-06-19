// Painel/dashboard do admin (KPIs, grafico de vendas, top produtos).
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShoppingBag, Package, TrendingUp, MessageCircle, ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle, Clock, Flame, Megaphone } from 'lucide-react';
import KpiCard from './KpiCard';
import { formatBRL } from '../lib/format';
const DashboardChart = React.lazy(() => import('./DashboardChart'));

const AdminDashboard = ({ leads, products, loading, setAdminTab }) => {
  const shouldReduceMotion = useReducedMotion();
  const [period, setPeriod] = useState('7d'); // 'today' | '7d' | '30d' | 'month' | 'custom'
  const [customDate, setCustomDate] = useState(null); // Date — dia específico escolhido
  const [showCal, setShowCal] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date());

  // ── HELPERS ───────────────────────────────────────────────────────────
  const CARD  = { background: '#10131A', border: '1px solid rgba(255,255,255,0.06)' };
  const LABEL = { color: '#71717A', letterSpacing: '0.1em' };
  const NUM   = { fontVariantNumeric: 'tabular-nums' };
  const timeAgo = (raw) => {
    if (!raw) return '';
    const m = Math.floor((Date.now() - new Date(raw)) / 60000);
    if (m < 1) return 'agora'; if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`; return `${Math.floor(h/24)}d`;
  };
  const pct = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : null;

  // ── PERIOD BOUNDS ─────────────────────────────────────────────────────
  // Calcula [start, end] do período atual e do período anterior equivalente
  const periodBounds = useMemo(() => {
    const now   = new Date();
    const bod   = new Date(now); bod.setHours(0, 0, 0, 0); // beginning of today
    switch (period) {
      case 'today': {
        const prev = new Date(bod); prev.setDate(prev.getDate() - 1);
        return { start: bod, end: now, prevStart: prev, prevEnd: new Date(bod) };
      }
      case '7d': {
        const start = new Date(bod); start.setDate(start.getDate() - 6);
        const pS    = new Date(start); pS.setDate(pS.getDate() - 7);
        return { start, end: now, prevStart: pS, prevEnd: new Date(start) };
      }
      case '30d': {
        const start = new Date(bod); start.setDate(start.getDate() - 29);
        const pS    = new Date(start); pS.setDate(pS.getDate() - 30);
        return { start, end: now, prevStart: pS, prevEnd: new Date(start) };
      }
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const pS    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const pE    = new Date(start);
        return { start, end: now, prevStart: pS, prevEnd: pE };
      }
      case 'custom': {
        if (!customDate) return { start: bod, end: now, prevStart: null, prevEnd: null };
        const start = new Date(customDate); start.setHours(0, 0, 0, 0);
        const end   = new Date(customDate); end.setHours(23, 59, 59, 999);
        const pS    = new Date(start); pS.setDate(pS.getDate() - 1);
        return { start, end, prevStart: pS, prevEnd: new Date(start) };
      }
      default: return { start: bod, end: now, prevStart: null, prevEnd: null };
    }
  }, [period]);

  // ── FILTERED LEADS ────────────────────────────────────────────────────
  const inRange = (l, s, e) => {
    const raw = l._raw?.created_at; if (!raw) return false;
    const d = new Date(raw); return d >= s && d <= e;
  };
  const periodLeads = useMemo(
    () => (leads || []).filter(l => inRange(l, periodBounds.start, periodBounds.end)),
    [leads, periodBounds]
  );
  const prevLeads = useMemo(
    () => periodBounds.prevStart
      ? (leads || []).filter(l => inRange(l, periodBounds.prevStart, periodBounds.prevEnd))
      : [],
    [leads, periodBounds]
  );

  const periodConcluded = periodLeads.filter(l => l.status === 'CONCLUÍDO');
  const prevConcluded   = prevLeads.filter(l => l.status === 'CONCLUÍDO');

  // ── KPI VALUES ────────────────────────────────────────────────────────
  const periodRevenue  = periodConcluded.reduce((a, l) => a + parseFloat(l.value || 0), 0);
  const prevRevenue    = prevConcluded.reduce((a, l) => a + parseFloat(l.value || 0), 0);
  const periodOrders   = periodLeads.length;
  const prevOrders     = prevLeads.length;
  const periodTicket   = periodConcluded.length > 0 ? periodRevenue / periodConcluded.length : 0;
  const prevTicket     = prevConcluded.length > 0 ? prevRevenue / prevConcluded.length : 0;
  // PROTEÇÃO CONTRA CRASH: (lead.items || []) blinda o sistema contra leads antigos sem items
  const periodItems    = periodConcluded.reduce((a, l) => a + (l.items || []).reduce((s, it) => s + (it.quantity || it.qty || 0), 0), 0);
  const prevItems      = prevConcluded.reduce((a, l) => a + (l.items || []).reduce((s, it) => s + (it.quantity || it.qty || 0), 0), 0);
  const convRate       = periodLeads.length > 0 ? Math.round(periodConcluded.length / periodLeads.length * 100) : 0;
  const prevConvRate   = prevLeads.length > 0 ? Math.round(prevConcluded.length / prevLeads.length * 100) : 0;

  // Globals (sem filtro de período — operacionais sempre)
  const outOfStockProducts = (products || []).filter(p => !p.is_kit && p.stock === 0);
  const pendingLeads       = (leads || []).filter(l => l.status === 'NOVO').length;
  // Manter lógica global para compatibilidade com o resto do app
  const concludedLeads     = (leads || []).filter(l => l.status === 'CONCLUÍDO');
  const totalRevenue       = concludedLeads.reduce((a, b) => a + parseFloat(b.value || 0), 0);
  const avgTicket          = concludedLeads.length > 0 ? totalRevenue / concludedLeads.length : 0;
  const totalItemsSold     = concludedLeads.reduce((acc, l) => acc + (l.items || []).reduce((s, it) => s + (it.quantity || it.qty || 0), 0), 0);

  // ── GRÁFICO ADAPTATIVO ────────────────────────────────────────────────
  // Hoje → 24 barras por hora | 7d/30d/mês → barras por dia
  const chartData = useMemo(() => {
    // bucket: valor/pedidos = concluídos (barra do gráfico); orders/concluded/items = base dos sparklines
    const mk = (key, label) => ({ key, label, valor: 0, pedidos: 0, orders: 0, concluded: 0, items: 0 });
    const itemsOf = (l) => (l.items || []).reduce((s, it) => s + (it.quantity || it.qty || 0), 0);

    if (period === 'today' || period === 'custom') {
      const hours = Array.from({ length: 24 }, (_, i) => mk(i, `${String(i).padStart(2,'0')}h`));
      periodLeads.forEach(l => { const raw = l._raw?.created_at; if (!raw) return; hours[new Date(raw).getHours()].orders += 1; });
      periodConcluded.forEach(l => {
        const raw = l._raw?.created_at; if (!raw) return;
        const b = hours[new Date(raw).getHours()];
        b.valor += Number(l.value || 0); b.pedidos += 1; b.concluded += 1; b.items += itemsOf(l);
      });
      return hours;
    }
    // Dias
    const days = [];
    const cur = new Date(periodBounds.start);
    const end = periodBounds.end;
    while (cur <= end) {
      const key   = cur.toISOString().slice(0,10);
      const label = period === '7d'
        ? cur.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','').toUpperCase().slice(0,3)
        : String(cur.getDate());
      days.push(mk(key, label));
      cur.setDate(cur.getDate() + 1);
    }
    const findDay = (k) => days.find(x => x.key === k);
    periodLeads.forEach(l => { const raw = l._raw?.created_at; if (!raw) return; const d = findDay(new Date(raw).toISOString().slice(0,10)); if (d) d.orders += 1; });
    periodConcluded.forEach(l => {
      const raw = l._raw?.created_at; if (!raw) return;
      const d = findDay(new Date(raw).toISOString().slice(0,10));
      if (d) { d.valor += Number(l.value || 0); d.pedidos += 1; d.concluded += 1; d.items += itemsOf(l); }
    });
    return days;
  }, [period, periodLeads, periodConcluded, periodBounds]);

  // ── SÉRIES DOS SPARKLINES (derivadas dos buckets) ─────────────────────
  const spark = useMemo(() => ({
    orders: chartData.map(b => b.orders),
    ticket: chartData.map(b => (b.concluded ? b.valor / b.concluded : 0)),
    items:  chartData.map(b => b.items),
    conv:   chartData.map(b => (b.orders ? Math.round(b.concluded / b.orders * 100) : 0)),
  }), [chartData]);

  const todayKey   = new Date().toISOString().slice(0,10);
  const currentHour = new Date().getHours();
  const isHourlyPeriod = period === 'today' || period === 'custom';
  const chartHighlightKey = isHourlyPeriod ? currentHour : todayKey;
  const chartInterval = isHourlyPeriod ? 3 : period === '30d' ? 4 : period === 'month' ? 5 : 0;

  // Monta grid do calendário: null = célula vazia, Date = dia
  const buildCalendarDays = (month) => {
    const y = month.getFullYear(), m = month.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    return cells;
  };

  // ── TOP PRODUTOS ──────────────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const map = {};
    periodConcluded.forEach(l => {
      (l.items || []).forEach(it => {
        const name = it.name || 'Produto';
        if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
        const q = it.quantity || it.qty || 1;
        map[name].qty += q;
        map[name].revenue += (it.price || 0) * q;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [periodConcluded]);

  // ── DISTRIBUIÇÃO POR STATUS ───────────────────────────────────────────
  const statusDist = useMemo(() => {
    const total = periodLeads.length || 1;
    const counts = { 'NOVO': 0, 'EM ATENDIMENTO': 0, 'CONCLUÍDO': 0, 'CANCELADO': 0 };
    periodLeads.forEach(l => { const s = l.status || 'NOVO'; counts[s] = (counts[s] || 0) + 1; });
    const statusMeta = {
      'NOVO':           { color: '#00C2FF', label: 'Novos' },
      'EM ATENDIMENTO': { color: '#FFB800', label: 'Em Atend.' },
      'CONCLUÍDO':      { color: '#00E08A', label: 'Concluídos' },
      'CANCELADO':      { color: '#FF5A5A', label: 'Cancelados' },
    };
    return Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([s, c]) => ({ status: s, count: c, pct: Math.round(c / total * 100), ...statusMeta[s] }));
  }, [periodLeads]);

  // ── HORÁRIO DE PICO ───────────────────────────────────────────────────
  const peakHour = useMemo(() => {
    const hours = Array(24).fill(0);
    concludedLeads.forEach(l => {
      const raw = l._raw?.created_at; if (!raw) return;
      hours[new Date(raw).getHours()] += Number(l.value || 0);
    });
    const max = Math.max(...hours);
    if (max === 0) return null;
    const h = hours.indexOf(max);
    return `${String(h).padStart(2,'0')}h–${String(h+1).padStart(2,'0')}h`;
  }, [concludedLeads]);

  // ── STATUS OPERACIONAL ────────────────────────────────────────────────
  const opStatus = (() => {
    if (outOfStockProducts.length > 0 && pendingLeads > 0)
      return { label: `${pendingLeads} pendente(s) · ${outOfStockProducts.length} sem estoque`, color: '#FFB800' };
    if (outOfStockProducts.length > 0)
      return { label: `${outOfStockProducts.length} produto(s) sem estoque`, color: '#FF5A5A' };
    if (pendingLeads > 0)
      return { label: `${pendingLeads} pedido(s) aguardando atendimento`, color: '#FFB800' };
    const d = pct(periodRevenue, prevRevenue);
    if (d !== null && d > 0) return { label: `Vendas ${d}% acima do período anterior`, color: '#00E08A' };
    return { label: 'Operação funcionando normalmente', color: '#00E08A' };
  })();

  // ── INSIGHTS DINÂMICOS ────────────────────────────────────────────────
  const insights = useMemo(() => {
    const list = [];
    if (outOfStockProducts.length > 0)
      list.push({ icon: <AlertTriangle size={12}/>, color: '#FF5A5A', bg: 'rgba(255,90,90,0.08)', border: 'rgba(255,90,90,0.15)',
        label: 'Estoque crítico', desc: outOfStockProducts.slice(0,2).map(p => p.name).join(', ') + (outOfStockProducts.length > 2 ? ` +${outOfStockProducts.length-2}` : ''), action: 'Ver Estoque', tab: 'inventory' });
    if (pendingLeads > 0)
      list.push({ icon: <Clock size={12}/>, color: '#FFB800', bg: 'rgba(255,184,0,0.08)', border: 'rgba(255,184,0,0.15)',
        label: `${pendingLeads} pedido(s) novo(s)`, desc: 'Aguardando atendimento', action: 'Atender', tab: 'leads' });
    const revDelta = pct(periodRevenue, prevRevenue);
    if (revDelta !== null && revDelta > 10)
      list.push({ icon: <TrendingUp size={12}/>, color: '#00E08A', bg: 'rgba(0,224,138,0.08)', border: 'rgba(0,224,138,0.15)',
        label: `+${revDelta}% vs período anterior`, desc: 'Receita acima da média', action: null, tab: null });
    if (peakHour)
      list.push({ icon: <Flame size={12}/>, color: '#FFB800', bg: 'rgba(255,184,0,0.08)', border: 'rgba(255,184,0,0.15)',
        label: `Pico de vendas: ${peakHour}`, desc: 'Melhor horário histórico', action: null, tab: null });
    if (list.length === 0)
      list.push({ icon: <CheckCircle2 size={12}/>, color: '#00C2FF', bg: 'rgba(0,194,255,0.08)', border: 'rgba(0,194,255,0.15)',
        label: 'Sem alertas ativos', desc: 'Tudo sob controle', action: null, tab: null });
    return list;
  }, [outOfStockProducts, pendingLeads, periodRevenue, prevRevenue, peakHour]);

  // ── MOTION VARIANTS ───────────────────────────────────────────────────
  const fadeUp = shouldReduceMotion ? {} : { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.055 } } };

  // ── SKELETON ──────────────────────────────────────────────────────────
  const sk = 'bg-[length:200%_100%] bg-gradient-to-r from-[#10131A] via-[#1c2030] to-[#10131A] animate-[skeleton-shine_1.5s_ease-in-out_infinite]';
  if (loading) return (
    <div className="p-4 space-y-3 pb-32">
      <div className={`h-10 rounded-2xl ${sk}`} />
      <div className={`h-10 rounded-2xl ${sk}`} />
      <div className="grid grid-cols-2 gap-2">
        <div className={`col-span-2 h-20 rounded-2xl ${sk}`} />
        {[0,1,2,3].map(i => <div key={i} className={`h-20 rounded-2xl ${sk}`} />)}
      </div>
      <div className={`h-40 rounded-2xl ${sk}`} />
      <div className={`h-32 rounded-2xl ${sk}`} />
      <div className={`h-48 rounded-2xl ${sk}`} />
    </div>
  );

  // Labels
  const customLabel = customDate
    ? customDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : 'Dia';
  const periodLabel = { today: 'Hoje', '7d': '7 dias', '30d': '30 dias', month: 'Este mês', custom: customLabel }[period] ?? '7 dias';
  const chartTitle  = isHourlyPeriod ? `Vendas · ${periodLabel} (por hora)` : `Vendas · ${periodLabel}`;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="p-4 space-y-3 pb-32">

      {/* ── 1. STATUS GERAL ── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={CARD}>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inset-0 rounded-full opacity-60" style={{ background: opStatus.color }} />
            <span className="relative rounded-full h-2 w-2" style={{ background: opStatus.color }} />
          </span>
          <p className="text-[11px] font-medium flex-1" style={{ color: opStatus.color }}>{opStatus.label}</p>
          <span className="text-[9px] font-medium" style={{ color: '#71717A' }}>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </motion.div>

      {/* ── 2. FILTRO DE PERÍODO ── */}
      <motion.div variants={fadeUp}>
        <div className="flex gap-1.5 p-1 rounded-2xl" style={{ background: '#10131A', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[['today','Hoje'],['7d','7D'],['30d','30D'],['month','Mês']].map(([val, lbl]) => (
            <motion.button
              key={val}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPeriod(val)}
              className="flex-1 py-2 rounded-xl text-[11px] font-semibold transition-colors"
              style={{ background: period === val ? '#00E08A' : 'transparent', color: period === val ? '#050505' : '#71717A' }}
            >
              {lbl}
            </motion.button>
          ))}
          {/* Botão calendário */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCal(true)}
            className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-colors"
            style={{
              background: period === 'custom' ? '#00E08A' : 'transparent',
              color: period === 'custom' ? '#050505' : '#71717A',
              minWidth: 44,
            }}
          >
            {period === 'custom' ? customLabel : <Clock size={13}/>}
          </motion.button>
        </div>
      </motion.div>

      {/* ── 3. KPIs ── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2">

        {/* Faturamento — full width (sparkline omitido: gráfico adaptativo logo abaixo) */}
        <KpiCard
          fullWidth
          label={`Faturamento · ${periodLabel}`}
          value={formatBRL(periodRevenue)}
          valueSize="2rem"
          cur={periodRevenue}
          prev={prevRevenue}
        />

        {/* Pedidos */}
        <KpiCard
          label="Pedidos"
          value={periodOrders}
          cur={periodOrders}
          prev={prevOrders}
          series={spark.orders}
        />

        {/* Ticket Médio */}
        <KpiCard
          label="Ticket Médio"
          value={formatBRL(periodTicket)}
          valueColor="#00E08A"
          cur={periodTicket}
          prev={prevTicket}
          series={spark.ticket}
        />

        {/* Peças Vendidas */}
        <KpiCard
          label="Peças Vendidas"
          value={periodItems}
          cur={periodItems}
          prev={prevItems}
          series={spark.items}
        />

        {/* Taxa de Conversão */}
        <KpiCard
          label="Conversão"
          value={`${convRate}%`}
          valueColor={convRate >= 50 ? '#00E08A' : convRate >= 25 ? '#FFB800' : '#FF5A5A'}
          accent={convRate >= 50 ? '#00E08A' : convRate >= 25 ? '#FFB800' : '#FF5A5A'}
          cur={convRate}
          prev={prevConvRate}
          series={spark.conv}
        />

        {/* Sem Estoque — global, snapshot (sem série temporal) */}
        <KpiCard
          label="Sem Estoque"
          value={outOfStockProducts.length}
          valueColor={outOfStockProducts.length > 0 ? '#FF5A5A' : '#FFFFFF'}
          borderColor={outOfStockProducts.length > 0 ? 'rgba(255,90,90,0.25)' : undefined}
        />

      </motion.div>

      {/* ── 4. GRÁFICO ADAPTATIVO ── */}
      <motion.div variants={fadeUp} className="rounded-2xl p-4" style={CARD}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-medium uppercase" style={LABEL}>{chartTitle}</p>
          <span className="text-[11px] font-semibold" style={{ color: '#00E08A' }}>{formatBRL(periodRevenue)}</span>
        </div>
        <React.Suspense fallback={<div className="h-[80px]" />}>
          <DashboardChart data={chartData} interval={chartInterval} highlightKey={chartHighlightKey} />
        </React.Suspense>
      </motion.div>

      {/* ── 5. DISTRIBUIÇÃO POR STATUS ── */}
      {periodLeads.length > 0 && (
        <motion.div variants={fadeUp} className="rounded-2xl p-4" style={CARD}>
          <p className="text-[10px] font-medium uppercase mb-3" style={LABEL}>Funil de Pedidos · {periodLabel}</p>
          <div className="space-y-2.5">
            {statusDist.map(({ status, count, pct: p, color, label }) => (
              <div key={status}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
                  <span className="text-[10px] font-semibold" style={{ color: '#A1A1AA' }}>{count} · {p}%</span>
                </div>
                <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    className="h-1 rounded-full"
                    style={{ background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── 6. TOP PRODUTOS ── */}
      {topProducts.length > 0 && (
        <motion.div variants={fadeUp} className="rounded-2xl p-4" style={CARD}>
          <p className="text-[10px] font-medium uppercase mb-3" style={LABEL}>Top Produtos · {periodLabel}</p>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] font-bold w-4 text-center shrink-0" style={{ color: i === 0 ? '#00E08A' : '#71717A' }}>#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white truncate">{p.name}</p>
                  <div className="h-0.5 mt-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(p.qty / topProducts[0].qty * 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 * i }}
                      className="h-0.5 rounded-full"
                      style={{ background: i === 0 ? '#00E08A' : 'rgba(0,224,138,0.4)' }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-semibold shrink-0" style={{ color: '#A1A1AA' }}>{p.qty} pçs</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── 7. INSIGHTS ── */}
      <motion.div variants={fadeUp} className="space-y-2">
        <p className="text-[10px] font-medium uppercase px-0.5" style={LABEL}>Insights</p>
        {insights.map((ins, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: ins.bg, border: `1px solid ${ins.border}` }}>
            <span style={{ color: ins.color }}>{ins.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: ins.color }}>{ins.label}</p>
              <p className="text-[10px]" style={{ color: '#71717A' }}>{ins.desc}</p>
            </div>
            {ins.action && setAdminTab && (
              <motion.button whileTap={{ scale: 0.94 }} onClick={() => setAdminTab(ins.tab)}
                className="text-[10px] font-semibold px-3 py-1.5 rounded-xl shrink-0"
                style={{ color: ins.color, background: `${ins.color}18`, border: `1px solid ${ins.color}30` }}>
                {ins.action}
              </motion.button>
            )}
          </div>
        ))}
      </motion.div>

      {/* ── 8. AÇÕES RÁPIDAS ── */}
      <motion.div variants={fadeUp}>
        <p className="text-[10px] font-medium uppercase px-0.5 mb-2" style={LABEL}>Ações Rápidas</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Novo Produto', icon: <Package size={14}/>, tab: 'inventory' },
            { label: 'Pedidos',      icon: <ShoppingBag size={14}/>, tab: 'leads', badge: pendingLeads > 0 ? pendingLeads : null },
            { label: 'Promoções',   icon: <Megaphone size={14}/>, tab: 'banners' },
            { label: 'Atendimento', icon: <MessageCircle size={14}/>, tab: 'crm' },
          ].map(a => (
            <motion.button key={a.tab} whileTap={{ scale: 0.96 }} onClick={() => setAdminTab?.(a.tab)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-left relative touch-manipulation" style={CARD}>
              <span style={{ color: '#00E08A' }}>{a.icon}</span>
              <span className="text-[11px] font-medium" style={{ color: '#A1A1AA' }}>{a.label}</span>
              {a.badge && <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FF5A5A', color: '#fff' }}>{a.badge}</span>}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── 9. PEDIDOS RECENTES ── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between px-0.5 mb-2">
          <p className="text-[10px] font-medium uppercase" style={LABEL}>Pedidos Recentes</p>
          {setAdminTab && <button onClick={() => setAdminTab('leads')} className="text-[10px] font-semibold" style={{ color: '#00E08A' }}>Ver todos</button>}
        </div>
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          {(leads || []).slice(0, 5).length === 0 ? (
            <div className="p-6 text-center"><p className="text-[11px]" style={{ color: '#71717A' }}>Nenhum pedido ainda.</p></div>
          ) : (
            (leads || []).slice(0, 5).map((l, i, arr) => {
              const initial = (l.name || '?').trim().charAt(0).toUpperCase();
              const st = l.status || 'NOVO';
              const stStyle = st === 'NOVO' ? { color: '#00C2FF', bg: 'rgba(0,194,255,0.12)' }
                : st === 'CONCLUÍDO'        ? { color: '#00E08A', bg: 'rgba(0,224,138,0.12)' }
                : st === 'CANCELADO'        ? { color: '#FF5A5A', bg: 'rgba(255,90,90,0.12)' }
                :                            { color: '#FFB800', bg: 'rgba(255,184,0,0.12)' };
              return (
                <motion.div key={i} whileTap={{ backgroundColor: 'rgba(255,255,255,0.015)' }}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ background: 'rgba(0,224,138,0.08)', color: '#00E08A' }}>{initial}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">{(l.name || 'Desconhecido').split(' ')[0]}</p>
                    <p className="text-[10px]" style={{ color: '#71717A' }}>#{l.orderNumber || '0000'}{l._raw?.created_at ? ` · ${timeAgo(l._raw.created_at)}` : ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[12px] font-semibold text-white" style={NUM}>{formatBRL(l.value || 0)}</span>
                    <span className="text-[9px] font-semibold uppercase rounded-lg px-2 py-0.5" style={{ color: stStyle.color, background: stStyle.bg }}>{st}</span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* ── CALENDÁRIO BOTTOM SHEET ── */}
      <AnimatePresence>
        {showCal && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cal-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setShowCal(false)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.65)' }}
            />
            {/* Sheet */}
            <motion.div
              key="cal-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
              style={{ background: '#10131A', border: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div className="px-4 pb-4">
                {/* Mês nav */}
                <div className="flex items-center justify-between py-3">
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <ChevronLeft size={16} style={{ color: '#A1A1AA' }}/>
                  </motion.button>
                  <span className="text-[13px] font-semibold capitalize" style={{ color: '#FFFFFF' }}>
                    {calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </span>
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <ChevronRight size={16} style={{ color: '#A1A1AA' }}/>
                  </motion.button>
                </div>

                {/* Dias da semana */}
                <div className="grid grid-cols-7 mb-1">
                  {['D','S','T','Q','Q','S','S'].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-semibold py-1" style={{ color: '#71717A' }}>{d}</div>
                  ))}
                </div>

                {/* Grade de dias */}
                <div className="grid grid-cols-7 gap-y-0.5">
                  {buildCalendarDays(calMonth).map((d, i) => {
                    if (!d) return <div key={i} />;
                    const todayD    = new Date(); todayD.setHours(0,0,0,0);
                    const isToday   = d.getTime() === todayD.getTime();
                    const isSel     = customDate && d.toDateString() === customDate.toDateString();
                    const isFuture  = d > new Date();
                    return (
                      <motion.button
                        key={i}
                        whileTap={isFuture ? {} : { scale: 0.88 }}
                        disabled={isFuture}
                        onClick={() => { setCustomDate(d); setPeriod('custom'); setShowCal(false); }}
                        className="aspect-square flex items-center justify-center rounded-xl text-[12px] font-medium mx-0.5 my-0.5"
                        style={{
                          background: isSel ? '#00E08A' : isToday ? 'rgba(0,224,138,0.15)' : 'transparent',
                          color: isSel ? '#050505' : isToday ? '#00E08A' : isFuture ? 'rgba(255,255,255,0.18)' : '#FFFFFF',
                          fontWeight: isToday || isSel ? 700 : 400,
                        }}
                      >
                        {d.getDate()}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-[11px]" style={{ color: '#71717A' }}>
                    {customDate
                      ? customDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                      : 'Selecione um dia'}
                  </span>
                  {customDate && (
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => { setCustomDate(null); setPeriod('7d'); setShowCal(false); }}
                      className="text-[10px] font-semibold px-3 py-1.5 rounded-xl"
                      style={{ color: '#FF5A5A', background: 'rgba(255,90,90,0.1)' }}>
                      Limpar
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default AdminDashboard;
