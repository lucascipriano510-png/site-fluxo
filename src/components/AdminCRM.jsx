import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Phone, DollarSign, Zap, RefreshCcw, ChevronRight, Clock
} from 'lucide-react';
import { fetchAtendimentos, updateAtendimentoStatus } from '../lib/crm';
import { generateWhatsAppLink } from '../lib/messagingProvider';
import AtendimentoDetalhe from './AtendimentoDetalhe';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const STATUS_LIST = [
  { key: 'todos', label: 'Todos' },
  { key: 'novo', label: 'Novo' },
  { key: 'em_atendimento', label: 'Em atend.' },
  { key: 'aguardando_cliente', label: 'Ag. cliente' },
  { key: 'aguardando_pagamento', label: 'Ag. pgto.' },
  { key: 'concluido', label: 'Concluído' },
  { key: 'cancelado', label: 'Cancelado' },
];

const STATUS_STYLE = {
  novo: { text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Novo' },
  em_atendimento: { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Em atendimento' },
  aguardando_cliente: { text: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Ag. cliente' },
  aguardando_pagamento: { text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Ag. pagamento' },
  concluido: { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Concluído' },
  cancelado: { text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Cancelado' },
};

const AdminCRM = ({ showToast, config }) => {
  const [atendimentos, setAtendimentos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedId, setSelectedId] = useState(null);

  const loadAtendimentos = useCallback(async () => {
    try {
      const data = await fetchAtendimentos();
      setAtendimentos(data);
    } catch (err) {
      console.error('[AdminCRM]', err);
      showToast('Erro ao carregar atendimentos.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAtendimentos();
    const interval = setInterval(loadAtendimentos, 30000);
    return () => clearInterval(interval);
  }, [loadAtendimentos]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateAtendimentoStatus(id, newStatus);
      setAtendimentos((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: newStatus, atualizado_em: new Date().toISOString() } : a)
      );
      showToast('Status atualizado.');
    } catch {
      showToast('Erro ao atualizar status.', 'error');
    }
  };

  const filtered = atendimentos.filter(
    (a) => statusFilter === 'todos' || a.status === statusFilter
  );

  // Tela de detalhe do atendimento
  if (selectedId) {
    const atendimento = atendimentos.find((a) => a.id === selectedId);
    return (
      <AtendimentoDetalhe
        atendimento={atendimento}
        config={config}
        showToast={showToast}
        onBack={() => setSelectedId(null)}
        onStatusChange={(newStatus) => handleStatusChange(selectedId, newStatus)}
      />
    );
  }

  return (
    <div className="p-6 animate-in space-y-4 pb-32">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-black italic uppercase text-white tracking-widest text-lg">
          Central de Atendimento
        </h3>
        <button
          onClick={loadAtendimentos}
          className="p-2 text-zinc-500 hover:text-emerald-500 transition-colors active:scale-90"
          title="Atualizar"
        >
          <RefreshCcw size={16} />
        </button>
      </div>

      {/* Filtro de status — scroll horizontal */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6 scrollbar-none">
        {STATUS_LIST.map((s) => {
          const count = s.key === 'todos'
            ? atendimentos.length
            : atendimentos.filter((a) => a.status === s.key).length;
          const isActive = statusFilter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                isActive
                  ? 'bg-white text-zinc-950 border-white shadow-lg'
                  : 'bg-zinc-900 text-zinc-500 border-white/5'
              }`}
            >
              {s.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Lista de atendimentos */}
      {isLoading ? (
        <div className="text-center py-20 text-zinc-700 text-[11px] font-black uppercase tracking-widest">
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900 rounded-[40px] border border-white/5 text-zinc-700 text-[11px] font-black uppercase tracking-widest">
          Nenhum atendimento neste status.
        </div>
      ) : (
        filtered.map((a) => {
          const contato = a.contato || {};
          const style = STATUS_STYLE[a.status] || { text: 'text-zinc-400', bg: 'bg-zinc-800 border-zinc-700', label: a.status };
          const waLink = generateWhatsAppLink(
            contato.telefone,
            `Olá, ${(contato.nome || 'cliente').split(' ')[0]}!`
          );

          return (
            <div key={a.id} className="bg-zinc-900 rounded-[28px] border border-white/5 overflow-hidden shadow-xl">
              <div className="p-5">
                {/* Nome + status badge */}
                <div className="flex justify-between items-start mb-3 gap-2">
                  <h4 className="font-black text-white text-sm uppercase tracking-tight truncate">
                    {contato.nome || '—'}
                  </h4>
                  <span className={`shrink-0 text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                </div>

                {/* Infos */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <Phone size={10} className="text-zinc-600 shrink-0" />
                    <span>{contato.telefone || '—'}</span>
                  </div>
                  {contato.produto_interesse && (
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <Zap size={10} className="text-emerald-500 shrink-0" />
                      <span className="truncate">{contato.produto_interesse}</span>
                    </div>
                  )}
                  {contato.valor_potencial && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <DollarSign size={10} className="text-zinc-600 shrink-0" />
                      <span className="text-emerald-400 font-black">
                        {BRL.format(Number(contato.valor_potencial))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Botões de ação */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => window.open(waLink, '_blank')}
                    className="py-2.5 bg-emerald-500 rounded-xl text-[8px] font-black uppercase text-zinc-950 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    <MessageCircle size={10} /> WhatsApp
                  </button>
                  <select
                    className="py-2.5 bg-zinc-800 rounded-xl text-[8px] font-black uppercase text-zinc-300 text-center border border-white/5 outline-none cursor-pointer active:scale-95"
                    value={a.status || 'novo'}
                    onChange={(e) => handleStatusChange(a.id, e.target.value)}
                  >
                    <option value="novo">Novo</option>
                    <option value="em_atendimento">Em atend.</option>
                    <option value="aguardando_cliente">Ag. cliente</option>
                    <option value="aguardando_pagamento">Ag. pgto.</option>
                    <option value="concluido">Concluído</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  <button
                    onClick={() => setSelectedId(a.id)}
                    className="py-2.5 bg-zinc-800 border border-white/5 rounded-xl text-[8px] font-black uppercase text-zinc-300 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    <ChevronRight size={10} /> Detalhes
                  </button>
                </div>
              </div>

              {/* Timestamp rodapé */}
              <div className="px-5 pb-4 flex items-center gap-1.5 text-zinc-700">
                <Clock size={9} />
                <span className="text-[9px]">
                  {new Date(a.atualizado_em || a.criado_em).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default AdminCRM;
