import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Bell, ArrowLeft, LogOut } from 'lucide-react';

// Cabeçalho fixo do painel admin: logo, relógio ao vivo, sino de pedidos novos,
// voltar pra loja e sair.
const AdminHeader = ({ handleLogout, handleBackToStore, newOrdersCount = 0, onBell }) => {
  // Relógio ao vivo — sensação de centro de operações
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return (
    <div className="px-4 py-3 flex justify-between items-center sticky top-0 z-50 border-b" style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.06)' }}>
      {/* Logo + título + status online */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#00E08A' }}>
          <LayoutDashboard size={18} style={{ color: '#050505' }} />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-[13px] leading-none uppercase tracking-tight text-white truncate">Master Control</h2>
          <p className="text-[9px] font-medium tracking-wider uppercase flex items-center gap-1 mt-1" style={{ color: '#00E08A' }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inset-0 rounded-full opacity-60" style={{ background: '#00E08A' }} />
              <span className="relative rounded-full h-1.5 w-1.5" style={{ background: '#00E08A' }} />
            </span>
            Online
          </p>
        </div>
      </div>

      {/* Data/hora + notificações + ações */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex flex-col items-end mr-0.5">
          <span className="text-[12px] font-bold text-white leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>{time}</span>
          <span className="text-[9px] mt-0.5" style={{ color: '#71717A' }}>{date}</span>
        </div>
        <button onClick={onBell} className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.06)' }} aria-label="Pedidos novos">
          <Bell size={16} style={{ color: '#A1A1AA' }} />
          {newOrdersCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse" style={{ background: '#FF5A5A', color: '#fff' }}>
              {newOrdersCount > 99 ? '99+' : newOrdersCount}
            </span>
          )}
        </button>
        <button onClick={handleBackToStore} title="Voltar para a loja sem deslogar" className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.06)' }} aria-label="Voltar para a loja" data-testid="admin-back-to-store">
          <ArrowLeft size={16} style={{ color: '#A1A1AA' }} />
        </button>
        <button onClick={handleLogout} className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-zinc-200" style={{ background: '#FFFFFF' }} aria-label="Sair">
          <LogOut size={15} style={{ color: '#050505' }} />
        </button>
      </div>
    </div>
  );
};

export default AdminHeader;
