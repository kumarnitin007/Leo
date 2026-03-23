import React, { useMemo, useState } from "react";
import type { Bill, Currency } from "../../types/bankRecords";
import type { BankDashboardTheme } from "../../bank/bankDashboardTheme";
import { convertCurrency, fmt, getBankColor } from "../../bank/bankDashboardFormat";
import { EmptyState } from "./BankDashboardPrimitives";

export interface BankBillsTabProps {
  theme: BankDashboardTheme;
  bills: Bill[];
  isMobile: boolean;
  showDone: boolean;
  setShowDone: (v: boolean) => void;
  billsViewMode: "cards" | "grouped";
  setBillsViewMode: (m: "cards" | "grouped") => void;
  targetCurrency: Currency;
  exchangeRates: { USD: number; EUR: number; GBP: number };
  openAdd: (t: string) => void;
  openEdit: (t: string, i: number) => void;
  deleteRow: (t: string, i: number) => void;
  toggleDone: (t: string, i: number) => void;
}

function categoryKey(b: Bill): string {
  const c = (b.category || "").trim();
  return c || "Uncategorized";
}

export function BankBillsTab({
  theme: THEME,
  bills,
  isMobile,
  showDone,
  setShowDone,
  billsViewMode,
  setBillsViewMode,
  targetCurrency,
  exchangeRates,
  openAdd,
  openEdit,
  deleteRow,
  toggleDone,
}: BankBillsTabProps) {
  const visibleBills = bills.filter((b) => (showDone ? b.done : !b.done));

  const groupedByCategory = useMemo(() => {
    const map: Record<string, Bill[]> = {};
    visibleBills.forEach((b) => {
      const k = categoryKey(b);
      if (!map[k]) map[k] = [];
      map[k].push(b);
    });
    return map;
  }, [visibleBills]);

  const categoryNames = useMemo(() => {
    return Object.keys(groupedByCategory).sort((a, b) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
  }, [groupedByCategory]);

  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const pendingTotal = bills
    .filter((b) => !b.done)
    .reduce(
      (s, b) => s + convertCurrency(Number(b.amount) || 0, (b.currency || "INR") as Currency, targetCurrency, exchangeRates),
      0
    );

  const viewToggle = (
    <div style={{ display: "flex", gap: 1, background: THEME.cardBg, borderRadius: 6, padding: 2, border: `1px solid ${THEME.border}` }}>
      <button
        type="button"
        onClick={() => setBillsViewMode("cards")}
        style={{
          background: billsViewMode === "cards" ? "#238636" : "transparent",
          color: billsViewMode === "cards" ? "#FFF" : "#6B7280",
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
        onClick={() => setBillsViewMode("grouped")}
        style={{
          background: billsViewMode === "grouped" ? "#238636" : "transparent",
          color: billsViewMode === "grouped" ? "#FFF" : "#6B7280",
          border: "none",
          padding: "4px 10px",
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 600,
          cursor: "pointer",
        }}
        title="List view — grouped by category (bills have no bank field)"
      >
        ▤ By Bank
      </button>
    </div>
  );

  return (
    <div>
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              background: THEME.headerBg,
              borderRadius: 14,
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>PENDING BILLS</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{bills.filter((b) => !b.done).length}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>TOTAL DUE</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#FCD34D", fontFamily: "monospace" }}>{fmt(pendingTotal, targetCurrency)}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            {viewToggle}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowDone(false)}
              style={{
                flex: 1,
                background: !showDone ? "#F59E0B" : THEME.cardBgAlt,
                color: !showDone ? "#000" : THEME.textLight,
                border: "none",
                borderRadius: 10,
                padding: "10px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Pending ({bills.filter((b) => !b.done).length})
            </button>
            <button
              onClick={() => setShowDone(true)}
              style={{
                flex: 1,
                background: showDone ? "#10B981" : THEME.cardBgAlt,
                color: showDone ? "#FFF" : THEME.textLight,
                border: "none",
                borderRadius: 10,
                padding: "10px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Paid ({bills.filter((b) => b.done).length})
            </button>
          </div>

          {bills.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>No bills tracked yet</div>
          ) : billsViewMode === "grouped" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {categoryNames.map((cat) => {
                const list = groupedByCategory[cat] || [];
                const color = getBankColor(cat);
                const isExpanded = expandedCats.has(cat);
                const catTotal = list.reduce(
                  (s, b) => s + convertCurrency(Number(b.amount) || 0, (b.currency || "INR") as Currency, targetCurrency, exchangeRates),
                  0
                );
                return (
                  <div key={cat} style={{ background: THEME.cardBgAlt, borderRadius: 14, overflow: "hidden", border: `1px solid ${THEME.border}` }}>
                    <button
                      type="button"
                      onClick={() => toggleCat(cat)}
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 14px",
                        background: `${color}12`,
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, color: "#6B7280", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▶</span>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: THEME.text, fontSize: 14 }}>{cat}</span>
                        <span style={{ fontSize: 11, color: THEME.textMuted }}>({list.length})</span>
                      </div>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 13, color: THEME.text }}>{fmt(catTotal, targetCurrency)}</span>
                    </button>
                    {isExpanded &&
                      list.map((bill, i) => {
                        const origIdx = bills.indexOf(bill);
                        return (
                          <div
                            key={`${cat}-${i}`}
                            style={{
                              padding: "14px",
                              borderTop: `1px solid ${THEME.border}`,
                              borderLeft: `4px solid ${color}`,
                              opacity: bill.done ? 0.7 : 1,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: bill.done ? "#6B7280" : THEME.text,
                                    textDecoration: bill.done ? "line-through" : "none",
                                  }}
                                >
                                  {bill.name}
                                </div>
                                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{bill.freq}</div>
                              </div>
                              {bill.amount ? (
                                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: bill.done ? "#6B7280" : "#F59E0B" }}>
                                  {fmt(bill.amount, (bill.currency || "INR") as Currency)}
                                </div>
                              ) : null}
                            </div>
                            {bill.due ? <div style={{ fontSize: 12, color: THEME.textLight, marginBottom: 10 }}>Due: {bill.due}</div> : null}
                            {bill.nextAction && !bill.done ? (
                              <div style={{ fontSize: 11, color: "#2563EB", marginBottom: 10, fontWeight: 600 }}>📌 Next: {bill.nextAction}</div>
                            ) : null}
                            <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${THEME.border}` }}>
                              <button
                                onClick={() => toggleDone("bill", origIdx)}
                                style={{
                                  flex: 1,
                                  background: bill.done ? "#dcfce7" : "#F59E0B20",
                                  color: bill.done ? "#34D399" : "#F59E0B",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "10px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {bill.done ? "↩ Unpaid" : "✓ Mark Paid"}
                              </button>
                              <button onClick={() => openEdit("bill", origIdx)} style={{ background: "#1D4ED820", color: "#60A5FA", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                                ✏️
                              </button>
                              <button onClick={() => deleteRow("bill", origIdx)} style={{ background: "#7F1D1D20", color: "#FCA5A5", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                                🗑
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
              {visibleBills.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#6B7280", fontSize: 13 }}>{showDone ? "No paid bills in this filter" : "All bills are paid! 🎉"}</div>
              ) : null}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleBills.map((bill, i) => {
                const origIdx = bills.indexOf(bill);
                return (
                  <div
                    key={i}
                    style={{
                      background: THEME.cardBgAlt,
                      borderRadius: 14,
                      padding: "14px",
                      borderLeft: `4px solid ${bill.done ? "#10B981" : "#F59E0B"}`,
                      opacity: bill.done ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: bill.done ? "#6B7280" : THEME.text,
                            textDecoration: bill.done ? "line-through" : "none",
                          }}
                        >
                          {bill.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{bill.freq}</div>
                      </div>
                      {bill.amount ? (
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: bill.done ? "#6B7280" : "#F59E0B" }}>{fmt(bill.amount, (bill.currency || "INR") as Currency)}</div>
                      ) : null}
                    </div>

                    {bill.due ? <div style={{ fontSize: 12, color: THEME.textLight, marginBottom: 10 }}>Due: {bill.due}</div> : null}
                    {bill.nextAction && !bill.done ? (
                      <div style={{ fontSize: 11, color: "#2563EB", marginBottom: 10, fontWeight: 600 }}>📌 Next: {bill.nextAction}</div>
                    ) : null}

                    <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${THEME.border}` }}>
                      <button
                        onClick={() => toggleDone("bill", origIdx)}
                        style={{
                          flex: 1,
                          background: bill.done ? "#dcfce7" : "#F59E0B20",
                          color: bill.done ? "#34D399" : "#F59E0B",
                          border: "none",
                          borderRadius: 8,
                          padding: "10px",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {bill.done ? "↩ Unpaid" : "✓ Mark Paid"}
                      </button>
                      <button onClick={() => openEdit("bill", origIdx)} style={{ background: "#1D4ED820", color: "#60A5FA", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                        ✏️
                      </button>
                      <button onClick={() => deleteRow("bill", origIdx)} style={{ background: "#7F1D1D20", color: "#FCA5A5", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
              {visibleBills.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#6B7280", fontSize: 13 }}>{showDone ? "No paid bills yet" : "All bills are paid! 🎉"}</div>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {viewToggle}
              <span style={{ fontSize: 10, color: THEME.textMuted }}>By Bank list groups by category</span>
            </div>
            <button
              onClick={() => openAdd("bill")}
              style={{
                background: "linear-gradient(135deg,#065F46,#059669)",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "7px 16px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + Add Bill
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: THEME.textMuted }}>
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ accentColor: "#F59E0B" }} />
              Show paid
            </label>
          </div>
          {bills.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No Bills Tracked"
              description="Add recurring bills and subscriptions to never miss a payment"
              action="+ Add Bill"
              onAction={() => openAdd("bill")}
            />
          ) : billsViewMode === "grouped" ? (
            <div style={{ background: THEME.cardBgAlt, borderRadius: 12, overflow: "hidden", border: `1px solid ${THEME.border}` }}>
              <div style={{ overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: `${THEME.border} ${THEME.bg}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: THEME.cardBg, borderBottom: `1px solid ${THEME.border}` }}>
                      {["Category", "Name", "Freq", "Amount", "Due", "Priority", "Next action", "Paid", ""].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: THEME.textMuted, fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBills.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: 32, textAlign: "center", color: THEME.textMuted }}>
                          {showDone ? "No paid bills" : "No pending bills"}
                        </td>
                      </tr>
                    ) : (
                      categoryNames.map((cat) => {
                        const list = groupedByCategory[cat] || [];
                        const color = getBankColor(cat);
                        const isExpanded = expandedCats.has(cat);
                        const catTotal = list.reduce(
                          (s, b) => s + convertCurrency(Number(b.amount) || 0, (b.currency || "INR") as Currency, targetCurrency, exchangeRates),
                          0
                        );
                        return (
                          <React.Fragment key={cat}>
                            <tr onClick={() => toggleCat(cat)} style={{ background: `${color}15`, cursor: "pointer", borderBottom: `1px solid ${THEME.border}` }}>
                              <td colSpan={9} style={{ padding: "10px 12px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 10, color: "#6B7280", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▶</span>
                                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                                    <span style={{ fontWeight: 700, color: THEME.text, fontSize: 12 }}>{cat}</span>
                                    <span style={{ color: "#6B7280", fontSize: 10 }}>({list.length})</span>
                                  </div>
                                  <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 12, color: THEME.text }}>{fmt(catTotal, targetCurrency)}</span>
                                </div>
                              </td>
                            </tr>
                            {isExpanded &&
                              list.map((bill, j) => {
                                const origIdx = bills.indexOf(bill);
                                return (
                                  <tr key={`${cat}-${j}`} style={{ borderBottom: `1px solid ${THEME.border}`, opacity: bill.done ? 0.65 : 1 }}>
                                    <td style={{ padding: "8px 10px", paddingLeft: 28, color: THEME.textLight, fontSize: 10 }}>—</td>
                                    <td style={{ padding: "8px 10px", fontWeight: 600, color: bill.done ? THEME.textMuted : THEME.text, textDecoration: bill.done ? "line-through" : "none" }}>{bill.name}</td>
                                    <td style={{ padding: "8px 10px", color: THEME.textLight }}>{bill.freq}</td>
                                    <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 600 }}>{bill.amount ? fmt(bill.amount, (bill.currency || "INR") as Currency) : "—"}</td>
                                    <td style={{ padding: "8px 10px", color: THEME.textLight }}>{bill.due || "—"}</td>
                                    <td style={{ padding: "8px 10px" }}>{bill.priority || "—"}</td>
                                    <td style={{ padding: "8px 10px", color: bill.nextAction ? "#F59E0B" : THEME.textLight, fontSize: 10, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }} title={bill.nextAction}>
                                      {bill.nextAction || "—"}
                                    </td>
                                    <td style={{ padding: "8px 10px" }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleDone("bill", origIdx);
                                        }}
                                        style={{
                                          background: bill.done ? "#dcfce7" : THEME.cardBgAlt,
                                          color: bill.done ? "#15803d" : THEME.textMuted,
                                          border: `1px solid ${bill.done ? "#16a34a" : THEME.border}`,
                                          borderRadius: 6,
                                          padding: "2px 8px",
                                          fontSize: 10,
                                          cursor: "pointer",
                                          fontWeight: 700,
                                        }}
                                      >
                                        {bill.done ? "Paid" : "No"}
                                      </button>
                                    </td>
                                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); openEdit("bill", origIdx); }} style={{ background: THEME.cardBgAlt, color: "#2563eb", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer", marginRight: 4 }}>
                                        ✏️
                                      </button>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); deleteRow("bill", origIdx); }} style={{ background: THEME.cardBgAlt, color: "#F85149", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 9, cursor: "pointer" }}>
                                        🗑
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
              {visibleBills.map((bill, i) => {
                const origIdx = bills.indexOf(bill);
                return (
                  <div
                    key={i}
                    style={{
                      background: THEME.cardBgAlt,
                      borderRadius: 12,
                      padding: 16,
                      border: `1px solid ${THEME.border}`,
                      opacity: bill.done ? 0.55 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: bill.done ? THEME.textMuted : THEME.text,
                          fontSize: 14,
                          textDecoration: bill.done ? "line-through" : "none",
                          flex: 1,
                        }}
                      >
                        {bill.name}
                      </div>
                      <button
                        onClick={() => toggleDone("bill", origIdx)}
                        style={{
                          background: bill.done ? "#dcfce7" : THEME.cardBgAlt,
                          color: bill.done ? "#34D399" : "#6B7280",
                          border: `1px solid ${bill.done ? "#16a34a" : THEME.border}`,
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontSize: 10,
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        {bill.done ? "↩" : "✓"}
                      </button>
                    </div>
                    {bill.amount ? (
                      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: THEME.text, marginBottom: 4 }}>{fmt(bill.amount, (bill.currency || "INR") as Currency)}</div>
                    ) : null}
                    {bill.nextAction && !bill.done ? (
                      <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 600, marginBottom: 4 }}>📌 {bill.nextAction}</div>
                    ) : null}
                    <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 6 }}>
                      {bill.freq} · Due: {bill.due || "—"}
                    </div>
                    {(bill.category || "").trim() ? (
                      <div style={{ fontSize: 10, color: THEME.textLight, marginBottom: 6 }}>Category: {bill.category}</div>
                    ) : null}
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button
                        onClick={() => openEdit("bill", origIdx)}
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
                        onClick={() => deleteRow("bill", origIdx)}
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
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
