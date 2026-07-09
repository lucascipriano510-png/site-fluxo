import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, MessageCircle, User, X } from 'lucide-react';
import { formatBRL } from '../lib/format';

// Extraído do App.jsx (verbatim) — recebe estado/handlers do App por props.
const UserDrawerOverlay = ({
  accountToken,
  authForm,
  authLoading,
  authMode,
  config,
  drawerTab,
  handleAuthSubmit,
  handleSearchMyOrders,
  myOrdersLoading,
  myOrdersResults,
  recoveryToShow,
  sairDaConta,
  saveUserProfile,
  setAuthForm,
  setAuthMode,
  setCurrentLead,
  setDrawerTab,
  setMyOrdersPhone,
  setMyOrdersResults,
  setRecoveryToShow,
  setShowUserDrawer,
  showToast,
  showUserDrawer,
  userProfile,
  viewportOverlayStyle,
  viewportPanelMaxHeight,
}) => (
<AnimatePresence>
      {showUserDrawer && (
        <motion.div
          key="user-drawer-overlay"
          className="fixed inset-x-0 z-[200] flex items-end justify-center overflow-hidden"
          style={viewportOverlayStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={() => setShowUserDrawer(false)}
          />

          {/* Panel */}
          <motion.div
            className="relative bg-zinc-950 w-full max-w-md rounded-t-[40px] border-t border-white/10 shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: viewportPanelMaxHeight }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Drag handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full pointer-events-none z-10" />

            {/* Fechar */}
            <button
              onClick={() => setShowUserDrawer(false)}
              className="absolute top-4 right-4 z-20 text-white bg-black/50 backdrop-blur-md rounded-full p-2.5 touch-manipulation border border-white/10 active:scale-90 transition-transform"
            >
              <X size={18} />
            </button>

            {/* Header do drawer */}
            <div className="px-7 pt-10 pb-5 shrink-0">
              {userProfile && accountToken ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-center shrink-0">
                    <span className="text-lg font-black text-emerald-400 leading-none select-none">
                      {userProfile.name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">Usuário Fluxo</p>
                    <h3 className="text-lg font-black text-white uppercase leading-tight truncate">
                      {userProfile.name.split(' ')[0]}
                    </h3>
                    <p className="text-[11px] font-bold text-zinc-500 mt-0.5">+55 {userProfile.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                    <User size={24} className="text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Bem-vindo</p>
                    <h3 className="text-lg font-black text-white uppercase leading-tight">Minha Conta</h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5 font-bold">Entre ou crie sua conta Fluxo</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs — só aparece se LOGADO (conta com senha) */}
            {userProfile && accountToken && (
              <div className="px-5 pb-3 shrink-0">
                <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-2xl border border-white/5">
                  <button
                    onClick={() => setDrawerTab('profile')}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      drawerTab === 'profile'
                        ? 'bg-white text-zinc-950 shadow'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Perfil
                  </button>
                  <button
                    onClick={() => {
                      setDrawerTab('orders');
                      if (myOrdersResults === null) {
                        setTimeout(() => handleSearchMyOrders(), 100);
                      }
                    }}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      drawerTab === 'orders'
                        ? 'bg-emerald-500 text-zinc-950 shadow'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Pedidos
                  </button>
                </div>
              </div>
            )}

            {/* Corpo scrollável */}
            <div className="flex-1 overflow-y-auto px-7 pb-10 pt-2 space-y-4">

              {/* TAB PERFIL / AUTENTICAÇÃO (conta com senha) */}
              {(drawerTab === 'profile' || !(userProfile && accountToken)) && (
                <div className="space-y-4 animate-in">

                  {recoveryToShow ? (
                    /* ── Código de recuperação recém-gerado: mostrado UMA vez ── */
                    <div className="space-y-4">
                      <div className="rounded-2xl border-2 border-dashed border-amber-400/40 bg-amber-400/[0.06] p-5 text-center space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Seu código de recuperação</p>
                        <p className="text-2xl font-black tracking-[0.12em] text-amber-400" data-testid="recovery-code">{recoveryToShow}</p>
                      </div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide leading-relaxed">
                        Anota ou tira print AGORA: é ele que devolve sua conta se você esquecer a senha. Ele não aparece de novo.
                      </p>
                      <button
                        onClick={() => { setRecoveryToShow(null); setDrawerTab('orders'); setTimeout(() => handleSearchMyOrders(), 100); }}
                        className="w-full py-4 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform touch-manipulation shadow-[0_10px_30px_rgba(16,185,129,0.2)]"
                        data-testid="btn-recovery-ok"
                      >
                        Anotei — entrar na minha conta
                      </button>
                    </div>
                  ) : userProfile && accountToken ? (
                    /* ── LOGADO: perfil + sair ── */
                    <>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Nome completo</label>
                          <input
                            className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/30 client-input"
                            value={userProfile.name}
                            onChange={e => saveUserProfile({ ...userProfile, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">WhatsApp da conta</label>
                          <input
                            className="w-full p-4 bg-zinc-900/60 border border-white/5 rounded-xl text-[16px] font-bold text-zinc-500 outline-none client-input"
                            value={userProfile.phone}
                            readOnly
                            title="O WhatsApp é a identidade da conta — pra trocar, fale com a loja."
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          sairDaConta();
                          setMyOrdersResults(null);
                          setMyOrdersPhone('');
                          setCurrentLead({ name: '', phone: '' });
                          setShowUserDrawer(false);
                          showToast('Você saiu da conta.', 'success');
                        }}
                        className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform touch-manipulation flex items-center justify-center gap-2"
                      >
                        <LogOut size={14} /> Sair da Conta Fluxo
                      </button>
                    </>
                  ) : (
                    /* ── DESLOGADO: entrar / criar conta / recuperar senha ── */
                    <>
                      {userProfile && !accountToken && (
                        <div className="p-3 rounded-xl bg-amber-400/[0.07] border border-amber-400/20 text-[10px] font-bold text-amber-300/90 uppercase tracking-wide leading-relaxed">
                          Novidade: sua conta Fluxo agora tem senha. Crie a sua pra proteger seus pedidos — leva 20 segundos.
                        </div>
                      )}

                      {authMode !== 'recover' ? (
                        <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-2xl border border-white/5">
                          <button
                            onClick={() => setAuthMode('login')}
                            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-white text-zinc-950 shadow' : 'text-zinc-500 hover:text-white'}`}
                            data-testid="auth-tab-login"
                          >Entrar</button>
                          <button
                            onClick={() => setAuthMode('signup')}
                            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'signup' ? 'bg-white text-zinc-950 shadow' : 'text-zinc-500 hover:text-white'}`}
                            data-testid="auth-tab-signup"
                          >Criar conta</button>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">
                          Recuperar acesso: informe seu WhatsApp, o código de recuperação que você guardou e a senha nova.
                        </p>
                      )}

                      <div className="space-y-3">
                        {authMode === 'signup' && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Nome completo</label>
                            <input
                              placeholder="Ex: João Silva"
                              className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/30 client-input"
                              value={authForm.name}
                              onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))}
                              data-testid="auth-name"
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">WhatsApp (com DDD)</label>
                          <input
                            placeholder="Ex: 34999999999"
                            type="tel"
                            className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/30 client-input"
                            value={authForm.phone}
                            onChange={e => setAuthForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                            data-testid="auth-phone"
                          />
                        </div>
                        {authMode === 'recover' && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Código de recuperação</label>
                            <input
                              placeholder="FLX-XXXX-XXXX"
                              className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-black tracking-widest text-amber-400 outline-none focus:border-amber-400/40 client-input uppercase"
                              value={authForm.recovery}
                              onChange={e => setAuthForm(f => ({ ...f, recovery: e.target.value.toUpperCase() }))}
                              data-testid="auth-recovery"
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">{authMode === 'recover' ? 'Senha nova' : 'Senha'}</label>
                          <input
                            placeholder={authMode === 'signup' ? 'Crie uma senha (mín. 6)' : 'Sua senha'}
                            type="password"
                            className="w-full p-4 bg-zinc-900 border border-white/5 rounded-xl text-[16px] font-bold text-white outline-none focus:border-emerald-500/30 client-input"
                            value={authForm.password}
                            onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleAuthSubmit(); }}
                            data-testid="auth-password"
                          />
                        </div>
                      </div>

                      {authMode === 'signup' && (
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide leading-relaxed">
                          Junto com a conta você recebe um código de recuperação — guarda ele, é sua chave reserva.
                        </p>
                      )}

                      <button
                        onClick={handleAuthSubmit}
                        disabled={authLoading}
                        className="w-full py-4 bg-emerald-500 text-zinc-950 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform touch-manipulation shadow-[0_10px_30px_rgba(16,185,129,0.2)] disabled:opacity-60"
                        data-testid="auth-submit"
                      >
                        {authLoading ? 'Processando...' : authMode === 'login' ? 'Entrar na minha conta' : authMode === 'signup' ? 'Criar minha conta' : 'Redefinir senha e entrar'}
                      </button>

                      {authMode === 'login' && (
                        <button onClick={() => setAuthMode('recover')} className="w-full py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 touch-manipulation" data-testid="auth-forgot">
                          Esqueci minha senha
                        </button>
                      )}
                      {authMode === 'recover' && (
                        <>
                          <a
                            href={`https://wa.me/${String(config?.whatsapp || '5534984148067').replace(/\D/g, '')}?text=${encodeURIComponent('Oi! Perdi o acesso da minha conta no site da Fluxo (esqueci a senha e o código de recuperação). Podem me ajudar a recuperar?')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border border-[#25D366] text-[#25D366] text-[10px] font-black uppercase tracking-widest touch-manipulation"
                          >
                            <MessageCircle size={13} /> Perdi o código — recuperar pelo WhatsApp
                          </a>
                          <button onClick={() => setAuthMode('login')} className="w-full py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 touch-manipulation">
                            Voltar pro login
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB PEDIDOS */}
              {drawerTab === 'orders' && userProfile && accountToken && (
                <div className="space-y-3 animate-in">
                  {myOrdersLoading && (
                    <div className="text-center py-10 text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                      Buscando pedidos...
                    </div>
                  )}
                  {!myOrdersLoading && myOrdersResults === null && (
                    <div className="text-center py-10 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                      Carregando...
                    </div>
                  )}
                  {!myOrdersLoading && myOrdersResults !== null && myOrdersResults.length === 0 && (
                    <div className="text-center py-10 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                      Nenhum pedido encontrado para este número.
                    </div>
                  )}
                  {!myOrdersLoading && (myOrdersResults || []).map((row) => {
                    const its = typeof row.items === 'string'
                      ? (() => { try { return JSON.parse(row.items); } catch { return []; } })()
                      : (row.items || []);
                    const st = String(row.status || 'NOVO').toUpperCase();
                    const stMap = { 'CONFIRMED': 'CONCLUÍDO', 'CONCLUIDO': 'CONCLUÍDO', 'CANCELLED': 'CANCELADO' };
                    const status = stMap[st] || st;
                    const color = status === 'CONCLUÍDO'
                      ? 'text-emerald-500 bg-emerald-500/10'
                      : status === 'CANCELADO'
                        ? 'text-red-500 bg-red-500/10'
                        : status === 'EM ATENDIMENTO'
                          ? 'text-amber-500 bg-amber-500/10'
                          : 'text-blue-500 bg-blue-500/10';
                    return (
                      <div key={row.id} className="bg-zinc-900 rounded-2xl p-4 border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black uppercase text-white">#{row.order_number}</span>
                          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${color}`}>{status}</span>
                        </div>
                        <div className="text-[9px] text-zinc-500 font-bold uppercase mb-2">
                          {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : ''}
                        </div>
                        <div className="space-y-1">
                          {(its || []).map((it, i) => (
                            <div key={i} className="text-[10px] text-zinc-300 font-bold flex justify-between">
                              <span className="truncate pr-2">{it.qty || 1}x {it.name} <span className="text-emerald-500">({it.size || 'U'})</span></span>
                              <span className="text-zinc-500 shrink-0">{formatBRL(it.price || 0)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/5">
                          <span className="text-[9px] text-zinc-500 font-black uppercase">Total</span>
                          <span className="text-[13px] font-black text-emerald-500">{formatBRL(row.value || 0)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
);

export default UserDrawerOverlay;
