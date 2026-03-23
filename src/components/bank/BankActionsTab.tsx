import React, { useMemo, useState } from "react";
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
  isMobile: boolean;
  actionsViewMode: "cards" | "grouped";
  setActionsViewMode: (m: "cards" | "grouped") => void;
  onToggleActionDone: (index: number) => void;
  onEditAction: (index: number) => void;
  onDeleteAction: (index: number) => void;
  onAddAction: () => void;
  onEditLinked: (source: LinkedActionSource, index: number) => void;
}

type Bucket = { linked: LinkedNextActionRow[]; manual: { item: ActionItem; origIdx: number }[] };

function linkedRowKey(row: LinkedNextActionRow, i: number): string {
  return `${row.source}-${row.index}-${i}`;
}

function bankKeyForLinked(row: LinkedNextActionRow): string {
  const b = row.bank.trim();
  if (b) return b;
  if (row.source === "bill") return "Bills (no bank)";
  return "Other";
}

function bankKeyForManual(a: ActionItem): string {
  return a.bank.trim() || "Other";
}

function sortBankKeys(keys: string[]): string[] {
  const last = ["Other", "Bills (no bank)"];
  return [...keys].sort((a, b) => {
    const ia = last.indexOf(a);
    const ib = last.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return 1;
    if (ib !== -1) return -1;
    return a.localeCompare(b);
  });
}

