import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const META_ORIGINS = new Set([
  "https://www.facebook.com",
  "https://web.facebook.com",
  "https://business.facebook.com",
]);

const META_APP_ID = import.meta.env.VITE_META_APP_ID;
const META_CONFIG_ID = import.meta.env.VITE_META_WHATSAPP_CONFIG_ID;
const META_GRAPH_VERSION = import.meta.env.VITE_META_GRAPH_VERSION || "v25.0";

const initialSignup = { code: "", wabaId: "", phoneNumberId: "" };

function parseSignupMessage(event) {
  if (!META_ORIGINS.has(event.origin)) return null;

  let payload = event.data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object" || payload.type !== "WA_EMBEDDED_SIGNUP") return null;

  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const eventName = String(data.event || payload.event || "").toUpperCase();
  return { eventName, data };
}

function StatusIcon({ status }) {
  if (status === "connected") return <CheckCircle2 size={20} aria-hidden="true" />;
  if (status === "error" || status === "cancelled")
    return <CircleAlert size={20} aria-hidden="true" />;
  if (status === "opening" || status === "waiting")
    return <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />;
  return <MessageCircle size={20} aria-hidden="true" />;
}

export default function AdminWhatsAppOnboarding() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Nenhuma conta do WhatsApp conectada por aqui.");
  const signupRef = useRef(initialSignup);
  const sendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session || null);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession),
    );
    return () => {
      active = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!session || !META_APP_ID || !META_CONFIG_ID) return undefined;
    let cancelled = false;
    const existing = document.getElementById("facebook-jssdk");

    window.fbAsyncInit = () => {
      if (!window.FB || cancelled) return;
      window.FB.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: true,
        version: META_GRAPH_VERSION,
      });
      setSdkReady(true);
    };

    if (window.FB) {
      window.fbAsyncInit();
    } else if (!existing) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      document.body.appendChild(script);
    }
    return () => {
      cancelled = true;
    };
  }, [session]);

  const sendOnboarding = useCallback(async () => {
    const { code, wabaId, phoneNumberId } = signupRef.current;
    if (!code || !wabaId || !phoneNumberId || sendingRef.current) return;
    sendingRef.current = true;
    setStatus("waiting");
    setMessage("Concluindo a conexão segura com a Meta…");
    try {
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();
      if (!activeSession?.access_token)
        throw new Error("Sua sessão administrativa expirou. Entre novamente.");
      const response = await fetch("/api/meta/whatsapp/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeSession.access_token}`,
        },
        body: JSON.stringify({ code, waba_id: wabaId, phone_number_id: phoneNumberId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Não foi possível salvar a conexão.");
      setStatus("connected");
      setMessage("WhatsApp conectado e pronto para uso.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Ocorreu um erro ao conectar.");
    } finally {
      sendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      const signup = parseSignupMessage(event);
      if (!signup) return;
      if (signup.eventName === "FINISH") {
        const wabaId = String(signup.data.waba_id || signup.data.wabaId || "");
        const phoneNumberId = String(
          signup.data.phone_number_id || signup.data.phoneNumberId || "",
        );
        if (!wabaId || !phoneNumberId) {
          setStatus("error");
          setMessage("A Meta não enviou os identificadores necessários. Tente novamente.");
          return;
        }
        signupRef.current = { ...signupRef.current, wabaId, phoneNumberId };
        setStatus("waiting");
        setMessage("Dados recebidos da Meta. Confirmando a conexão…");
        sendOnboarding();
      } else if (signup.eventName === "CANCEL") {
        setStatus("cancelled");
        setMessage("A conexão foi cancelada na Meta. Nenhuma alteração foi salva.");
      } else if (signup.eventName === "ERROR") {
        setStatus("error");
        setMessage("A Meta informou um erro no onboarding. Revise a configuração e tente de novo.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sendOnboarding]);

  const startSignup = () => {
    if (!window.FB || !sdkReady || !META_CONFIG_ID) return;
    signupRef.current = initialSignup;
    setStatus("opening");
    setMessage("Abrindo a Meta em uma janela segura…");
    window.FB.login(
      (response) => {
        const code = response?.authResponse?.code;
        if (!code) {
          if (status !== "cancelled") {
            setStatus("cancelled");
            setMessage("A conexão foi cancelada ou não foi autorizada.");
          }
          return;
        }
        signupRef.current = { ...signupRef.current, code };
        setStatus("waiting");
        setMessage("Aguardando a confirmação final da Meta…");
        sendOnboarding();
      },
      {
        config_id: META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
  };

  const login = async (event) => {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setLoginError("Não foi possível entrar com essas credenciais.");
    setLoginLoading(false);
  };

  const statusLabel = {
    idle: "Não conectado",
    opening: "Abrindo Meta",
    waiting: "Aguardando conclusão",
    connected: "Conectado",
    cancelled: "Cancelado",
    error: "Erro",
  }[status];

  if (!authReady) {
    return (
      <main className="min-h-dvh bg-zinc-950 text-zinc-100 grid place-items-center">
        <LoaderCircle className="animate-spin text-emerald-400" aria-label="Carregando" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-dvh bg-zinc-950 px-5 py-10 text-zinc-100 grid place-items-center">
        <section className="w-full max-w-md rounded-2xl bg-zinc-900 p-7 shadow-[0_8px_8px_rgba(0,0,0,0.25)]">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-white"
          >
            <ChevronLeft size={16} /> Voltar à loja
          </a>
          <div className="mt-8 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <ShieldCheck size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight">Conectar WhatsApp</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Área restrita da Fluxo. Entre com a mesma conta usada no painel administrativo.
          </p>
          <form className="mt-6 space-y-4" onSubmit={login}>
            <label className="block text-sm font-semibold">
              E-mail
              <input
                className="mt-1.5 w-full rounded-xl bg-zinc-950 px-4 py-3 text-base outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Senha
              <input
                className="mt-1.5 w-full rounded-xl bg-zinc-950 px-4 py-3 text-base outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {loginError && (
              <p className="text-sm text-red-300" role="alert">
                {loginError}
              </p>
            )}
            <button
              className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-black text-zinc-950 transition-colors hover:bg-emerald-300 disabled:opacity-60"
              disabled={loginLoading}
              type="submit"
            >
              {loginLoading ? "Entrando…" : "Entrar na área administrativa"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const isConfigured = Boolean(META_APP_ID && META_CONFIG_ID);
  return (
    <main className="min-h-dvh bg-zinc-950 px-5 py-8 text-zinc-100 sm:py-12">
      <section className="mx-auto w-full max-w-2xl">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-white"
        >
          <ChevronLeft size={16} /> Voltar à loja
        </a>
        <div className="mt-8 border-b border-white/10 pb-7">
          <div className="flex items-center gap-3 text-emerald-400">
            <MessageCircle size={24} />
            <span className="text-sm font-bold">Administração</span>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Conectar WhatsApp da Fluxo</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-zinc-300">
            Conecte o WhatsApp Business App pelo fluxo oficial de coexistência da Meta. O número
            permanece no app.
          </p>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${status === "connected" ? "bg-emerald-500/15 text-emerald-300" : status === "error" || status === "cancelled" ? "bg-red-500/15 text-red-200" : "bg-zinc-800 text-zinc-200"}`}
            >
              <StatusIcon status={status} />
              {statusLabel}
            </div>
            <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-300" role="status">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={startSignup}
            disabled={!isConfigured || !sdkReady || status === "opening" || status === "waiting"}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 font-black text-zinc-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <MessageCircle size={19} />
            Conectar WhatsApp da Fluxo
          </button>
        </div>

        {!isConfigured && (
          <p className="mt-6 rounded-xl bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
            <CircleAlert className="mr-2 inline-block" size={17} />
            Configure <code>VITE_META_APP_ID</code> e <code>VITE_META_WHATSAPP_CONFIG_ID</code>{" "}
            antes de iniciar.
          </p>
        )}
        <div className="mt-10 border-t border-white/10 pt-5 text-sm leading-6 text-zinc-400">
          A conexão só é salva após a Meta retornar o código, a WABA e o ID do número. Esta tela não
          registra nem migra números diretamente.
        </div>
      </section>
    </main>
  );
}
