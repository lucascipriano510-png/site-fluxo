// Gráfico do dashboard admin isolado num módulo próprio.
// Carregado via React.lazy só quando o admin abre — assim o recharts (~400KB)
// NÃO entra no bundle inicial da loja (cliente nunca baixa).
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip as ReTooltip, Cell } from 'recharts';

export default function DashboardChart({ data = [], interval, highlightKey }) {
  return (
    <div className="h-[80px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="label" interval={interval} tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.28)', fontWeight: 500 }} axisLine={false} tickLine={false} />
          <ReTooltip
            cursor={{ fill: 'rgba(0,224,138,0.04)' }}
            contentStyle={{ background: '#0B0D12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11, fontWeight: 600 }}
            labelStyle={{ color: '#71717A' }}
            formatter={(v, n, { payload }) => [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · ${payload.pedidos} pedido(s)`, '']}
          />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive animationBegin={0} animationDuration={700} maxBarSize={28}>
            {data.map((e, i) => (
              <Cell key={i} fill={e.key === highlightKey ? '#00E08A' : e.valor > 0 ? 'rgba(0,224,138,0.3)' : 'rgba(255,255,255,0.04)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