export function BankActionsTab({
  theme: THEME,
  actions,
  linkedFromRecords,
  showDone,
  setShowDone,
  isMobile,
  actionsViewMode,
  setActionsViewMode,
  onToggleActionDone,
  onEditAction,
  onDeleteAction,
  onAddAction,
  onEditLinked,
}: BankActionsTabProps) {
  const manualVisible = useMemo(() => actions.filter((a) => showDone || !a.done), [actions, showDone]);
  const linkedVisible = linkedFromRecords;
  const hasAny = manualVisible.length > 0 || linkedVisible.length > 0;

  const buckets = useMemo(() => {
    const map: Record<string, Bucket> = {};
    const ensure = (k: string): Bucket => {
      if (!map[k]) map[k] = { linked: [], manual: [] };
      return map[k];
    };
    linkedFromRecords.forEach((row) => {
      ensure(bankKeyForLinked(row)).linked.push(row);
    });
    manualVisible.forEach((a) => {
      const origIdx = actions.indexOf(a);
      ensure(bankKeyForManual(a)).manual.push({ item: a, origIdx });
    });
    return map;
  }, [linkedFromRecords, manualVisible, actions]);

  const bankNames = useMemo(() => sortBankKeys(Object.keys(buckets)), [buckets]);

  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());

  const toggleBank = (bank: string) => {
    setExpandedBanks((prev) => {
      const next = new Set(prev);
      if (next.has(bank)) next.delete(bank);
      else next.add(bank);
      return next;
    });
  };

  const viewToggle = (
    <div style={{ display: "flex", gap: 1, background: THEME.cardBg, borderRadius: 6, padding: 2, border: `1px solid ${THEME.border}` }}>
      <button
        type="button"
        onClick={() => setActionsViewMode("cards")}
        style={{
          background: actionsViewMode === "cards" ? "#238636" : "transparent",
          color: actionsViewMode === "cards" ? "#FFF" : "#6B7280",
          border: "none",
          padding: "4px 10px",
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 600,
          cursor: "pointer",
        }}
        title="Card grid"
      >
        ▦ Cards
      </button>
      <button
        type="button"
        onClick={() => setActionsViewMode("grouped")}
        style={{
          background: actionsViewMode === "grouped" ? "#238636" : "transparent",
          color: actionsViewMode === "grouped" ? "#FFF" : "#6B7280",
          border: "none",
          padding: "4px 10px",
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 600,
          cursor: "pointer",
        }}
        title="List view grouped by bank"
      >
        ▤ By Bank
      </button>
    </div>
  );

  const renderLinkedCard = (row: LinkedNextActionRow, i: number) => {
    const days = row.date ? daysUntil(row.date) : null;
    const srcLabel = row.source === "account" ? "Account" : row.source === "deposit" ? "Deposit" : "Bill";
    return (
      <div
        key={linkedRowKey(row, i)}
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
            type="button"
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
  };

  const renderManualCard = (a: ActionItem, origIdx: number, i: number) => {
    const days = daysUntil(a.date);
    return (
      <div key={`action-${origIdx}-${i}`} style={{ background: THEME.cardBgAlt, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: "14px 16px", opacity: a.done ? 0.6 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, color: a.done ? THEME.textMuted : THEME.text, fontSize: 14, textDecoration: a.done ? "line-through" : "none", flex: 1 }}>
            {a.title}
          </div>
          <button
            type="button"
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
              type="button"
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
              type="button"
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
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 10, lineHeight: 1.45 }}>
        <strong>Due date</strong> = calendar day for the task (from Excel or parsed from title). <strong>Days left</strong> = countdown / urgency badge vs today — same field drives both.
      </div>
      {/* Toolbar: match Bills / Deposits — toggles left, primary add right, filter row below */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {viewToggle}
          <span style={{ fontSize: 10, color: THEME.textMuted }}>By Bank list groups manual + linked rows by bank</span>
        </div>
        <button
          type="button"
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
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: THEME.textMuted }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ accentColor: "#F59E0B" }} />
          Show completed
        </label>
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
      ) : actionsViewMode === "grouped" ? (
        <div style={{ background: THEME.cardBgAlt, borderRadius: 12, overflow: "hidden", border: `1px solid ${THEME.border}` }}>
          <div style={{ overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: `${THEME.border} ${THEME.bg}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: THEME.cardBg, borderBottom: `1px solid ${THEME.border}` }}>
                  {["Bank / group", "Title", "Source", "Note", "Due date", "Days left", ""].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: THEME.textMuted, fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bankNames.map((bankName) => {
                  const bucket = buckets[bankName];
                  if (!bucket) return null;
                  const rowCount = bucket.linked.length + bucket.manual.length;
                  const color = getBankColor(bankName === "Bills (no bank)" ? "Bills" : bankName === "Other" ? "Other" : bankName);
                  const isExpanded = expandedBanks.has(bankName);
                  return (
                    <React.Fragment key={bankName}>
                      <tr onClick={() => toggleBank(bankName)} style={{ background: `${color}15`, cursor: "pointer", borderBottom: `1px solid ${THEME.border}` }}>
                        <td colSpan={7} style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, color: "#6B7280", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▶</span>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, color: THEME.text, fontSize: 12 }}>{bankName}</span>
                            <span style={{ color: "#6B7280", fontSize: 10 }}>
                              ({rowCount} item{rowCount !== 1 ? "s" : ""})
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded &&
                        bucket.linked.map((row, i) => {
                          const days = row.date ? daysUntil(row.date) : null;
                          const srcLabel = row.source === "account" ? "Account" : row.source === "deposit" ? "Deposit" : "Bill";
                          return (
                            <tr key={`l-${linkedRowKey(row, i)}`} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                              <td style={{ padding: "8px 10px", paddingLeft: 28, color: THEME.textLight, fontSize: 10 }}>—</td>
                              <td style={{ padding: "8px 10px", fontWeight: 600, color: THEME.text }}>{row.title}</td>
                              <td style={{ padding: "8px 10px", color: THEME.textLight }}>{srcLabel}</td>
                              <td style={{ padding: "8px 10px", color: THEME.textLight, fontSize: 10, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }} title={row.note}>
                                {row.note || "—"}
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{row.date ? fmtDate(row.date) : "—"}</td>
                              <td style={{ padding: "8px 10px" }}>{days != null ? <UrgencyBadge days={days} /> : "—"}</td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditLinked(row.source, row.index);
                                  }}
                                  style={{ background: THEME.cardBgAlt, color: "#2563eb", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 9, cursor: "pointer" }}
                                >
                                  ✏️ Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      {isExpanded &&
                        bucket.manual.map(({ item: a, origIdx }, j) => {
                          const days = daysUntil(a.date);
                          return (
                            <tr key={`m-${origIdx}-${j}`} style={{ borderBottom: `1px solid ${THEME.border}`, opacity: a.done ? 0.65 : 1 }}>
                              <td style={{ padding: "8px 10px", paddingLeft: 28, color: THEME.textLight, fontSize: 10 }}>—</td>
                              <td style={{ padding: "8px 10px", fontWeight: 600, color: a.done ? THEME.textMuted : THEME.text, textDecoration: a.done ? "line-through" : "none" }}>{a.title}</td>
                              <td style={{ padding: "8px 10px", color: THEME.textLight }}>Manual</td>
                              <td style={{ padding: "8px 10px", color: THEME.textLight, fontSize: 10, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }} title={a.note}>
                                {a.note || "—"}
                              </td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{a.date ? fmtDate(a.date) : "—"}</td>
                              <td style={{ padding: "8px 10px" }}>{days != null && !a.done ? <UrgencyBadge days={days} /> : "—"}</td>
                              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                                <button type="button" onClick={(e) => { e.stopPropagation(); onToggleActionDone(origIdx); }} style={{ background: a.done ? "#238636" : THEME.cardBgAlt, color: a.done ? "#fff" : THEME.textMuted, border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer", marginRight: 4, fontWeight: 600 }}>
                                  {a.done ? "↩" : "✓"}
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); onEditAction(origIdx); }} style={{ background: THEME.cardBgAlt, color: "#2563eb", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer", marginRight: 4 }}>
                                  ✏️
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteAction(origIdx); }} style={{ background: THEME.cardBgAlt, color: "#F85149", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer" }}>
                                  🗑
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {linkedVisible.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                From spreadsheet / records ({linkedVisible.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
                {linkedVisible.map((row, i) => renderLinkedCard(row, i))}
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
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
                {manualVisible.map((a, i) => {
                  const origIdx = actions.indexOf(a);
                  return renderManualCard(a, origIdx, i);
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
