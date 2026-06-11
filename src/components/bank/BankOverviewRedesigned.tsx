import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type {
  Deposit,
  BankAccount,
  Bill,
  ActionItem,
  SavingsGoal,
  Currency,
  TotalValueHistoryEntry,
} from "../../types/bankRecords";
import type { BankDashboardTheme } from "../../bank/bankDashboardTheme";
import type { PortfolioHistoryChartPoint } from "../../bank/bankDashboardTypes";
import { convertCurrency, fmt, fmtFull, fmtDate } from "../../bank/bankDashboardFormat";
import { CURRENCY_SYMBOLS } from "../../bank/bankDashboardConstants";
import type { Next30DayRow, DisplayCurrencyMode } from "./BankOverviewTab";

// ──────────────────────────────────────────────────────────────────
// Redesigned Vault Overview screen (parallel to BankOverviewTab).
// Same props shape as the classic overview so it can be swapped in/out.
// Visual language: light cream cards, soft borders, generous whitespace,
// teal/blue accents — but built on top of the existing THEME tokens so it
// auto-adapts when the user is on the dark theme.
// ──────────────────────────────────────────────────────────────────

// Crisp Kit-aligned palette: calmer tones, finance semantics kept
// (green = positive, red = negative, purple = primary accent).
const ACCENT = {
  savings: "#1D9E75", // kit green
  other: "#6B5DE8",   // kit purple
  loan: "#C94A2E",    // kit red
  credit: "#D97706",  // kit amber
  deposit: "#5B7FB9", // muted blue
  invest: "#8B7FE0",  // muted purple
  teal: "#1D9E75",
  blue: "#5B7FB9",
  posBg: "#E7F3EC",
  posText: "#0F6B4F",
  negBg: "#F7E7E2",
  negText: "#8A2B17",
};

// Muted, kit-aligned donut palette — desaturated tones so the chart stays calm.
const TYPE_COLORS: Record<string, string> = {
  Saving: ACCENT.savings,      // green
  FD: ACCENT.deposit,          // muted blue
  SCSS: "#6B6FD0",             // soft indigo
  PPF: ACCENT.credit,          // amber
  NPS: "#3FA39B",              // muted teal
  "Credit Card": ACCENT.loan,  // red
  Loan: "#B05A42",             // muted brick
  Current: "#4F9D91",          // muted teal-green
  "Mutual Fund": ACCENT.invest,// muted purple
  RD: "#7C93C9",               // soft blue
  EPF: "#5E8FB0",              // steel blue
  Demat: "#C77A3C",            // muted orange
  "401K": "#B8862E",           // muted gold
  Stock: ACCENT.other,         // purple
  Other: "#8A8F98",            // muted slate
};
const fallbackColors = ["#B5708C", "#C77A3C", "#7FA34A", "#9B7FC0", "#6B7B8C", "#3FA39B", "#BC5A6A"];

export interface BankOverviewRedesignedProps {
  theme: BankDashboardTheme;
  isMobile: boolean;
  deposits: Deposit[];
  accounts: BankAccount[];
  bills: Bill[];
  actions: ActionItem[];
  goals: SavingsGoal[];
  displayCurrency: DisplayCurrencyMode;
  setDisplayCurrency: (c: DisplayCurrencyMode) => void;
  exchangeRates: { USD: number; EUR: number; GBP: number };
  targetCurrency: Currency;
  netWorthConverted: number;
  sumConverted: (items: { amount?: number | string; currency?: Currency }[]) => number;
  totalInvested: number;
  totalMaturity: number;
  depositsPrincipalConverted: number;
  next30DaysUnified: Next30DayRow[];
  pastDueUnified: Next30DayRow[];
  overviewActionsCount: number;
  portfolioHistoryChartData: PortfolioHistoryChartPoint[];
  portfolioHistoryXDomain: [number, number] | undefined;
  portfolioHistoryYDomainAccounts?: [number, number] | undefined;
  portfolioHistoryYDomainDeposits?: [number, number] | undefined;
  portfolioHistorySnapshotCount: number;
  showPortfolioHistory: boolean;
  setShowPortfolioHistory: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRatesModal: (v: boolean) => void;
  onPortfolioChartClick?: () => void;
  setTab: (tab: string) => void;
  persist: (
    deps: Deposit[],
    accs: BankAccount[],
    bls: Bill[],
    acts: ActionItem[],
    gls?: SavingsGoal[],
    rates?: { USD: number; EUR: number; GBP: number },
    dispCur?: DisplayCurrencyMode,
    totalValueHist?: TotalValueHistoryEntry[]
  ) => void | Promise<void>;
  totalValueHistory: TotalValueHistoryEntry[];
  toggleDone: (t: string, i: number) => void;
  getBankColor: (bank: string) => string;
}

