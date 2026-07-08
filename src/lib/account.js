// =====================================================================
// FLUXO OUTLET — Conta do site (telefone + senha)
// Fala com a edge function site-account. A senha NUNCA passa por aqui em
// texto além do POST (o hash acontece no servidor); o que fica no
// navegador é só o token de sessão assinado (90 dias).
// =====================================================================
import { supabase } from './supabaseClient';

const SESSION_KEY = '@fluxo-outlet:session';

const callAccount = async (body) => {
  const { data, error } = await supabase.functions.invoke('site-account', { body });
  if (error) {
    // supabase-js embrulha respostas não-2xx: o motivo real está no corpo
    let msg = 'Erro de conexão. Tenta de novo em instantes.';
    try {
      const j = await error.context?.json();
      if (j?.error) msg = j.error;
    } catch {}
    const e = new Error(msg);
    e.status = error.context?.status;
    throw e;
  }
  return data;
};

export const getSessionToken = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.token || null; } catch { return null; }
};

export const saveSession = (token) => {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ token })); } catch {}
};

export const clearSession = () => {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
};

export const registerAccount = ({ phone, name, password }) =>
  callAccount({ action: 'register', phone, name, password });

export const loginAccount = ({ phone, password }) =>
  callAccount({ action: 'login', phone, password });

export const recoverAccount = ({ phone, recovery, newPassword }) =>
  callAccount({ action: 'recover', phone, recovery, newPassword });

export const fetchAccountOrders = (token) =>
  callAccount({ action: 'orders', token });

export const fetchAccountProfile = (token) =>
  callAccount({ action: 'me', token });
