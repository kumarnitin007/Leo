import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  Area,
} from "recharts";
import type { Currency } from "../../types/bankRecords";
import type { BankDashboardTheme } from "../../bank/bankDashboardTheme";
import type { PortfolioHistoryChartPoint } from "../../bank/bankDashboardTypes";
import { fmt, fmtFull, fmtDate } from "../../bank/bankDashboardFormat";

// ──────────────────────────────────────────────────────────────────
// New: Chart Detail screen (added for user validation).
// Triggered from the Overview "Portfolio value over time" chart click.
// Visually follows the supplied mockups: light page bg, dark sub-header,
// teal line chart, blue deposit bars, sticky snapshot panel.
// ──────────────────────────────────────────────────────────────────

const PALETTE = {
  pageBg: "#f4f4f0",
  topbar: "#1a1a1a",
  topbarText: "#ffffff",
  cardBg: "#ffffff",
  cardBorder: "rgba(0,0,0,0.10)",
  text: "#1a1a1a",
  textMuted: "#5F5E5A",
  textLight: "#8a897f",
  accountLine: "#1D9E75",
  accountFill: "rgba(29,158,117,0.18)",
  depositBar: "#378ADD",
  depositBarLight: "rgba(55,138,221,0.45)",
  posBg: "#E1F5EE",
  posText: "#085041",
  negBg: "#FCEBEB",
  negText: "#791F1F",
  neutralBg: "#f4f4f0",
  neutralText: "#5F5E5A",
  rowHighlight: "#EBF4FF",
  rowHighlightBorder: "#BCD6FF",
  divider: "#EDECE6",
};

export interface BankChartDetailTabProps {
  theme: BankDashboardTheme;
  isMobile: boolean;
  portfolioHistoryChartData: PortfolioHistoryChartPoint[];
  portfolioHistoryYDomainAccounts?: [number, number];
  portfolioHistoryYDomainDeposits?: [number, number];
  portfolioHistorySnapshotCount: number;
  targetCurrency: Currency;
  displayCurrency: string;
  onBack: () => void;
  onAddSnapshot: () => void;
  onExport?: () => void;
  deletePortfolioHistoryEntry: (fullDate: string) => void;
  editPortfolioHistoryEntrySource: (fullDate: string, newSource: string) => void;
}

type ChartMode = "accounts" | "deposits" | "both";

/** Parse a snapshot's `source` string into individual tags.
 * Source examples we've seen:
 *   "Balance change"
 *   "Chase Checking +6.6K, Car Loan -8K"
 *   "401K +30K · Empower 401K +1.4K"
 * Split on commas / middots / pipes / semicolons. Color by +/- prefix.
 */
