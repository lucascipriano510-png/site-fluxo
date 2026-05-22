import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, MessageCircle, Copy, Check, Phone, DollarSign,
  Zap, Clock, User
} from 'lucide-react';
import { fetchMensagens, updateContatoObservacoes } from '../lib/crm';
import { generateWhatsAppLink } from '../lib/messagingProvider';
import { generateSuggestedReply } from '../lib/assistantService';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const STATUS_LABELS = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Ag. cliente',
  aguardando_pagamento: 'Ag. pgto.',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const AtendimentoDetalhe = ({ atendimento, showToast, onBack, onStatusChange }) => {
  const [mensagens, setMensagens] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const [copied, setCopied] = useState(false);

  const contato = atendimento?.contato || {};
  const sugestao = generateSuggestedReply(atendimento || {});
  const waLink = generateWhatsAppLink(contato.telefone, sugestao);

  useEffect(() => {
    setObservacoes(atendimento?.contato?.observacoes || '');
    if (!atendimento?.id) return;
    fetchMensagens(atendimento.id).then(setMensagens).catch(() => {});
  }, [atendimento?.id, atendimento?.contato?.observacoes]);

  const handleSaveObs = async () => {
    if (!contato.id) return;
    setSavingObs(true);
    try {
      await updateContatoObservacoes(contato.id, observacoes);
      showToast('Observação salva.');
    } catch {
      showToast('Erro ao salvar.', 'error');
    } finally {
      setSavingObs(false);
    }
  };

  const handleCopySugestao = () => {
    navigator.clipboard.writeText(sugestao).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Resposta copiada!');
    });
  };

  if (!atendimento) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 mb-4 active:scale-95">
          <ArrowLeft size={16} />
          <span className="text-[11px] font-black uppercase tracking-widest">Voltar</span>
        </button>
        <p className="text-zinc-600 text-[11px] font-black uppercase">Atendimento não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-6 animate-in space-y-5 pb-32">
      {/* Voltar */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors active:scale-95"
      >
        <ArrowLeft size={16} />
        <span className="text-[11px] font-black uppercase tracking-widest">Voltar</span>
      </button>

      {/* Título + status */}
      <div className="flex justify-between items-start gap-3">
        <h3 className="font-black italic uppercase text-white tracking-widest text-lg">Atendimento</h3>
        <select
          className="px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-[9px] font-black uppercase text-zinc-300 outline-none cursor-pointer shrink-0"
          value={atendimento.status || 'novo'}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Dados do cliente */}
      <div className="bg-zinc-900 rounded-[24px] border border-white/5 p-5 space-y-3">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Cliente</h4>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
            <User size={16} className="text-zinc-500" />
          </div>
          <div>
            <p className="font-black text-white text-sm uppercase">{contato.nome || '—'}</p>
            <p className="text-[11px] text-zinc-500">{contato.telefone || '—'}</p>
          </div>
        </div>
        {contato.origem && (
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <span className="uppercase font-black">Origem:</span>
            <span>{contato.origem}</span>
          </div>
        )}
      </div>

      {/* Dados do pedido */}
      {(contato.produto_interesse || contato.valor_potencial) && (
        <div className="bg-zinc-900 rounded-[24px] border border-white/5 p-5 space-y-3">
          <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Pedido relacionado</h4>
          {contato.produto_interesse && (
            <div className="flex items-start gap-2">
              <Zap size={12} className="text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-[12px] text-white font-bold leading-snug">{contato.produto_interesse}</span>
            </div>
          )}
          {contato.valor_potencial && (
            <div className="flex items-center gap-2">
              <DollarSign size={12} className="text-zinc-500 shrink-0" />
              <span className="text-emerald-400 font-black text-sm">
                {BRL.format(Number(contato.valor_potencial))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Histórico de mensagens */}
      <div className="bg-zinc-900 rounded-[24px] border border-white/5 p-5 space-y-3">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Histórico do sistema</h4>
        {mensagens.length === 0 ? (
          <p className="text-zinc-700 text-[10px] font-black uppercase">Nenhuma mensagem registrada.</p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {mensagens.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-xl text-[11px] border ${
                  m.tipo === 'sistema'
                    ? 'bg-zinc-800/50 border-white/5 text-zinc-500 italic'
                    : m.direcao === 'loja'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 ml-4'
                    : 'bg-zinc-800 border-white/5 text-zinc-300 mr-4'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="leading-relaxed">{m.conteudo}</span>
                  <span className="text-zinc-700 text-[9px] shrink-0">
                    {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resposta sugerida */}
      <div className="bg-zinc-900 rounded-[24px] border border-white/5 p-5 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Resposta sugerida</h4>
          <span className="text-[8px] text-zinc-600 font-black uppercase px-2 py-1 bg-zinc-800 rounded-lg border border-white/5">
            IA Ready
          </span>
        </div>
        <p className="text-[12px] text-zinc-300 leading-relaxed bg-zinc-800/50 p-3 rounded-xl border border-white/5">
          {sugestao}
        </p>
        <button
          onClick={handleCopySugestao}
          className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 border ${
            copied
              ? 'bg-emerald-500 text-zinc-950 border-emerald-500'
              : 'bg-zinc-800 border-white/5 text-zinc-300'
          }`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado!' : 'Copiar resposta'}
        </button>
      </div>

      {/* Observações */}
      <div className="bg-zinc-900 rounded-[24px] border border-white/5 p-5 space-y-3">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Observações</h4>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Adicione notas sobre este atendimento..."
          rows={3}
          className="w-full bg-zinc-800 border border-white/5 rounded-xl p-3 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none focus:border-emerald-500/30 resize-none transition-colors"
        />
        <button
          onClick={handleSaveObs}
          disabled={savingObs}
          className="w-full py-3 bg-zinc-800 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-300 active:scale-95 disabled:opacity-50 transition-all"
        >
          {savingObs ? 'Salvando...' : 'Salvar observação'}
        </button>
      </div>

      {/* Botão principal */}
      <button
        onClick={() => window.open(waLink, '_blank')}
        className="w-full py-4 bg-emerald-500 rounded-[20px] text-[11px] font-black uppercase text-zinc-950 flex items-center justify-center gap-2 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-transform"
      >
        <MessageCircle size={14} /> Abrir WhatsApp
      </button>
    </div>
  );
};

export default AtendimentoDetalhe;
