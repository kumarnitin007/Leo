import React from "react";
import type { Bill, Currency } from "../../types/bankRecords";
import type { BankDashboardTheme } from "../../bank/bankDashboardTheme";
import { convertCurrency, fmt } from "../../bank/bankDashboardFormat";
import { EmptyState } from "./BankDashboardPrimitives";

export interface BankBillsTabProps {
  theme: BankDashboardTheme;
  bills: Bill[];
  isMobile: boolean;
  showDone: boolean;
  setShowDone: (v: boolean) => void;
  targetCurrency: Currency;
  exchangeRates: { USD: number; EUR: number; GBP: number };
  openAdd: (t: string) => void;
  openEdit: (t: string, i: number) => void;
  deleteRow: (t: string, i: number) => void;
  toggleDone: (t: string, i: number) => void;
}

export function BankBillsTab({
  theme: THEME,
  bills,
  isMobile,
  showDone,
  setShowDone,
  targetCurrency,
  exchangeRates,
  openAdd,
  openEdit,
  deleteRow,
  toggleDone,
}: BankBillsTabProps) {
  const pendingTotal = bills
    .filter((b) => !b.done)
    .reduce(
      (s, b) => s + convertCurrency(Number(b.amount) || 0, (b.currency || "INR") as Currency, targetCurrency, exchangeRates),
      0
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
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bills
                .filter((b) => (showDone ? b.done : !b.done))
                .map((bill, i) => {
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
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 800,
                              fontFamily: "monospace",
                              color: bill.done ? "#6B7280" : "#F59E0B",
                            }}
                          >
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
                        <button
                          onClick={() => openEdit("bill", origIdx)}
                          style={{ background: "#1D4ED820", color: "#60A5FA", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteRow("bill", origIdx)}
                          style={{ background: "#7F1D1D20", color: "#FCA5A5", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              {bills.filter((b) => (showDone ? b.done : !b.done)).length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#6B7280", fontSize: 13 }}>
                  {showDone ? "No paid bills yet" : "All bills are paid! 🎉"}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
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
          {bills.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No Bills Tracked"
              description="Add recurring bills and subscriptions to never miss a payment"
              action="+ Add Bill"
              onAction={() => openAdd("bill")}
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
              {bills.map((bill, i) => (
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
                      onClick={() => toggleDone("bill", i)}
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
                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: THEME.text, marginBottom: 4 }}>
                      {fmt(bill.amount, (bill.currency || "INR") as Currency)}
                    </div>
                  ) : null}
                  {bill.nextAction && !bill.done ? (
                    <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 600, marginBottom: 4 }}>📌 {bill.nextAction}</div>
                  ) : null}
                  <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 6 }}>
                    {bill.freq} · Due: {bill.due || "—"}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => openEdit("bill", i)}
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
                      onClick={() => deleteRow("bill", i)}
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
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
