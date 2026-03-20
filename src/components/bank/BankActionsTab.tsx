import React from "react";
import type { ActionItem } from "../../types/bankRecords";
import type { BankDashboardTheme } from "../../bank/bankDashboardTheme";
import type { LinkedActionSource, LinkedNextActionRow } from "../../bank/bankLinkedActions";
import { daysUntil, fmtDate, getBankColor } from "../../bank/bankDashboardFormat";
import { UrgencyBadge } from "./BankDashboardPrimitives";

export interface BankActionsTabProps {
  theme: BankDashboardTheme;
  actions: ActionItem[];
  linkedFromRecords: LinkedNextActionRow[];
  showDone: boolean;
  setShowDone: (v: boolean) => void;
  onToggleActionDone: (index: number) => void;
  onEditAction: (index: number) => void;
  onDeleteAction: (index: number) => void;
  onAddAction: () => void;
  onEditLinked: (source: LinkedActionSource, index: number) => void;
}

export function BankActionsTab({
  theme: THEME,
  actions,
  linkedFromRecords,
  showDone,
  setShowDone,
  onToggleActionDone,
  onEditAction,
  onDeleteAction,
  onAddAction,
  onEditLinked,
}: BankActionsTabProps) {
  const manualVisible = actions.filter((a) => showDone || !a.done);
  const linkedVisible = linkedFromRecords;
  const hasAny = manualVisible.length > 0 || linkedVisible.length > 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: THEME.text }}>⚡ Action Items</div>
          <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2 }}>
            Manual tasks plus <strong>Next Action</strong> from Accounts, Deposits, and Bills (edit the row to update)
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: THEME.textMuted }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ accentColor: "#3B82F6" }} />
            Show completed
          </label>
          <button
            onClick={onAddAction}
            style={{
              background: "linear-gradient(135deg,#065F46,#059669)",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "7px 16px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + Add Action
          </button>
        </div>
      </div>

      {!hasAny ? (
        <div
          style={{
            background: THEME.cardBgAlt,
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            color: THEME.textMuted,
            border: `1px dashed ${THEME.border}`,
          }}
        >
          No action items yet. Add a <strong>Next Action</strong> on an account, deposit, or bill, or click &quot;+ Add Action&quot;.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {linkedVisible.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                From spreadsheet / records ({linkedVisible.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
                {linkedVisible.map((row, i) => {
                  const days = row.date ? daysUntil(row.date) : null;
                  const srcLabel =
                    row.source === "account" ? "Account" : row.source === "deposit" ? "Deposit" : "Bill";
                  return (
                    <div
                      key={`linked-${row.source}-${row.index}-${i}`}
                      style={{
                        background: THEME.cardBgAlt,
                        border: `1px solid ${THEME.border}`,
                        borderRadius: 12,
                        padding: "14px 16px",
                        borderLeft: "4px solid #F59E0B",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, color: THEME.text, fontSize: 14, flex: 1 }}>{row.title}</div>
                        <span style={{ fontSize: 10, color: THEME.textMuted, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{srcLabel}</span>
                      </div>
                      {row.bank ? (
                        <div style={{ fontSize: 12, color: getBankColor(row.bank), fontWeight: 600, marginBottom: 4 }}>🏦 {row.bank}</div>
                      ) : null}
                      {row.note ? <div style={{ fontSize: 12, color: THEME.textLight, marginBottom: 6 }}>{row.note}</div> : null}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                        {row.date ? <div style={{ fontSize: 12, color: THEME.textLight }}>{fmtDate(row.date)}</div> : <div />}
                        {days != null && <UrgencyBadge days={days} />}
                        <button
                          onClick={() => onEditLinked(row.source, row.index)}
                          style={{
                            marginLeft: "auto",
                            background: "#1D4ED820",
                            color: "#60A5FA",
                            border: "1px solid #1D4ED840",
                            borderRadius: 7,
                            padding: "3px 10px",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          ✏️ Edit record
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {manualVisible.length > 0 && (
            <div>
              {linkedVisible.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Manual actions ({manualVisible.length})
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
                {manualVisible.map((a, i) => {
                  const origIdx = actions.indexOf(a);
                  const days = daysUntil(a.date);
                  return (
                    <div key={`action-${origIdx}-${i}`} style={{ background: THEME.cardBgAlt, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: "14px 16px", opacity: a.done ? 0.6 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, color: a.done ? THEME.textMuted : THEME.text, fontSize: 14, textDecoration: a.done ? "line-through" : "none", flex: 1 }}>
                          {a.title}
                        </div>
                        <button
                          onClick={() => onToggleActionDone(origIdx)}
                          style={{
                            background: a.done ? "#dcfce7" : THEME.cardBgAlt,
                            color: a.done ? "#15803d" : THEME.textMuted,
                            border: `1px solid ${a.done ? "#16a34a" : THEME.border}`,
                            borderRadius: 6,
                            padding: "2px 8px",
                            fontSize: 10,
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {a.done ? "↩" : "✓"}
                        </button>
                      </div>
                      {a.bank && (
                        <div style={{ fontSize: 12, color: getBankColor(a.bank), fontWeight: 600, marginBottom: 4 }}>🏦 {a.bank}</div>
                      )}
                      {a.note && <div style={{ fontSize: 12, color: THEME.textLight, marginBottom: 6 }}>{a.note}</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                        {a.date && <div style={{ fontSize: 12, color: THEME.textLight }}>{fmtDate(a.date)}</div>}
                        {days != null && !a.done && <UrgencyBadge days={days} />}
                        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                          <button
                            onClick={() => onEditAction(origIdx)}
                            style={{
                              background: "#1D4ED820",
                              color: "#60A5FA",
                              border: "1px solid #1D4ED840",
                              borderRadius: 7,
                              padding: "3px 8px",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => onDeleteAction(origIdx)}
                            style={{
                              background: "#7F1D1D20",
                              color: "#FCA5A5",
                              border: "1px solid #7F1D1D40",
                              borderRadius: 7,
                              padding: "3px 8px",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
