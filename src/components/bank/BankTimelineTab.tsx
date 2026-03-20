import React from "react";
import type { Currency, Deposit } from "../../types/bankRecords";
import type { BankDashboardTheme } from "../../bank/bankDashboardTheme";
import { daysUntil, fmt, getBankColor } from "../../bank/bankDashboardFormat";
import { UrgencyBadge } from "./BankDashboardPrimitives";

export interface BankTimelineTabProps {
  theme: BankDashboardTheme;
  sortedDeps: Deposit[];
  deposits: Deposit[];
  showDone: boolean;
  setShowDone: (v: boolean) => void;
  onToggleDepositDone: (index: number) => void;
  onEditDeposit: (index: number) => void;
}

export function BankTimelineTab({
  theme: THEME,
  sortedDeps,
  deposits,
  showDone,
  setShowDone,
  onToggleDepositDone,
  onEditDeposit,
}: BankTimelineTabProps) {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: THEME.text }}>📅 Maturity Timeline</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: THEME.textMuted }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ accentColor: "#3B82F6" }} />
            Show completed
          </label>
        </div>
      </div>

      <div style={{ background: THEME.cardBgAlt, borderRadius: 16, padding: 24, position: "relative", border: `1px solid ${THEME.border}` }}>
        <div style={{ position: "absolute", left: 130, top: 24, bottom: 24, width: 2, background: THEME.border, zIndex: 0 }} />
        {sortedDeps.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: THEME.textMuted }}>No deposits to show</div>
        )}
        {sortedDeps
          .filter((d) => showDone || !d.done)
          .map((d, i) => {
            const origIdx = deposits.indexOf(d);
            const days = daysUntil(d.maturityDate);
            const isPast = days !== null && days < 0;
            const isDone = d.done;
            const color = getBankColor(d.bank);
            const dotColor = isDone ? "#22c55e" : isPast ? THEME.textMuted : color;
            const depCur = (d.currency || "INR") as Currency;
            const rowBg = isDone
              ? "rgba(34,197,94,0.08)"
              : isPast
                ? `${THEME.cardBg}`
                : days != null && days <= 90
                  ? "rgba(239,68,68,0.07)"
                  : THEME.cardBg;
            const cardBorder = isDone
              ? "rgba(34,197,94,0.45)"
              : isPast
                ? THEME.border
                : days != null && days <= 90
                  ? "rgba(239,68,68,0.35)"
                  : THEME.border;

            return (
              <div
                key={`${origIdx}-${i}`}
                style={{
                  display: "flex",
                  gap: 16,
                  marginBottom: 14,
                  opacity: isDone ? 0.72 : isPast ? 0.88 : 1,
                  position: "relative",
                  zIndex: 1,
                  transition: "opacity 0.3s",
                }}
              >
                <div style={{ width: 116, textAlign: "right", flexShrink: 0, paddingTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isDone ? "#15803d" : isPast ? THEME.textMuted : THEME.textMuted }}>
                    {d.maturityDate ? new Date(d.maturityDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isDone ? "#15803d" : isPast ? THEME.textMuted : THEME.text }}>
                    {d.maturityDate ? new Date(d.maturityDate).getDate() : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 12, flexShrink: 0 }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: dotColor,
                      border: `2px solid ${dotColor}`,
                      boxShadow: isDone ? "0 0 10px rgba(34,197,94,0.35)" : isPast ? "none" : `0 0 8px ${color}40`,
                      transition: "all 0.3s",
                    }}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    background: rowBg,
                    border: `1px solid ${cardBorder}`,
                    borderRadius: 14,
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                    transition: "all 0.3s",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: isDone ? THEME.textMuted : THEME.text,
                          fontSize: 14,
                          textDecoration: isDone ? "line-through" : "none",
                        }}
                      >
                        {d.bank || d.depositId || d.type || "Unnamed"}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: THEME.textMuted,
                          background: THEME.cardBgAlt,
                          padding: "2px 8px",
                          borderRadius: 20,
                          border: `1px solid ${THEME.border}`,
                        }}
                      >
                        {d.type}
                      </span>
                      {depCur !== "INR" && <span style={{ fontSize: 10, color: THEME.textMuted, fontWeight: 600 }}>{depCur}</span>}
                      {isDone && <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>✓ Done</span>}
                    </div>
                    <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 4 }}>
                      {[d.nominee, d.roi ? `${(Number(d.roi) * 100).toFixed(2)}% pa` : "", d.duration || ""].filter(Boolean).join(" · ")}
                    </div>
                    {d.maturityAction && (
                      <div style={{ fontSize: 11, color: THEME.textLight, marginTop: 3, fontStyle: "italic" }}>{d.maturityAction}</div>
                    )}
                    {d.depositId && (
                      <div style={{ fontSize: 10, color: THEME.textLight, marginTop: 2, fontFamily: "monospace" }}>{d.depositId}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 800,
                        fontSize: 15,
                        color: isDone ? THEME.textMuted : isPast ? THEME.textMuted : THEME.accent,
                      }}
                    >
                      {fmt(d.maturityAmt || d.deposit, depCur)}
                    </div>
                    {!isDone && <UrgencyBadge days={days} />}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => onToggleDepositDone(origIdx)}
                        style={{
                          background: isDone ? "#dcfce7" : THEME.cardBgAlt,
                          color: isDone ? "#15803d" : THEME.text,
                          border: `1px solid ${isDone ? "#16a34a" : THEME.border}`,
                          borderRadius: 7,
                          padding: "3px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: 700,
                        }}
                      >
                        {isDone ? "↩ Undo" : "✓ Done"}
                      </button>
                      <button
                        onClick={() => onEditDeposit(origIdx)}
                        style={{
                          background: "#1D4ED820",
                          color: "#60A5FA",
                          border: "1px solid #1D4ED840",
                          borderRadius: 7,
                          padding: "3px 8px",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