function parseSourceTags(source: string | undefined): Array<{ text: string; tone: "positive" | "negative" | "neutral" }> {
  if (!source) return [];
  const parts = source
    .split(/[,·|;]/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts.map(p => {
    // Look for the FIRST sign character (+ or -) that introduces a number.
    // We avoid matching minus signs inside words (e.g. "Co-Loan").
    const m = p.match(/([+\-])\s*\$?[\d.,]+\s*[KMB]?/);
    if (!m) return { text: p, tone: "neutral" as const };
    return { text: p, tone: m[1] === "+" ? ("positive" as const) : ("negative" as const) };
  });
}

/** Format a delta value using a caller-provided formatter (so desktop full vs mobile short stays consistent). */
function makeFmtDelta(formatter: (n: number, c?: Currency) => string) {
  return (delta: number, currency: Currency): string => {
    if (delta === 0) return formatter(0, currency);
    const sign = delta > 0 ? "+" : "";
    return sign + formatter(delta, currency);
  };
}

export function BankChartDetailTab({
  theme: _theme,
  isMobile,
  portfolioHistoryChartData,
  portfolioHistoryYDomainAccounts,
  portfolioHistoryYDomainDeposits,
  portfolioHistorySnapshotCount,
  targetCurrency,
  displayCurrency: _displayCurrency,
  onBack,
  onAddSnapshot,
  onExport,
  deletePortfolioHistoryEntry,
  editPortfolioHistoryEntrySource,
}: BankChartDetailTabProps) {
  const [mode, setMode] = useState<ChartMode>("accounts");
  const [activeFullDate, setActiveFullDate] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Money formatter: short ($470.8K) on mobile, full ($470,800) on desktop.
  // Chart YAxis ticks always use the short form so labels don't overlap the chart body.
  const f = (n: number | string | null | undefined, cur: Currency = targetCurrency) =>
    isMobile ? fmt(n, cur) : fmtFull(n, cur);
  const fShort = (n: number | string | null | undefined, cur: Currency = targetCurrency) => fmt(n, cur);
  // Build a delta formatter that uses the same short/full mode as `f`
  const fmtDelta = makeFmtDelta((n: number, c?: Currency) => f(n, c ?? targetCurrency));

  // Real snapshots only (exclude the carry-forward-to-today projected point) for the snapshot list.
  const snapshotsAsc = useMemo(
    () => portfolioHistoryChartData.filter(p => !p.isProjected),
    [portfolioHistoryChartData]
  );

  // Show all chart points on the chart itself (including today's carry-forward) so the line reaches "today".
  const chartData = portfolioHistoryChartData;

  // ── Derived summary stats ──────────────────────────────────────
  const summary = useMemo(() => {
    if (snapshotsAsc.length === 0) {
      return { current: 0, start: 0, change: 0, changePct: 0, lastDate: "", firstDate: "", depositsValue: 0, depositsCount: 0 };
    }
    const first = snapshotsAsc[0];
    const last = snapshotsAsc[snapshotsAsc.length - 1];
    const current = (Number(last.totalAccountValue) || 0);
    const start = (Number(first.totalAccountValue) || 0);
    const change = current - start;
    const changePct = start !== 0 ? (change / Math.abs(start)) * 100 : 0;
    const depositsValue = Number(last.totalDepositValue) || 0;
    return {
      current,
      start,
      change,
      changePct,
      lastDate: last.fullDate,
      firstDate: first.fullDate,
      depositsValue,
      depositsCount: depositsValue > 0 ? 1 : 0, // we only know aggregate; show 1 if non-zero
    };
  }, [snapshotsAsc]);

  // Per-snapshot delta (vs previous real snapshot) for the right-panel list
  const deltaMap = useMemo(() => {
    const m = new Map<string, number>();
    snapshotsAsc.forEach((p, i) => {
      const cur = (Number(p.totalAccountValue) || 0) + (Number(p.totalDepositValue) || 0);
      const prev = i > 0
        ? (Number(snapshotsAsc[i - 1].totalAccountValue) || 0) + (Number(snapshotsAsc[i - 1].totalDepositValue) || 0)
        : cur;
      m.set(p.fullDate, cur - prev);
    });
    return m;
  }, [snapshotsAsc]);

  // Snapshot list display order: newest first (matches existing History & cleanup convention)
  const snapshotsDesc = useMemo(() => [...snapshotsAsc].reverse(), [snapshotsAsc]);

  // ── Interactions ───────────────────────────────────────────────
  function handlePointClick(fullDate: string | undefined) {
    if (!fullDate) return;
    setActiveFullDate(fullDate);
  }

  useEffect(() => {
    if (!activeFullDate) return;
    const el = rowRefs.current.get(activeFullDate);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeFullDate]);

  function handleEditRow(p: PortfolioHistoryChartPoint) {
    const next = window.prompt("Edit snapshot description:", p.source || "");
    if (next == null) return; // cancelled
    const trimmed = next.trim();
    if (trimmed === (p.source || "")) return;
    editPortfolioHistoryEntrySource(p.fullDate, trimmed);
  }

  function handleDeleteRow(p: PortfolioHistoryChartPoint) {
    if (!window.confirm(`Remove the snapshot from ${fmtDate(p.fullDate)}?`)) return;
    deletePortfolioHistoryEntry(p.fullDate);
    if (activeFullDate === p.fullDate) setActiveFullDate(null);
  }

  // ── Sub-components (closures over current state, kept inline for one-file simplicity) ──

  function StatBlock({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
    const subColor = tone === "pos" ? PALETTE.posText : tone === "neg" ? PALETTE.negText : PALETTE.textLight;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 10, color: PALETTE.textLight, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 800, color: PALETTE.text, fontFamily: "ui-monospace,monospace" }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: subColor, fontWeight: 600 }}>{sub}</div>}
      </div>
    );
  }

  function SegmentToggle() {
    const opts: ChartMode[] = ["accounts", "deposits", "both"];
    return (
      <div style={{
        display: "inline-flex",
        background: "#fff",
        border: `1px solid ${PALETTE.cardBorder}`,
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}>
        {opts.map(o => {
          const active = o === mode;
          return (
            <button
              key={o}
              type="button"
              onClick={() => setMode(o)}
              style={{
                background: active ? PALETTE.topbar : "transparent",
                color: active ? "#fff" : PALETTE.textMuted,
                border: "none",
                borderRadius: 8,
                padding: isMobile ? "6px 10px" : "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  function ChangeTag({ text, tone }: { text: string; tone: "positive" | "negative" | "neutral" }) {
    const bg = tone === "positive" ? PALETTE.posBg : tone === "negative" ? PALETTE.negBg : PALETTE.neutralBg;
    const fg = tone === "positive" ? PALETTE.posText : tone === "negative" ? PALETTE.negText : PALETTE.neutralText;
    return (
      <span style={{
        display: "inline-block",
        background: bg,
        color: fg,
        borderRadius: 999,
        padding: "3px 9px",
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}>{text}</span>
    );
  }

  function SnapshotRow({ p, compact }: { p: PortfolioHistoryChartPoint; compact: boolean }) {
    const isActive = activeFullDate === p.fullDate;
    const total = (Number(p.totalAccountValue) || 0) + (Number(p.totalDepositValue) || 0);
    const delta = deltaMap.get(p.fullDate) || 0;
    const tags = parseSourceTags(p.source);
    const deltaTone: "positive" | "negative" | "neutral" = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";

    return (
      <div
        ref={el => { rowRefs.current.set(p.fullDate, el); }}
        onClick={() => setActiveFullDate(p.fullDate)}
        style={{
          background: isActive ? PALETTE.rowHighlight : PALETTE.cardBg,
          border: `1px solid ${isActive ? PALETTE.rowHighlightBorder : PALETTE.divider}`,
          borderRadius: 10,
          padding: compact ? "8px 10px" : "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          cursor: "pointer",
          transition: "background 0.15s ease, border-color 0.15s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: PALETTE.textLight, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtDate(p.fullDate)}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: PALETTE.text, fontFamily: "ui-monospace,monospace" }}>{f(total)}</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleEditRow(p); }}
              title="Edit snapshot description"
              style={{ background: "transparent", border: `1px solid ${PALETTE.divider}`, borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontSize: 11 }}
            >✏️</button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleDeleteRow(p); }}
              title="Delete snapshot"
              style={{ background: PALETTE.negBg, border: `1px solid ${PALETTE.negBg}`, color: PALETTE.negText, borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontSize: 11 }}
            >🗑</button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {delta !== 0 && <ChangeTag text={fmtDelta(delta, targetCurrency)} tone={deltaTone} />}
          {tags.length > 0
            ? tags.map((t, i) => <ChangeTag key={i} text={t.text} tone={t.tone} />)
            : (delta === 0 && <ChangeTag text="Opening balance" tone="neutral" />)
          }
        </div>
      </div>
    );
  }

  // ── Charts ─────────────────────────────────────────────────────
  const lineDataKey = mode === "deposits" ? "totalDepositValue" : "totalAccountValue";
  const showSecondLine = mode === "both";
  const yDomain = mode === "deposits" ? portfolioHistoryYDomainDeposits : portfolioHistoryYDomainAccounts;

  function MainLineChart({ height }: { height: number }) {
    return (
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <ComposedChart
          data={chartData}
          margin={{ top: 6, right: 12, left: 6, bottom: 4 }}
          onClick={(state: any) => {
            const payload = state?.activePayload?.[0]?.payload as PortfolioHistoryChartPoint | undefined;
            handlePointClick(payload?.fullDate);
          }}
        >
          <defs>
            <linearGradient id="detailAccountsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PALETTE.accountLine} stopOpacity={0.35} />
              <stop offset="95%" stopColor={PALETTE.accountLine} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDECE6" vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: PALETTE.textLight, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(ts) => new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            minTickGap={28}
          />
          <YAxis
            domain={yDomain || ["auto", "auto"]}
            tick={{ fill: PALETTE.textLight, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={isMobile ? 56 : 72}
            tickFormatter={(v) => fShort(v)}
          />
          <Tooltip
            cursor={{ stroke: PALETTE.divider, strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as PortfolioHistoryChartPoint | undefined;
              if (!p) return null;
              const aVal = Number(p.totalAccountValue) || 0;
              const dVal = Number(p.totalDepositValue) || 0;
              return (
                <div style={{ background: "#fff", border: `1px solid ${PALETTE.cardBorder}`, borderRadius: 8, padding: "8px 10px", fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                  <div style={{ color: PALETTE.textMuted, marginBottom: 4 }}>{fmtDate(p.fullDate)}</div>
                  {(mode === "accounts" || mode === "both") && (
                    <div style={{ color: PALETTE.accountLine, fontWeight: 700 }}>Accounts: {f(aVal)}</div>
                  )}
                  {(mode === "deposits" || mode === "both") && (
                    <div style={{ color: PALETTE.depositBar, fontWeight: 700 }}>Deposits: {f(dVal)}</div>
                  )}
                </div>
              );
            }}
          />
          {(mode === "accounts" || mode === "both") && (
            <Area
              type="monotone"
              dataKey="totalAccountValue"
              stroke={PALETTE.accountLine}
              fill="url(#detailAccountsFill)"
              strokeWidth={2.2}
              activeDot={{ r: 5, fill: PALETTE.accountLine, stroke: "#fff", strokeWidth: 2 }}
              dot={{ r: 2.5, fill: PALETTE.accountLine }}
            />
          )}
          {mode === "deposits" && (
            <Line
              type="monotone"
              dataKey="totalDepositValue"
              stroke={PALETTE.depositBar}
              strokeWidth={2.2}
              dot={{ r: 2.5, fill: PALETTE.depositBar }}
              activeDot={{ r: 5, fill: PALETTE.depositBar, stroke: "#fff", strokeWidth: 2 }}
            />
          )}
          {showSecondLine && (
            <Line
              type="monotone"
              dataKey="totalDepositValue"
              stroke={PALETTE.depositBar}
              strokeDasharray="5 4"
              strokeWidth={2}
              dot={false}
            />
          )}
          {!showSecondLine && lineDataKey !== "totalAccountValue" && (
            // ensures activeDot also exists when only deposits-line is active (already handled above)
            null
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  function DepositBarChart({ height }: { height: number }) {
    return (
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 12, left: 6, bottom: 4 }}
          onClick={(state: any) => {
            const payload = state?.activePayload?.[0]?.payload as PortfolioHistoryChartPoint | undefined;
            handlePointClick(payload?.fullDate);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#EDECE6" vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: PALETTE.textLight, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(ts) => new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            minTickGap={28}
          />
          <YAxis
            domain={portfolioHistoryYDomainDeposits || ["auto", "auto"]}
            tick={{ fill: PALETTE.textLight, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={isMobile ? 56 : 72}
            tickFormatter={(v) => fShort(v)}
          />
          <Tooltip
            cursor={{ fill: "rgba(55,138,221,0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as PortfolioHistoryChartPoint | undefined;
              if (!p) return null;
              return (
                <div style={{ background: "#fff", border: `1px solid ${PALETTE.cardBorder}`, borderRadius: 8, padding: "8px 10px", fontSize: 11 }}>
                  <div style={{ color: PALETTE.textMuted, marginBottom: 4 }}>{fmtDate(p.fullDate)}</div>
                  <div style={{ color: PALETTE.depositBar, fontWeight: 700 }}>Deposits: {f(Number(p.totalDepositValue) || 0)}</div>
                </div>
              );
            }}
          />
          <Bar dataKey="totalDepositValue" radius={[3, 3, 0, 0]}>
            {chartData.map((p, i) => (
              <BarCell key={i} fullDate={p.fullDate} active={activeFullDate === p.fullDate} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── Top action bar (dark) ──────────────────────────────────────
  const TopBar = (
    <div style={{
      background: PALETTE.topbar,
      color: PALETTE.topbarText,
      borderRadius: 12,
      padding: isMobile ? "10px 12px" : "10px 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <button
          type="button"
          onClick={onBack}
          title="Back to Overview"
          style={{ background: "transparent", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>←</span>
          {!isMobile && <span style={{ fontWeight: 600 }}>Overview</span>}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>
          <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, lineHeight: 1.2 }}>Portfolio value over time</span>
          <span style={{ fontSize: 10, color: "#cfcfc6", lineHeight: 1.4 }}>
            {portfolioHistorySnapshotCount} snapshot{portfolioHistorySnapshotCount === 1 ? "" : "s"}
            {summary.lastDate ? ` · Last updated ${fmtDate(summary.lastDate)}` : ""}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >Export</button>
        )}
        <button
          type="button"
          onClick={onAddSnapshot}
          style={{ background: "#fff", color: PALETTE.topbar, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >+ Add snapshot</button>
      </div>
    </div>
  );

  // ── Empty state ────────────────────────────────────────────────
  if (snapshotsAsc.length === 0) {
    return (
      <div style={{ background: PALETTE.pageBg, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {TopBar}
        <div style={{ background: PALETTE.cardBg, borderRadius: 14, border: `1px solid ${PALETTE.cardBorder}`, padding: 32, textAlign: "center", color: PALETTE.textMuted }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No snapshots yet</div>
          <div style={{ fontSize: 12, color: PALETTE.textLight }}>Edit balances or click "Add snapshot" to record your first portfolio value.</div>
        </div>
      </div>
    );
  }

  // ── Render: Mobile ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ background: PALETTE.pageBg, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {TopBar}

        {/* Segment toggle */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <SegmentToggle />
        </div>

        {/* 3-stat strip */}
        <div style={{
          background: PALETTE.cardBg,
          borderRadius: 14,
          border: `1px solid ${PALETTE.cardBorder}`,
          padding: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
        }}>
          <StatBlock label="Current" value={f(summary.current)} />
          <StatBlock label="Start" value={f(summary.start)} />
          <StatBlock
            label="Change"
            value={fmtDelta(summary.change, targetCurrency)}
            sub={`${summary.changePct >= 0 ? "+" : ""}${summary.changePct.toFixed(1)}%`}
            tone={summary.change >= 0 ? "pos" : "neg"}
          />
        </div>

        {/* Chart card */}
        <div style={{ background: PALETTE.cardBg, borderRadius: 14, border: `1px solid ${PALETTE.cardBorder}`, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: PALETTE.text, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, background: PALETTE.accountLine, borderRadius: 2 }} />
            {mode === "deposits" ? "Deposits" : "Accounts"}
          </div>
          <MainLineChart height={150} />
          <div style={{ height: 1, background: PALETTE.divider, margin: "2px 0" }} />
          <div style={{ fontSize: 10, color: PALETTE.textLight, fontWeight: 600 }}>Deposits</div>
          <DepositBarChart height={90} />
          <div style={{
            alignSelf: "center",
            background: PALETTE.topbar,
            color: "#fff",
            borderRadius: 999,
            padding: "5px 11px",
            fontSize: 10,
            fontWeight: 600,
            marginTop: 4,
          }}>
            👆 Tap a point to highlight its entry below
          </div>
        </div>

        {/* Snapshot data card */}
        <div style={{ background: PALETTE.cardBg, borderRadius: 14, border: `1px solid ${PALETTE.cardBorder}`, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: PALETTE.text }}>📦 Snapshot data</div>
            <div style={{ fontSize: 10, color: PALETTE.textLight, fontWeight: 600 }}>{portfolioHistorySnapshotCount} entries</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {snapshotsDesc.map(p => <SnapshotRow key={p.fullDate} p={p} compact />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Desktop ────────────────────────────────────────────
  return (
    <div style={{ background: PALETTE.pageBg, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {TopBar}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14, alignItems: "start" }}>
        {/* ── Left column ─────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {/* 4-stat strip */}
          <div style={{
            background: PALETTE.cardBg,
            borderRadius: 14,
            border: `1px solid ${PALETTE.cardBorder}`,
            padding: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 16,
          }}>
            <StatBlock label="Current value" value={f(summary.current)} sub={summary.lastDate ? fmtDate(summary.lastDate) : undefined} />
            <StatBlock label="Starting value" value={f(summary.start)} sub={summary.firstDate ? fmtDate(summary.firstDate) : undefined} />
            <StatBlock
              label="Total change"
              value={fmtDelta(summary.change, targetCurrency)}
              sub={`${summary.changePct >= 0 ? "+" : ""}${summary.changePct.toFixed(1)}%`}
              tone={summary.change >= 0 ? "pos" : "neg"}
            />
            <StatBlock label="Deposits value" value={f(summary.depositsValue)} sub={summary.depositsCount > 0 ? `${summary.depositsCount} deposit${summary.depositsCount === 1 ? "" : "s"}` : undefined} />
          </div>

          {/* Chart card */}
          <div style={{
            background: PALETTE.cardBg,
            borderRadius: 14,
            border: `1px solid ${PALETTE.cardBorder}`,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: PALETTE.text, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, background: PALETTE.accountLine, borderRadius: 2 }} />
                Account balances
                <span style={{ fontSize: 10, color: PALETTE.textLight, fontWeight: 500, marginLeft: 10 }}>Click a point to highlight its entry</span>
              </div>
              <SegmentToggle />
            </div>
            <MainLineChart height={260} />
            <div style={{ height: 1, background: PALETTE.divider, margin: "8px 0 4px" }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: PALETTE.text, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, background: PALETTE.depositBar, borderRadius: 2 }} />
              Deposits
            </div>
            <DepositBarChart height={150} />
          </div>
        </div>

        {/* ── Right panel ─────────────────────────────────────── */}
        <div style={{
          background: PALETTE.cardBg,
          borderRadius: 14,
          border: `1px solid ${PALETTE.cardBorder}`,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          position: "sticky",
          top: 16,
          maxHeight: "calc(100vh - 80px)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.text }}>📦 Snapshot data</div>
            <div style={{ fontSize: 10, color: PALETTE.textLight, fontWeight: 600 }}>{portfolioHistorySnapshotCount} entries</div>
          </div>
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
            {snapshotsDesc.map(p => <SnapshotRow key={p.fullDate} p={p} compact={false} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

/** A single-bar cell that highlights when its fullDate matches the active selection.
 * Used inside the deposit BarChart. */
function BarCell({ fullDate: _fullDate, active, ...rest }: { fullDate: string; active: boolean; [k: string]: any }) {
  const { x, y, width, height } = rest;
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") {
    return null;
  }
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={3}
      ry={3}
      fill={active ? PALETTE.depositBar : PALETTE.depositBarLight}
      stroke={active ? PALETTE.depositBar : "none"}
      strokeWidth={active ? 1 : 0}
    />
  );
}

export default BankChartDetailTab;