export function BankOverviewRedesigned(props: BankOverviewRedesignedProps) {
  const {
    theme: T,
    isMobile,
    deposits,
    accounts,
    bills,
    actions,
    goals,
    displayCurrency,
    setDisplayCurrency,
    exchangeRates,
    targetCurrency,
    netWorthConverted,
    sumConverted,
    totalInvested,
    totalMaturity,
    depositsPrincipalConverted,
    next30DaysUnified,
    pastDueUnified,
    overviewActionsCount,
    portfolioHistoryChartData,
    portfolioHistoryXDomain,
    portfolioHistoryYDomainAccounts,
    portfolioHistoryYDomainDeposits,
    portfolioHistorySnapshotCount,
    showPortfolioHistory,
    setShowPortfolioHistory,
    setShowRatesModal,
    onPortfolioChartClick,
    setTab,
    persist,
    totalValueHistory,
    toggleDone,
    getBankColor,
  } = props;

  const [chartMode, setChartMode] = React.useState<"accounts" | "deposits" | "both">("accounts");

  // Money formatter for the Overview: NO decimals (mobile: "$473K", desktop: "$470,800").
  // Decimals belong to the Chart Detail / per-item screens, not to an at-a-glance summary.
  const f = React.useCallback(
    (n: number | string | null | undefined, cur: Currency = targetCurrency) =>
      isMobile ? fmt(n, cur, 0) : fmtFull(n, cur, 0),
    [isMobile, targetCurrency]
  );
  // Chart YAxis labels keep the short form even on desktop (no overlap into chart body).
  const fShort = React.useCallback(
    (n: number | string | null | undefined, cur: Currency = targetCurrency) => fmt(n, cur, 0),
    [targetCurrency]
  );

  // ── Derived ─────────────────────────────────────────────────────
  // Net-worth delta vs first snapshot (matches the "since Apr 16 · +12.0%" line in the mockup)
  const heroDelta = React.useMemo(() => {
    const real = portfolioHistoryChartData.filter((p) => !p.isProjected);
    if (real.length < 1) return null;
    const first = real[0];
    const last = real[real.length - 1];
    const startVal = (Number(first.totalAccountValue) || 0);
    const endVal = (Number(last.totalAccountValue) || 0);
    const change = endVal - startVal;
    const pct = startVal !== 0 ? (change / Math.abs(startVal)) * 100 : 0;
    return { change, pct, sinceDate: first.fullDate };
  }, [portfolioHistoryChartData]);

  // By-type aggregation in target currency
  const byType = React.useMemo(() => {
    const m: Record<string, number> = {};
    accounts.forEach((a) => {
      const t = (a.type || "Other").trim() || "Other";
      m[t] = (m[t] || 0) + convertCurrency(Number(a.amount) || 0, (a.currency || "INR") as Currency, targetCurrency, exchangeRates);
    });
    const entries = Object.entries(m).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    return entries.map(([type, value], i) => ({
      type,
      value,
      color: TYPE_COLORS[type] || fallbackColors[i % fallbackColors.length],
    }));
  }, [accounts, targetCurrency, exchangeRates]);

  const byBank = React.useMemo(() => {
    const m: Record<string, number> = {};
    accounts.forEach((a) => {
      const b = a.bank || "Unknown";
      m[b] = (m[b] || 0) + convertCurrency(Number(a.amount) || 0, (a.currency || "INR") as Currency, targetCurrency, exchangeRates);
    });
    return Object.entries(m)
      .filter(([, v]) => v !== 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [accounts, targetCurrency, exchangeRates]);

  const topAccounts = React.useMemo(() => {
    return [...accounts]
      .map((a, idx) => ({ a, idx, val: convertCurrency(Number(a.amount) || 0, (a.currency || "INR") as Currency, targetCurrency, exchangeRates) }))
      .filter((x) => x.val !== 0)
      .sort((x, y) => Math.abs(y.val) - Math.abs(x.val))
      .slice(0, 8);
  }, [accounts, targetCurrency, exchangeRates]);

  const totalAssets = byType.filter((t) => t.value > 0).reduce((s, t) => s + t.value, 0);
  const totalLiabilities = Math.abs(byType.filter((t) => t.value < 0).reduce((s, t) => s + t.value, 0));
  const savingsTotal = byType.filter((t) => t.type === "Saving").reduce((s, t) => s + t.value, 0);
  const otherTotal = totalAssets - savingsTotal;
  const billsPending = bills.filter((b) => !b.done);
  const totalPendingBills = billsPending.reduce(
    (s, b) => s + convertCurrency(Number(b.amount) || 0, (b.currency || "INR") as Currency, targetCurrency, exchangeRates),
    0
  );

  // ── Tiny reusable bits ──────────────────────────────────────────
  const Card: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties; pad?: number | string }>> = ({ children, style, pad = 16 }) => (
    <div
      style={{
        background: T.cardBg,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: pad,
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );

  const SectionLabel: React.FC<React.PropsWithChildren<{ icon?: string }>> = ({ icon, children }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span>{icon}</span>}
      {children}
    </div>
  );

  // ── Hero: NET WORTH ─────────────────────────────────────────────
  const Hero = (
    <Card pad={isMobile ? 16 : 18} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>
            NET WORTH ({displayCurrency === "ORIGINAL" ? "Mixed → INR" : targetCurrency})
          </div>
          <div style={{ fontSize: isMobile ? 32 : 36, fontWeight: 800, color: T.text, fontFamily: "ui-monospace, monospace", marginTop: 4, lineHeight: 1.05 }}>
            {f(netWorthConverted)}
          </div>
          {heroDelta && (
            <div style={{ fontSize: 12, fontWeight: 700, color: heroDelta.change >= 0 ? ACCENT.posText : ACCENT.negText, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ background: heroDelta.change >= 0 ? ACCENT.posBg : ACCENT.negBg, padding: "3px 8px", borderRadius: 999 }}>
                {heroDelta.change >= 0 ? "▲" : "▼"} {heroDelta.change >= 0 ? "+" : ""}{f(heroDelta.change)}
              </span>
              <span style={{ color: T.textMuted, fontWeight: 600 }}>
                {heroDelta.pct >= 0 ? "+" : ""}{heroDelta.pct.toFixed(1)}% since {fmtDate(heroDelta.sinceDate)}
              </span>
            </div>
          )}
        </div>
        {/* Currency switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 6, flexWrap: isMobile ? "nowrap" : "wrap" }}>
          {(["ORIGINAL", "INR", "USD", "EUR", "GBP"] as const).map((cur) => (
            <button
              key={cur}
              onClick={() => { setDisplayCurrency(cur); persist(deposits, accounts, bills, actions, goals, exchangeRates, cur, totalValueHistory); }}
              style={{
                background: displayCurrency === cur ? "var(--ck-purple)" : "transparent",
                color: displayCurrency === cur ? "#fff" : T.textMuted,
                border: `1px solid ${displayCurrency === cur ? "var(--ck-purple)" : T.border}`,
                borderRadius: 8,
                padding: isMobile ? "4px 7px" : "4px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {cur === "ORIGINAL" ? "🌐" : isMobile ? CURRENCY_SYMBOLS[cur] : `${CURRENCY_SYMBOLS[cur]} ${cur}`}
            </button>
          ))}
          <button
            onClick={() => setShowRatesModal(true)}
            title="Edit exchange rates"
            style={{ background: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 8, padding: isMobile ? "4px 7px" : "4px 8px", fontSize: 11, cursor: "pointer" }}
          >{isMobile ? "⚙️" : "⚙️ Rates"}</button>
        </div>
      </div>

      {/* Savings / Other allocation bar */}
      {totalAssets > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: T.cardBgAlt }}>
            <div style={{ width: `${(savingsTotal / totalAssets) * 100}%`, background: ACCENT.savings, transition: "width 0.3s ease" }} />
            <div style={{ width: `${(otherTotal / totalAssets) * 100}%`, background: ACCENT.other, transition: "width 0.3s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: ACCENT.savings, borderRadius: 2, marginRight: 6 }} />Savings <b style={{ color: T.text, fontFamily: "ui-monospace,monospace" }}>{f(savingsTotal)}</b> · {((savingsTotal / totalAssets) * 100).toFixed(1)}%</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: ACCENT.other, borderRadius: 2, marginRight: 6 }} />Other <b style={{ color: T.text, fontFamily: "ui-monospace,monospace" }}>{f(otherTotal)}</b> · {((otherTotal / totalAssets) * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}
    </Card>
  );

  // ── 4-stat strip ────────────────────────────────────────────────
  const StatTile: React.FC<{ icon: string; value: number; label: string; color: string; sub?: string; onClick?: () => void }> = ({ icon, value, label, color, sub, onClick }) => (
    <Card pad={14} style={{ textAlign: "center", cursor: onClick ? "pointer" : "default", display: "flex", flexDirection: "column", gap: 4 }}>
      <div onClick={onClick}>
        <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700, marginTop: 2 }}>
          {icon} {label}
        </div>
        {sub && <div style={{ fontSize: 11, color, fontWeight: 600, fontFamily: "ui-monospace,monospace", marginTop: 4 }}>{sub}</div>}
      </div>
    </Card>
  );
  const Stats = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: isMobile ? 8 : 12 }}>
      <StatTile icon="💰" value={deposits.length} label="Deposits" color={ACCENT.deposit} sub={depositsPrincipalConverted > 0 ? f(depositsPrincipalConverted) : undefined} onClick={() => setTab("deposits")} />
      <StatTile icon="🏦" value={accounts.length} label="Accounts" color={ACCENT.savings} sub={f(sumConverted(accounts))} onClick={() => setTab("accounts")} />
      <StatTile icon="📋" value={billsPending.length} label="Bills" color={billsPending.length > 0 ? ACCENT.credit : T.textMuted} sub={totalPendingBills > 0 ? f(totalPendingBills) : undefined} onClick={() => setTab("bills")} />
      <StatTile icon="⚡" value={overviewActionsCount} label="Actions" color={overviewActionsCount > 0 ? ACCENT.credit : T.textMuted} sub={pastDueUnified.length > 0 ? `${pastDueUnified.length} overdue` : "All clear"} onClick={() => setTab("actions")} />
    </div>
  );

  // ── Portfolio chart card ───────────────────────────────────────
  const ChartCard = (
    <Card pad={isMobile ? 12 : 16} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowPortfolioHistory(!showPortfolioHistory)}
            style={{ background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", padding: 0, fontSize: 10 }}
          >
            {showPortfolioHistory ? "▼" : "▶"}
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>📈 Portfolio value over time</span>
          {portfolioHistoryChartData.length > 0 && (
            <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>
              · {portfolioHistorySnapshotCount} snapshots
            </span>
          )}
        </div>
        {portfolioHistoryChartData.length > 0 && (
          <div style={{ display: "inline-flex", background: T.cardBgAlt, border: `1px solid ${T.border}`, borderRadius: 8, padding: 2, gap: 2 }}>
            {(["accounts", "deposits", "both"] as const).map((m) => {
              const active = chartMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setChartMode(m)}
                  style={{
                    background: active ? T.text : "transparent",
                    color: active ? T.cardBg : T.textMuted,
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >{m}</button>
              );
            })}
          </div>
        )}
      </div>

      {showPortfolioHistory && (
        portfolioHistoryChartData.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 12 }}>
            Edit balances or add accounts to build history. Each save records a snapshot.
          </div>
        ) : (
          <>
            <div
              onClick={() => onPortfolioChartClick?.()}
              style={{ cursor: onPortfolioChartClick ? "pointer" : "default", width: "100%", minWidth: 0 }}
              title={onPortfolioChartClick ? "Click to open detail view" : undefined}
            >
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 260} minWidth={0}>
                <AreaChart data={portfolioHistoryChartData} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="redesignAccountsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT.teal} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={ACCENT.teal} stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="redesignDepositsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT.blue} stopOpacity={0.32} />
                      <stop offset="95%" stopColor={ACCENT.blue} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="timestamp" type="number" domain={portfolioHistoryXDomain || ["dataMin", "dataMax"]} tick={{ fill: T.textLight, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(ts) => new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} minTickGap={28} />
                  <YAxis domain={chartMode === "deposits" ? (portfolioHistoryYDomainDeposits || ["auto", "auto"]) : (portfolioHistoryYDomainAccounts || ["auto", "auto"])} tick={{ fill: T.textLight, fontSize: 10 }} axisLine={false} tickLine={false} width={isMobile ? 56 : 72} tickFormatter={(v) => fShort(v)} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0]?.payload as PortfolioHistoryChartPoint | undefined;
                      if (!p) return null;
                      return (
                        <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                          <div style={{ color: T.textMuted, marginBottom: 4 }}>{fmtDate(p.fullDate)}</div>
                          {(chartMode === "accounts" || chartMode === "both") && (
                            <div style={{ color: ACCENT.teal, fontWeight: 700 }}>Accounts: {f(Number(p.totalAccountValue) || 0)}</div>
                          )}
                          {(chartMode === "deposits" || chartMode === "both") && (
                            <div style={{ color: ACCENT.blue, fontWeight: 700 }}>Deposits: {f(Number(p.totalDepositValue) || 0)}</div>
                          )}
                        </div>
                      );
                    }}
                  />
                  {(chartMode === "accounts" || chartMode === "both") && (
                    <Area type="monotone" dataKey="totalAccountValue" stroke={ACCENT.teal} strokeWidth={2.2} fill="url(#redesignAccountsFill)" />
                  )}
                  {(chartMode === "deposits" || chartMode === "both") && (
                    <Area type="monotone" dataKey="totalDepositValue" stroke={ACCENT.blue} strokeWidth={chartMode === "both" ? 2 : 2.2} fill={chartMode === "both" ? "none" : "url(#redesignDepositsFill)"} strokeDasharray={chartMode === "both" ? "5 4" : undefined} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              {onPortfolioChartClick && (
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, textAlign: "center" }}>
                  {isMobile ? "Tap" : "Click"} chart to open detail view with editable snapshot data →
                </div>
              )}
            </div>
          </>
        )
      )}
    </Card>
  );

  // ── Portfolio by Type (donut) ───────────────────────────────────
  const PieCard = (
    <Card pad={14} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel icon="🥧">Portfolio by type</SectionLabel>
      {byType.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: 14 }}>Add accounts to see allocation</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ width: 140, height: 140, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie data={byType.map((t) => ({ name: t.type, value: Math.abs(t.value) }))} dataKey="value" innerRadius={42} outerRadius={68} paddingAngle={2}>
                  {byType.map((t, i) => <Cell key={i} fill={t.color} />)}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0]?.payload as any;
                    const original = byType.find((x) => x.type === item?.name);
                    if (!original) return null;
                    return (
                      <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 11 }}>
                        <div style={{ color: T.text, fontWeight: 700 }}>{original.type}</div>
                        <div style={{ color: original.color, fontWeight: 700 }}>{f(original.value)}</div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1, minWidth: 130, display: "flex", flexDirection: "column", gap: 6 }}>
            {byType.slice(0, 6).map((t) => (
              <div key={t.type} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: T.text, fontWeight: 600 }}>{t.type}</span>
                <span style={{ color: t.value < 0 ? ACCENT.negText : T.text, fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>{f(t.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );

  // ── Assets vs Liabilities ───────────────────────────────────────
  const AssetsLiabCard = (
    <Card pad={14} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionLabel icon="⚖️">Assets vs liabilities</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: ACCENT.posBg, color: ACCENT.posText, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.85 }}>Assets</span>
          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "ui-monospace,monospace" }}>{f(totalAssets)}</span>
        </div>
        <div style={{ background: ACCENT.negBg, color: ACCENT.negText, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.85 }}>Liabilities</span>
          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "ui-monospace,monospace" }}>{f(totalLiabilities)}</span>
        </div>
      </div>
    </Card>
  );

  // ── Pending bills ───────────────────────────────────────────────
  const PendingBillsCard = (
    <Card pad={14} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel icon="📋">Pending bills</SectionLabel>
        {billsPending.length > 0 && <button onClick={() => setTab("bills")} style={{ background: "transparent", border: "none", color: T.accent, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>See all →</button>}
      </div>
      {billsPending.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: 12 }}>🎉 No pending bills</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {billsPending.slice(0, 5).map((b, i) => {
            const billIdx = bills.indexOf(b);
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", background: T.cardBgAlt, borderRadius: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                  {b.due && <div style={{ fontSize: 10, color: T.textMuted }}>Due {fmtDate(b.due)}</div>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT.credit, fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap" }}>{f(b.amount, (b.currency || "INR") as Currency)}</div>
                <button
                  onClick={() => toggleDone("bill", billIdx)}
                  title="Mark as paid"
                  style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700, color: ACCENT.posText }}
                >✓</button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  // ── Top accounts ────────────────────────────────────────────────
  const TopAccountsCard = (
    <Card pad={14} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel icon="🏆">Top accounts</SectionLabel>
        <button onClick={() => setTab("accounts")} style={{ background: "transparent", border: "none", color: T.accent, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>See all →</button>
      </div>
      {topAccounts.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: 12 }}>No accounts yet</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {topAccounts.map(({ a, val }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: T.cardBgAlt, borderRadius: 8 }}>
              <span style={{ width: 8, height: 24, borderRadius: 2, background: getBankColor(a.bank), flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.bank}</div>
                <div style={{ fontSize: 10, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.type || "—"}{a.holders ? ` · ${a.holders}` : ""}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: val < 0 ? ACCENT.negText : T.text, fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap" }}>{f(val)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  // ── Bank concentration ──────────────────────────────────────────
  const BankConcentrationCard = (
    <Card pad={14} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel icon="🏦">Bank concentration</SectionLabel>
      {byBank.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: 12 }}>No bank data</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 8 }}>
          {byBank.slice(0, 8).map(([bank, amt]) => {
            const pct = netWorthConverted !== 0 ? (amt / netWorthConverted) * 100 : 0;
            const isNeg = amt < 0;
            return (
              <div key={bank} style={{ background: T.cardBgAlt, borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${isNeg ? ACCENT.loan : getBankColor(bank)}` }}>
                <div style={{ fontSize: 10, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }} title={bank}>{bank}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: isNeg ? ACCENT.negText : T.text, fontFamily: "ui-monospace,monospace", marginTop: 2 }}>{f(amt)}</div>
                <div style={{ fontSize: 10, color: isNeg ? ACCENT.negText : getBankColor(bank), fontWeight: 700, marginTop: 2 }}>{pct.toFixed(0)}%</div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  // ── Deposit projections ─────────────────────────────────────────
  const DepositProjectionsCard = (
    <Card pad={14} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel icon="💰">Deposit projections (1 yr)</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <div style={{ background: T.cardBgAlt, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Invested</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT.deposit, fontFamily: "ui-monospace,monospace", marginTop: 4 }}>{f(totalInvested)}</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{deposits.length + accounts.filter((a) => a.type === "FD").length} deposits</div>
        </div>
        <div style={{ background: T.cardBgAlt, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Maturity</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT.savings, fontFamily: "ui-monospace,monospace", marginTop: 4 }}>{f(totalMaturity)}</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>projected</div>
        </div>
        <div style={{ background: T.cardBgAlt, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Est. gain</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT.posText, fontFamily: "ui-monospace,monospace", marginTop: 4 }}>{f(totalMaturity - totalInvested)}</div>
          <div style={{ fontSize: 10, color: ACCENT.posText, fontWeight: 700, marginTop: 2 }}>{totalInvested ? `+${(((totalMaturity - totalInvested) / totalInvested) * 100).toFixed(1)}%` : ""}</div>
        </div>
      </div>
    </Card>
  );

  // ── Past due + Next 30 ─────────────────────────────────────────
  const renderRowList = (rows: Next30DayRow[], variant: "pastdue" | "next30") => {
    if (rows.length === 0) return null;
    return rows.map((r, i) => {
      const icon = r.kind === "maturity" ? "💰" : r.kind === "linked" ? "⚡" : "📋";
      const urgentColor = variant === "pastdue" ? ACCENT.negText : (r.days <= 3 ? ACCENT.negText : ACCENT.credit);
      const urgentBg = variant === "pastdue" ? ACCENT.negBg : (r.days <= 3 ? ACCENT.negBg : "#FFF4E5");
      return (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", background: T.cardBgAlt, borderRadius: 8 }}>
          <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descriptiveLabel || r.bank || "—"}</div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{r.actionLabel || r.title} · {fmtDate(r.date)}</div>
            </div>
          </div>
          {r.amountFormatted && <div style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap" }}>{r.amountFormatted}</div>}
          <span style={{ fontSize: 10, fontWeight: 800, color: urgentColor, background: urgentBg, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
            {variant === "pastdue" ? `${Math.abs(r.days)}d overdue` : `${r.days}d left`}
          </span>
        </div>
      );
    });
  };

  const TimelineCard = (
    <Card pad={14} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel icon="⏰">Coming up</SectionLabel>
        <div style={{ display: "flex", gap: 6, fontSize: 10, fontWeight: 700 }}>
          {pastDueUnified.length > 0 && <span style={{ background: ACCENT.negBg, color: ACCENT.negText, padding: "3px 8px", borderRadius: 999 }}>{pastDueUnified.length} overdue</span>}
          <span style={{ background: T.cardBgAlt, color: T.textMuted, padding: "3px 8px", borderRadius: 999 }}>{next30DaysUnified.length} in next 30d</span>
        </div>
      </div>
      {(pastDueUnified.length === 0 && next30DaysUnified.length === 0) ? (
        <div style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: 12 }}>✅ Nothing due in the next 30 days</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {renderRowList(pastDueUnified, "pastdue")}
          {renderRowList(next30DaysUnified, "next30")}
        </div>
      )}
    </Card>
  );

  // ── Layout ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Hero}
        {Stats}
        {ChartCard}
        {PieCard}
        {AssetsLiabCard}
        {TimelineCard}
        {PendingBillsCard}
        {TopAccountsCard}
        {DepositProjectionsCard}
        {BankConcentrationCard}
      </div>
    );
  }

  // Desktop — 2-column grid: main (chart, projections, bank concentration, top accounts) + sidebar (donut, A/L, bills, timeline)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Hero}
      {Stats}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {ChartCard}
          {DepositProjectionsCard}
          {BankConcentrationCard}
          {TopAccountsCard}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {PieCard}
          {AssetsLiabCard}
          {TimelineCard}
          {PendingBillsCard}
        </div>
      </div>
    </div>
  );
}

export default BankOverviewRedesigned;
