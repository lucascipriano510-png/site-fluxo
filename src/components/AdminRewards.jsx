import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  Check,
  ClipboardList,
  Copy,
  Download,
  Gift,
  LoaderCircle,
  LockKeyhole,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { drawCard } from "../lib/rewardsCard";

const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
const dateBR = (value) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value)) : "—";
const digits = (value) => String(value || "").replace(/\D/g, "");
const statusLabel = {
  ACTIVE: "Ativo",
  REDEEMED: "Resgatado",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
};
const statusColor = {
  ACTIVE: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  REDEEMED: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  EXPIRED: "border-zinc-600/40 bg-zinc-700/30 text-zinc-400",
  CANCELLED: "border-rose-400/20 bg-rose-400/10 text-rose-300",
};

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

function SectionTitle({ icon: Icon, eyebrow, title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-[#c6a463]">
          <Icon size={14} />
          {eyebrow}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusColor[status] || statusColor.EXPIRED}`}
    >
      {statusLabel[status] || status}
    </span>
  );
}

export default function AdminRewards({ showToast }) {
  const [tab, setTab] = useState("issue");
  const [settings, setSettings] = useState({
    discount_percent: 15,
    validity_days: 30,
    capped_from_cycle: 3,
    max_discount: 30,
  });
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [issued, setIssued] = useState(null);
  const [historySearch, setHistorySearch] = useState("");
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [code, setCode] = useState("");
  const [validation, setValidation] = useState(null);
  const [redemptionCustomer, setRedemptionCustomer] = useState(null);
  const [subtotal, setSubtotal] = useState("");

  const toast = useCallback(
    (message) => {
      setNotice(message);
      showToast?.(message);
      window.setTimeout(() => setNotice(""), 3500);
    },
    [showToast],
  );

  const loadCustomers = useCallback(async (search = "") => {
    try {
      const result = await rpc("loyalty_search_customers", { p_search: search });
      setCustomers(Array.isArray(result) ? result : []);
    } catch (error) {
      setPageError(error.message || "Não foi possível consultar os clientes.");
    }
  }, []);

  const loadRewards = useCallback(async (search = "") => {
    try {
      const result = await rpc("loyalty_list_rewards", { p_search: search });
      setRewards(Array.isArray(result) ? result : []);
    } catch (error) {
      setPageError(error.message || "Não foi possível consultar o histórico.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    rpc("loyalty_get_settings")
      .then((value) => {
        if (alive && value) {
          setSettings(value);
          setSettingsDraft(value);
        }
      })
      .catch(
        (error) => alive && setPageError(error.message || "Não foi possível carregar as regras."),
      );
    loadCustomers("");
    return () => {
      alive = false;
    };
  }, [loadCustomers]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadCustomers(query), 250);
    return () => window.clearTimeout(timer);
  }, [query, loadCustomers]);

  useEffect(() => {
    if (tab === "history") loadRewards(historySearch);
  }, [tab, historySearch, loadRewards]);

  const currentCycle = (selected?.cycles_completed || 0) + 1;
  const capFromCycle = Number(settings.capped_from_cycle || 3);
  const uncappedCycles = capFromCycle - 1;
  const discountLabel = `${Number(settings.discount_percent || 15)}%${currentCycle >= capFromCycle ? ` (máx. ${money(settings.max_discount)})` : ""}`;
  const discountValue = useMemo(() => {
    const raw = Number(String(subtotal).replace(",", "."));
    if (!validation?.valid || !Number.isFinite(raw) || raw <= 0) return 0;
    const amount = Math.round(raw * Number(validation.discount_percent) + Number.EPSILON) / 100;
    return validation.max_discount ? Math.min(amount, Number(validation.max_discount)) : amount;
  }, [subtotal, validation]);

  function chooseCustomer(customer) {
    setSelected(customer);
    setCustomerPhone(customer.phone || "");
    setCustomerName(customer.customer_name || "");
    setIssued(null);
    setPageError("");
  }

  async function issueReward(event) {
    event.preventDefault();
    setLoading(true);
    setPageError("");
    try {
      if (!selected?.latest_order_id)
        throw new Error("É necessário selecionar um cliente com pedido concluído.");
      const result = await rpc("loyalty_issue_reward", {
        p_phone: digits(customerPhone),
        p_name: customerName.trim(),
        p_origin_order_id: selected.latest_order_id,
      });
      const reward = result?.reward || result;
      setIssued(reward);
      toast(
        result?.already_issued
          ? "Este pedido já tinha um benefício emitido."
          : "Benefício emitido com sucesso.",
      );
      loadCustomers(query);
      loadRewards(historySearch);
    } catch (error) {
      setPageError(error.message || "Não foi possível emitir o benefício.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadCard(reward) {
    try {
      const canvas = drawCard(reward);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Não foi possível gerar o PNG neste navegador.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fluxo-rewards-${String(reward.customer_name || "cliente")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Cartão PNG baixado. Você pode anexá-lo manualmente no WhatsApp.");
    } catch (error) {
      setPageError(error.message || "Não foi possível exportar o cartão.");
    }
  }

  async function copyCode(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast("Código copiado.");
    } catch {
      setPageError(
        "Não foi possível copiar automaticamente; selecione o código e copie manualmente.",
      );
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setLoading(true);
    setPageError("");
    try {
      const value = await rpc("loyalty_update_settings", {
        p_discount_percent: Number(settingsDraft.discount_percent),
        p_validity_days: Number(settingsDraft.validity_days),
        p_capped_from_cycle: Number(settingsDraft.capped_from_cycle),
        p_max_discount: Number(String(settingsDraft.max_discount).replace(",", ".")),
      });
      setSettings(value);
      setSettingsDraft(value);
      toast("Regras do programa salvas.");
    } catch (error) {
      setPageError(error.message || "Não foi possível salvar as regras.");
    } finally {
      setLoading(false);
    }
  }

  async function validateCode(event) {
    event.preventDefault();
    setLoading(true);
    setPageError("");
    setValidation(null);
    setRedemptionCustomer(null);
    try {
      const value = await rpc("loyalty_validate_reward", { p_code: code.trim().toUpperCase() });
      setValidation(value);
      if (value?.valid) {
        const results = await rpc("loyalty_search_customers", { p_search: value.customer_phone });
        const customer = (results || []).find((entry) => entry.phone === value.customer_phone);
        setRedemptionCustomer(customer || null);
        if (!customer?.latest_order_id)
          setPageError("Código válido, mas não há pedido concluído localizado para este telefone.");
      } else {
        const messages = {
          not_found: "Código não encontrado.",
          expired: "Este benefício expirou.",
          already_redeemed: "Este benefício já foi resgatado.",
          cancelled: "Este benefício foi cancelado.",
        };
        setPageError(messages[value?.reason] || "Este benefício não está ativo.");
      }
    } catch (error) {
      setPageError(error.message || "Falha ao validar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function redeem(event) {
    event.preventDefault();
    setLoading(true);
    setPageError("");
    try {
      if (!validation?.valid || !redemptionCustomer?.latest_order_id)
        throw new Error("Valide um código ativo e selecione um pedido concluído.");
      const value = await rpc("loyalty_redeem_reward", {
        p_code: validation.code,
        p_order_id: redemptionCustomer.latest_order_id,
        p_original_subtotal: Number(String(subtotal).replace(",", ".")),
      });
      toast(`Resgate registrado. Desconto auditado: ${money(value.discount_amount)}.`);
      setValidation({
        ...validation,
        valid: false,
        status: "REDEEMED",
        reason: "already_redeemed",
      });
      loadRewards(historySearch);
      loadCustomers("");
    } catch (error) {
      setPageError(error.message || "Não foi possível registrar o resgate.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelReward(event) {
    event.preventDefault();
    if (!cancelTarget) return;
    setLoading(true);
    setPageError("");
    try {
      await rpc("loyalty_cancel_reward", {
        p_reward_id: cancelTarget.id,
        p_reason: cancelReason.trim(),
      });
      setCancelTarget(null);
      setCancelReason("");
      toast("Benefício cancelado; o registro foi preservado no histórico.");
      loadRewards(historySearch);
      loadCustomers("");
    } catch (error) {
      setPageError(error.message || "Não foi possível cancelar.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#c6a463]/60 focus:ring-2 focus:ring-[#c6a463]/10";
  const buttonClass =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#c6a463] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-[#d6b578] disabled:cursor-not-allowed disabled:opacity-50";
  const ghostButton =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-[#c6a463]/40 hover:bg-white/[.07]";
  const panel =
    "rounded-2xl border border-white/[.08] bg-[#111111]/90 p-4 shadow-[0_16px_48px_rgba(0,0,0,.2)] sm:p-6";

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-28 pt-4 text-zinc-100 sm:px-6 sm:pb-12 sm:pt-6">
      <div className="mb-7 flex flex-col gap-5 border-b border-white/[.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.28em] text-[#c6a463]">
            <Award size={14} /> Fidelidade Fluxo Outlet
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            FLUXO <span className="text-[#c6a463]">REWARDS</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Benefícios individuais com emissão segura, ciclo permanente por telefone e resgate
            registrado no histórico.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 sm:self-auto">
          <LockKeyhole size={14} className="text-[#c6a463]" /> Área administrativa
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {[
          ["issue", Gift, "Emitir"],
          ["history", ClipboardList, "Histórico"],
          ["redeem", ShieldCheck, "Validar / resgatar"],
          ["settings", Settings2, "Regras"],
        ].map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setPageError("");
            }}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition ${tab === key ? "border-[#c6a463]/40 bg-[#c6a463]/10 text-[#e0c58f]" : "border-white/10 bg-white/[.025] text-zinc-400 hover:text-white"}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[.08] px-4 py-3 text-xs text-emerald-200">
          {notice}
        </div>
      )}
      {pageError && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[.08] px-4 py-3 text-xs text-rose-200"
        >
          <span>{pageError.replaceAll("_", " ")}</span>
          <button aria-label="Fechar aviso" onClick={() => setPageError("")}>
            <X size={15} />
          </button>
        </div>
      )}

      {tab === "issue" && (
        <>
          <SectionTitle icon={Gift} eyebrow="Novo benefício" title="Emitir cartão de fidelidade">
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-zinc-400">
              Ciclo atual{" "}
              <strong className="ml-1 text-white">{selected ? currentCycle : "—"}</strong>
              <span className="mx-2 text-zinc-700">/</span>
              <strong className="text-[#d6b578]">{discountLabel}</strong>
            </div>
          </SectionTitle>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(330px,.8fr)]">
            <div className={panel}>
              <label
                className="mb-2 block text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500"
                htmlFor="rewards-customer-search"
              >
                Buscar cliente por telefone ou nome
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="rewards-customer-search"
                  className={`${inputClass} pl-10`}
                  placeholder="Digite nome ou telefone"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                    setIssued(null);
                  }}
                />
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {customers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-zinc-500">
                    Nenhum cliente encontrado. A emissão exige um pedido com status concluído;
                    quando houver, o cadastro é criado automaticamente pelo telefone.
                  </div>
                ) : (
                  customers.map((customer) => (
                    <button
                      key={customer.phone}
                      onClick={() => chooseCustomer(customer)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${selected?.phone === customer.phone ? "border-[#c6a463]/50 bg-[#c6a463]/[.08]" : "border-white/[.07] bg-white/[.02] hover:border-white/20"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-zinc-100">
                          {customer.customer_name || "Cliente"}
                        </span>
                        <span className="mt-1 block text-xs text-zinc-500">
                          {customer.phone} <span className="mx-1 text-zinc-700">·</span>
                          {customer.completed_orders_count || 0} pedido(s) concluído(s)
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[10px] text-zinc-500">
                        {customer.latest_order_id
                          ? `Pedido #${customer.latest_order_number || customer.latest_order_id}`
                          : "Sem pedido"}
                        <span className="mt-1 block text-[#c6a463]">
                          {customer.cycles_completed || 0} ciclo(s)
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              {selected && (
                <form onSubmit={issueReward} className="mt-5 border-t border-white/[.08] pt-5">
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Nome do cliente
                      <input
                        className={`${inputClass} mt-2`}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                        maxLength={120}
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Telefone normalizado
                      <input
                        className={`${inputClass} mt-2`}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        inputMode="tel"
                        required
                      />
                    </label>
                  </div>
                  <div className="mb-4 rounded-xl bg-black/30 px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
                    Pedido de origem:{" "}
                    <strong className="text-zinc-200">
                      {selected.latest_order_number || `#${selected.latest_order_id}`}
                    </strong>{" "}
                    · {money(selected.latest_order_value)} · {dateBR(selected.latest_order_at)}. Um
                    benefício ativo por cliente; uso único.
                  </div>
                  <button className={buttonClass} disabled={loading || !selected.latest_order_id}>
                    {loading ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Gift size={15} />
                    )}{" "}
                    Emitir benefício
                  </button>
                </form>
              )}
            </div>

            <div className={panel}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#c6a463]">
                    Prévia do cartão
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Formato vertical, pronto para salvar e anexar ao WhatsApp.
                  </div>
                </div>
                <Ticket size={18} className="text-[#c6a463]" />
              </div>
              {issued ? (
                <>
                  <div className="relative mx-auto max-w-[300px] overflow-hidden rounded-[24px] border border-[#c6a463]/40 bg-gradient-to-br from-[#191919] via-[#101010] to-black p-5 shadow-[0_20px_50px_rgba(0,0,0,.4)]">
                    <div className="mb-7 flex items-center justify-between">
                      <span className="text-[10px] font-semibold tracking-[.22em] text-zinc-300">
                        FLUXO OUTLET
                      </span>
                      <span className="text-[9px] tracking-[.16em] text-[#c6a463]">REWARDS</span>
                    </div>
                    <div className="text-6xl font-semibold tracking-tight text-[#c6a463]">
                      {Number(issued.discount_percent)}
                      <span className="text-3xl">%</span>
                    </div>
                    <div className="mt-1 text-xs font-bold tracking-[.2em] text-white">OFF</div>
                    <div className="my-5 h-px bg-white/10" />
                    <div className="text-[9px] tracking-[.18em] text-zinc-500">FEITO PARA</div>
                    <div className="mt-1 truncate text-lg font-semibold text-white">
                      {issued.customer_name}
                    </div>
                    <div className="mt-5 text-[9px] tracking-[.18em] text-zinc-500">
                      SEU CÓDIGO INDIVIDUAL
                    </div>
                    <button
                      className="mt-2 w-full rounded-lg border border-[#c6a463]/20 bg-white/[.04] px-2 py-3 text-center font-mono text-xs font-bold tracking-wider text-white"
                      onClick={() => copyCode(issued.code)}
                    >
                      {issued.code}
                    </button>
                    <div className="mt-5 text-[10px] font-semibold tracking-wider text-[#d6b578]">
                      VÁLIDO ATÉ {dateBR(issued.expires_at).toUpperCase()}
                    </div>
                    <div className="mt-3 text-[9px] leading-relaxed text-zinc-500">
                      Uso único e individual. Não cumulativo.
                      {issued.max_discount ? ` Limite ${money(issued.max_discount)}.` : ""}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button className={buttonClass} onClick={() => downloadCard(issued)}>
                      <Download size={15} /> Baixar PNG
                    </button>
                    <button className={ghostButton} onClick={() => copyCode(issued.code)}>
                      <Copy size={14} /> Copiar código
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 px-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#c6a463]/20 bg-[#c6a463]/[.06] text-[#c6a463]">
                    <Gift size={22} />
                  </div>
                  <div className="text-sm font-semibold text-zinc-300">
                    Seu cartão aparecerá aqui
                  </div>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500">
                    Selecione um cliente com pedido concluído para conferir o ciclo e emitir um
                    código individual.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              [
                uncappedCycles > 0 ? `1–${uncappedCycles}` : "Todos",
                uncappedCycles > 0
                  ? `${settings.discount_percent}% OFF sem teto`
                  : `${settings.discount_percent}% OFF limitado`,
              ],
              [
                `${settings.capped_from_cycle || 3}º ciclo em diante`,
                `${settings.discount_percent}% OFF com limite de ${money(settings.max_discount)}`,
              ],
              [`${settings.validity_days} dias`, "Validade; uso único por código"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl border border-white/[.07] bg-white/[.02] px-4 py-3"
              >
                <div className="text-xs font-bold text-[#d6b578]">{k}</div>
                <div className="mt-1 text-[11px] text-zinc-500">{v}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "history" && (
        <>
          <SectionTitle icon={ClipboardList} eyebrow="Auditoria" title="Histórico de benefícios" />
          <div className={`${panel} mb-4`}>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                className={`${inputClass} pl-10`}
                placeholder="Filtrar por telefone, nome ou código"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
          </div>
          {rewards.length === 0 ? (
            <div className={`${panel} text-center text-sm text-zinc-500`}>
              Nenhum benefício encontrado.
            </div>
          ) : (
            <div className="grid gap-3">
              {rewards.map((reward) => (
                <article key={reward.id} className={`${panel} !p-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold tracking-wider text-[#d6b578]">
                          {reward.code}
                        </span>
                        <StatusPill status={reward.status} />
                      </div>
                      <div className="mt-2 truncate text-sm font-semibold text-white">
                        {reward.customer_name || "Cliente"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                        <span>{reward.customer_phone}</span>
                        <span>Ciclo {reward.cycle_number}</span>
                        <span>
                          {reward.discount_percent}%
                          {reward.max_discount ? ` até ${money(reward.max_discount)}` : " sem teto"}
                        </span>
                        <span>Emitido {dateBR(reward.issued_at)}</span>
                        <span>Expira {dateBR(reward.expires_at)}</span>
                      </div>
                      {reward.status === "REDEEMED" && (
                        <div className="mt-2 text-[11px] text-sky-300">
                          Pedido utilizado: #{reward.redeemed_order_id} · Desconto:{" "}
                          {money(reward.discount_amount)} · Resgatado em{" "}
                          {dateBR(reward.redeemed_at)}
                          {reward.redeemed_by
                            ? ` · operador ${String(reward.redeemed_by).slice(0, 8)}`
                            : ""}
                        </div>
                      )}
                      {reward.status === "CANCELLED" && (
                        <div className="mt-2 text-[11px] text-rose-300">
                          Cancelado em {dateBR(reward.cancelled_at)}: {reward.cancellation_reason}
                          {reward.cancelled_by
                            ? ` · operador ${String(reward.cancelled_by).slice(0, 8)}`
                            : ""}
                        </div>
                      )}
                      <div className="mt-1 text-[10px] text-zinc-600">
                        Pedido de origem: #{reward.origin_order_id}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        className={ghostButton}
                        title="Copiar código"
                        onClick={() => copyCode(reward.code)}
                      >
                        <Copy size={14} />
                        <span className="hidden sm:inline">Copiar</span>
                      </button>
                      {reward.status === "ACTIVE" && (
                        <button
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-400/10"
                          onClick={() => {
                            setCancelTarget(reward);
                            setCancelReason("");
                          }}
                        >
                          <X size={14} />
                          <span className="hidden sm:inline">Cancelar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "redeem" && (
        <>
          <SectionTitle
            icon={ShieldCheck}
            eyebrow="Validação server-side"
            title="Validar e registrar resgate"
          />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1fr)]">
            <form className={panel} onSubmit={validateCode}>
              <label
                htmlFor="reward-code"
                className="mb-2 block text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500"
              >
                Código do cartão
              </label>
              <div className="flex gap-2">
                <input
                  id="reward-code"
                  className={`${inputClass} font-mono uppercase tracking-wider`}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setValidation(null);
                  }}
                  placeholder="FLX-…"
                  autoCapitalize="characters"
                  required
                />
                <button className={buttonClass} disabled={loading || !code.trim()}>
                  {loading ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Search size={15} />
                  )}{" "}
                  Validar
                </button>
              </div>
              {validation && (
                <div
                  className={`mt-4 rounded-xl border p-4 ${validation.valid ? "border-emerald-400/20 bg-emerald-400/[.06]" : "border-rose-400/20 bg-rose-400/[.06]"}`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {validation.valid ? (
                      <Check size={16} className="text-emerald-300" />
                    ) : (
                      <X size={16} className="text-rose-300" />
                    )}
                    {validation.valid
                      ? "Código ativo e válido"
                      : statusLabel[validation.status] || "Código inválido"}
                  </div>
                  {validation.valid && (
                    <div className="mt-3 space-y-1 text-xs text-zinc-400">
                      <div>
                        Cliente:{" "}
                        <strong className="text-zinc-200">{validation.customer_name}</strong>
                      </div>
                      <div>
                        Benefício:{" "}
                        <strong className="text-[#d6b578]">
                          {validation.discount_percent}%
                          {validation.max_discount
                            ? ` até ${money(validation.max_discount)}`
                            : " sem teto"}
                        </strong>{" "}
                        · ciclo {validation.cycle_number}
                      </div>
                      <div>Validade: {dateBR(validation.expires_at)}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 rounded-xl border border-white/[.07] bg-black/20 p-3 text-[11px] leading-relaxed text-zinc-500">
                A validação consulta o estado no Supabase. Para registrar o uso, o pedido precisa
                estar concluído e o total final deve corresponder ao subtotal menos o desconto
                calculado. O resgate e o avanço do ciclo são atômicos.
              </div>
            </form>
            <form className={panel} onSubmit={redeem}>
              <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#c6a463]">
                <ClipboardList size={14} /> Vincular a compra concluída
              </div>
              {validation?.valid && redemptionCustomer?.latest_order_id ? (
                <>
                  <div className="rounded-xl border border-white/[.07] bg-black/20 p-3 text-xs text-zinc-400">
                    <div className="font-semibold text-white">
                      {redemptionCustomer.customer_name}
                    </div>
                    <div className="mt-1">{redemptionCustomer.phone}</div>
                    <div className="mt-2">
                      Pedido mais recente concluído:{" "}
                      <strong className="text-zinc-200">
                        #
                        {redemptionCustomer.latest_order_number ||
                          redemptionCustomer.latest_order_id}
                      </strong>{" "}
                      · total atual {money(redemptionCustomer.latest_order_value)}
                    </div>
                  </div>
                  <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Subtotal antes do desconto
                    <input
                      className={`${inputClass} mt-2`}
                      value={subtotal}
                      onChange={(e) => setSubtotal(e.target.value.replace(/[^0-9.,]/g, ""))}
                      inputMode="decimal"
                      placeholder="Ex.: 200,00"
                      required
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/[.03] p-3">
                      <div className="text-[9px] uppercase tracking-wider text-zinc-500">
                        Desconto calculado
                      </div>
                      <div className="mt-1 text-sm font-bold text-[#d6b578]">
                        {money(discountValue)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[.03] p-3">
                      <div className="text-[9px] uppercase tracking-wider text-zinc-500">
                        Total esperado
                      </div>
                      <div className="mt-1 text-sm font-bold text-white">
                        {money(
                          Math.max(0, Number(String(subtotal).replace(",", ".")) - discountValue),
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
                    Aplique esse desconto ao pedido no fluxo administrativo antes de concluí-lo;
                    depois, retorne aqui e registre o resgate. O servidor compara o total salvo para
                    impedir descontos divergentes.
                  </p>
                  <button
                    className={`${buttonClass} mt-4 w-full`}
                    disabled={loading || !subtotal || discountValue <= 0}
                  >
                    {loading ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={15} />
                    )}{" "}
                    Registrar resgate
                  </button>
                </>
              ) : (
                <div className="flex min-h-52 flex-col items-center justify-center text-center text-xs text-zinc-500">
                  <ShieldCheck size={23} className="mb-3 text-zinc-700" />
                  Valide um código ativo para carregar os dados do cliente e do pedido.
                </div>
              )}
            </form>
          </div>
        </>
      )}

      {tab === "settings" && settingsDraft && (
        <>
          <SectionTitle
            icon={Settings2}
            eyebrow="Regras do programa"
            title="Configuração de benefícios"
          />
          <form className={`${panel} max-w-3xl`} onSubmit={saveSettings}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Percentual padrão (%)
                <input
                  className={`${inputClass} mt-2`}
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={settingsDraft.discount_percent}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, discount_percent: e.target.value })
                  }
                  required
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Validade (dias)
                <input
                  className={`${inputClass} mt-2`}
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  value={settingsDraft.validity_days}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, validity_days: e.target.value })
                  }
                  required
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Limite começa no ciclo
                <input
                  className={`${inputClass} mt-2`}
                  type="number"
                  min="1"
                  step="1"
                  value={settingsDraft.capped_from_cycle}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, capped_from_cycle: e.target.value })
                  }
                  required
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Desconto máximo (R$)
                <input
                  className={`${inputClass} mt-2`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={settingsDraft.max_discount}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, max_discount: e.target.value })
                  }
                  required
                />
              </label>
            </div>
            <div className="mt-5 rounded-xl border border-[#c6a463]/15 bg-[#c6a463]/[.04] p-4 text-xs leading-relaxed text-zinc-400">
              As alterações valem para novas emissões. Cada benefício já emitido guarda sua própria
              regra, validade e teto no histórico; ciclos concluídos por cliente não são apagados.
            </div>
            <button className={`${buttonClass} mt-5`} disabled={loading}>
              {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}{" "}
              Salvar regras
            </button>
          </form>
        </>
      )}

      {cancelTarget && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-reward-title"
        >
          <form
            onSubmit={cancelReward}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 id="cancel-reward-title" className="font-semibold text-white">
                Cancelar benefício
              </h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="text-zinc-500 hover:text-white"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              O código {cancelTarget.code} será invalidado. O motivo ficará preservado no histórico.
            </p>
            <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Motivo obrigatório
              <textarea
                className={`${inputClass} mt-2 min-h-24 resize-y`}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                minLength={3}
                maxLength={500}
                required
                placeholder="Descreva o motivo do cancelamento"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={ghostButton} onClick={() => setCancelTarget(null)}>
                Voltar
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                disabled={loading || cancelReason.trim().length < 3}
              >
                {loading ? <LoaderCircle size={14} className="animate-spin" /> : <X size={14} />}{" "}
                Confirmar cancelamento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
