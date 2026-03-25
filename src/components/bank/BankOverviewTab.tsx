import React from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
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
import { convertCurrency, fmt, fmtDate } from "../../bank/bankDashboardFormat";
import { CURRENCY_SYMBOLS } from "../../bank/bankDashboardConstants";

export type MaturingSoonDepositOverview = {
  type: "maturity";
  title: string;
  bank: string;
  date: string;
  days: number;
  amount?: string;
  currency?: string;
  sourceField: string;
};

export type ActionDue30Overview = {
  type: "action";
  title: string;
  bank: string;
  date: string;
  days: number;
  sourceField: string;
};

/** Single timeline for Overview “Next 30 days”: maturities, manual actions, linked next-actions (sorted by days). */
export type Next30DayRow =
  | {
      kind: "maturity";
      title: string;
      bank: string;
      date: string;
      days: number;
      amount?: string;
      currency?: string;
      sourceField: string;
    }
  | {
      kind: "manual";
      title: string;
      bank: string;
      date: string;
      days: number;
      sourceField: string;
    }
  | {
      kind: "linked";
      title: string;
      bank: string;
      date: string;
      days: number;
      sourceField: string;
      linkedSource: "account" | "deposit" | "bill";
    };

export type DisplayCurrencyMode = "ORIGINAL" | "INR" | "USD" | "EUR" | "GBP";

export interface BankOverviewTabProps {
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
  /** Sum of Deposits tab principals (converted) — for Overview mobile tile */
  depositsPrincipalConverted: number;
  /** Maturities + manual due + linked next-actions (≤30d), sorted by days remaining */
  next30DaysUnified: Next30DayRow[];
  /** Pending manual actions + linked next-actions (matches Actions tab default) */
  overviewActionsCount: number;
  portfolioHistoryChartData: PortfolioHistoryChartPoint[];
  portfolioHistoryXDomain: [number, number] | undefined;
  portfolioHistoryYDomain: [number, number] | undefined;
  portfolioHistorySnapshotCount: number;
  showPortfolioHistory: boolean;
  setShowPortfolioHistory: React.Dispatch<React.SetStateAction<boolean>>;
  clearPortfolioHistory: () => void;
  deletePortfolioHistoryEntry: (fullDate: string) => void;
  setShowRatesModal: (v: boolean) => void;
  show30Days: boolean;
  setShow30Days: React.Dispatch<React.SetStateAction<boolean>>;
  expandedBanks: Set<string>;
  setExpandedBanks: React.Dispatch<React.SetStateAction<Set<string>>>;
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

export function BankOverviewTab({
  theme: THEME,
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
  overviewActionsCount,
  portfolioHistoryChartData,
  portfolioHistoryXDomain,
  portfolioHistoryYDomain,
  portfolioHistorySnapshotCount,
  showPortfolioHistory,
  setShowPortfolioHistory,
  clearPortfolioHistory,
  deletePortfolioHistoryEntry,
  setShowRatesModal,
  show30Days,
  setShow30Days,
  expandedBanks,
  setExpandedBanks,
  setTab,
  persist,
  totalValueHistory,
  toggleDone,
  getBankColor,
}: BankOverviewTabProps) {
  /** Chart snapshot list + clear-all — collapsed by default */
  const [portfolioHistoryToolsOpen, setPortfolioHistoryToolsOpen] = React.useState(false);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:isMobile?12:16}}>
      {/* ═══ MOBILE OVERVIEW ═══ */}
      {isMobile ? (
        <>
          {/* Mobile: Net Worth Hero Card */}
          <div style={{background:THEME.headerBg,borderRadius:16,padding:"20px 16px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.8)",fontWeight:500,letterSpacing:1,marginBottom:4}}>NET WORTH</div>
            <div style={{fontSize:32,fontWeight:800,color:"white",fontFamily:"monospace"}}>{fmt(netWorthConverted, targetCurrency)}</div>
            <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:12}}>
              {(['INR', 'USD'] as const).map(cur => (
                <button
                  key={cur}
                  onClick={() => { setDisplayCurrency(cur); persist(deposits, accounts, bills, actions, goals, exchangeRates, cur, totalValueHistory); }}
                  style={{
                    background: displayCurrency === cur ? 'white' : 'rgba(255,255,255,0.2)',
                    color: displayCurrency === cur ? THEME.accent : 'rgba(255,255,255,0.9)',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    minWidth: 60
                  }}
                >
                  {CURRENCY_SYMBOLS[cur]}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile: Quick Stats - 2x2 Grid with Large Touch Targets */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div onClick={() => setTab("deposits")} style={{background:THEME.cardBg,borderRadius:14,padding:"16px",border:`1px solid ${THEME.border}`,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,color:"#3B82F6"}}>{deposits.length}</div>
              <div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginTop:4}}>Deposits</div>
              <div style={{fontSize:12,color:"#3B82F6",fontFamily:"monospace",marginTop:6}}>{fmt(depositsPrincipalConverted, targetCurrency)}</div>
            </div>
            <div onClick={() => setTab("accounts")} style={{background:THEME.cardBg,borderRadius:14,padding:"16px",border:`1px solid ${THEME.border}`,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,color:"#10B981"}}>{accounts.length}</div>
              <div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginTop:4}}>Accounts</div>
              <div style={{fontSize:12,color:"#10B981",fontFamily:"monospace",marginTop:6}}>{fmt(sumConverted(accounts), targetCurrency)}</div>
            </div>
            <div onClick={() => setTab("bills")} style={{background:THEME.cardBg,borderRadius:14,padding:"16px",border:`1px solid ${bills.filter(b=>!b.done).length > 0 ? '#92400E' : THEME.border}`,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,color:bills.filter(b=>!b.done).length > 0 ? "#F59E0B" : "#6B7280"}}>{bills.filter(b=>!b.done).length}</div>
              <div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginTop:4}}>Bills</div>
              <div style={{fontSize:12,color:"#F59E0B",fontFamily:"monospace",marginTop:6}}>{fmt(bills.filter(b=>!b.done).reduce((s,b)=>s+convertCurrency(Number(b.amount)||0,(b.currency||'INR') as Currency,targetCurrency,exchangeRates),0), targetCurrency)}</div>
            </div>
            <div style={{background:THEME.cardBg,borderRadius:14,padding:"16px",border:`1px solid ${next30DaysUnified.length > 0 ? '#7F1D1D' : THEME.border}`,textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,color:next30DaysUnified.length > 0 ? "#EF4444" : "#6B7280"}}>{next30DaysUnified.length}</div>
              <div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginTop:4}}>Next 30 days</div>
              <div style={{fontSize:10,color:THEME.textLight,marginTop:6}}>Maturities &amp; due actions</div>
            </div>
          </div>

          {/* Mobile: Next 30 days — maturities + manual + linked next-actions (sorted by days) */}
          {next30DaysUnified.length > 0 && (
            <div style={{background:THEME.cardBg,borderRadius:14,padding:"14px",border:"1px solid #7F1D1D"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#F59E0B",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                <span>⚡</span> Next 30 days ({next30DaysUnified.length})
              </div>
              <div style={{fontSize:10,color:THEME.textLight,marginBottom:10}}>
                Sorted by days left — includes deposit maturities, Actions due dates, and linked <strong>Next action</strong> rows (accounts / deposits / bills).
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {next30DaysUnified.map((row, i) => {
                  const isMat = row.kind === "maturity";
                  const border = isMat ? (row.days <= 7 ? "#EF4444" : "#F59E0B") : row.days <= 0 ? "#EF4444" : "#F59E0B";
                  return (
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:THEME.cardBgAlt,borderRadius:10,borderLeft:`3px solid ${border}`}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:THEME.text}}>
                          {isMat ? `${row.bank} · ${row.title}` : row.title}
                        </div>
                        <div style={{fontSize:11,color:THEME.textLight}}>
                          {isMat && (
                            <>
                              {row.sourceField}: {fmtDate(row.date)}
                              {row.amount ? ` · ${fmt(Number(row.amount), (row.currency || "INR") as Currency)}` : ""}
                            </>
                          )}
                          {row.kind === "manual" && (
                            <>
                              {row.sourceField}: {fmtDate(row.date)}
                              {row.bank ? ` · ${row.bank}` : ""}
                            </>
                          )}
                          {row.kind === "linked" && (
                            <>
                              {row.sourceField}: {fmtDate(row.date)}
                              {row.bank ? ` · ${row.bank}` : ""}
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{textAlign:"right",marginLeft:8}}>
                        {isMat && (
                          <div style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:THEME.accent}}>
                            {row.amount ? fmt(row.amount, (row.currency || "INR") as Currency) : "—"}
                          </div>
                        )}
                        <div style={{fontSize:10,color:row.days <= 7 && isMat ? "#EF4444" : row.days <= 0 && !isMat ? "#EF4444" : "#F59E0B",fontWeight:600}}>
                          {row.days >= 0 ? `${row.days}d left` : `${-row.days}d overdue`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mobile: Pending Bills */}
          {bills.filter(b => !b.done).length > 0 && (
            <div style={{background:THEME.cardBg,borderRadius:14,padding:"14px",border:"1px solid #92400E"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#F59E0B",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                <span>📋</span> Pending Bills
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {bills.filter(b => !b.done).slice(0, 3).map((b, i) => (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:THEME.cardBgAlt,borderRadius:10}}>
                    <div style={{fontSize:13,fontWeight:600,color:THEME.text}}>{b.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:13,fontWeight:700,fontFamily:"monospace",color:"#F59E0B"}}>{fmt(b.amount, (b.currency || 'INR') as Currency)}</span>
                      <button 
                        onClick={() => toggleDone("bill", bills.indexOf(b))}
                        style={{background:THEME.accent,color:"#fff",border:"none",borderRadius:6,padding:"6px 10px",fontSize:11,fontWeight:600}}
                      >✓</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mobile: Portfolio Breakdown */}
          <div style={{background:THEME.cardBgAlt,borderRadius:14,padding:"14px"}}>
            <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:12}}>Portfolio by Type</div>
            {(() => {
              const types = ['FD', 'Saving', 'Credit Card', 'Loan', 'Other'];
              const typeColors: Record<string, string> = { FD: '#3B82F6', Saving: '#10B981', 'Credit Card': '#EF4444', Loan: '#F59E0B', Other: '#8B5CF6' };
              const typeAmounts = types.map(t => ({
                type: t,
                amount: accounts.filter(a => (t === 'Other' ? !types.slice(0, -1).includes(a.type || '') : a.type === t))
                  .reduce((s, a) => s + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates), 0)
              })).filter(t => t.amount !== 0);
              return (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {typeAmounts.map(t => (
                    <div key={t.type} style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:10,height:10,borderRadius:3,background:typeColors[t.type] || '#8B5CF6',flexShrink:0}} />
                      <div style={{flex:1,fontSize:12,color:THEME.text}}>{t.type}</div>
                      <div style={{fontSize:13,fontFamily:"monospace",fontWeight:600,color:t.amount < 0 ? "#EF4444" : THEME.text}}>{fmt(t.amount, targetCurrency)}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Mobile: Portfolio value over time */}
          <div style={{background:THEME.cardBg,borderRadius:14,padding:"14px",border:`1px solid ${THEME.border}`}}>
            <button
              onClick={() => setShowPortfolioHistory(!showPortfolioHistory)}
              style={{width:"100%",padding:0,background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showPortfolioHistory ? 12 : 0}}
            >
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:THEME.textMuted,transition:"transform 0.2s",transform:showPortfolioHistory?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                <span style={{fontSize:12,fontWeight:700,color:THEME.text}}>📈 Portfolio value over time</span>
              </div>
              {portfolioHistoryChartData.length > 0 && (
                <span style={{fontSize:10,color:THEME.textLight,background:THEME.cardBgAlt,padding:"2px 8px",borderRadius:8}}>{portfolioHistorySnapshotCount} snapshots</span>
              )}
            </button>
            {showPortfolioHistory && (
              portfolioHistoryChartData.length === 0 ? (
                <div style={{fontSize:11,color:THEME.textLight,padding:"12px 0",textAlign:"center"}}>Edit balances or add accounts to build history. Each save records a snapshot.</div>
              ) : (
                <>
                  <div style={{fontSize:10,color:THEME.textMuted,marginBottom:8,lineHeight:1.4}}>
                    Stacked areas: <strong style={{color:THEME.text}}>Accounts</strong> (bottom) + <strong style={{color:THEME.text}}>Deposits</strong> (top). Total height = combined value.
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={portfolioHistoryChartData} margin={{top:4,right:4,left:4,bottom:4}}>
                      <defs>
                        <linearGradient id="mobileStackAccounts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.85} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.35} />
                        </linearGradient>
                        <linearGradient id="mobileStackDeposits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.9} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
                      <XAxis dataKey="timestamp" type="number" domain={portfolioHistoryXDomain} tick={{fill:THEME.textLight,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={(ts) => new Date(ts).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })} />
                      <YAxis domain={portfolioHistoryYDomain} tick={{fill:THEME.textLight,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v => fmt(v, targetCurrency)} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0]?.payload as PortfolioHistoryChartPoint | undefined;
                          const acc = Number(p?.totalAccountValue) || 0;
                          const dep = Number(p?.totalDepositValue) || 0;
                          return (
                            <div style={{background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"8px 12px",fontSize:11,minWidth:160}}>
                              <div style={{color:THEME.textMuted,marginBottom:4}}>{p?.fullDate ? fmtDate(p.fullDate) : ''}</div>
                              <div style={{fontWeight:600,color:"#10B981"}}>Accounts: {fmt(acc, targetCurrency)}</div>
                              <div style={{fontWeight:600,color:"#3B82F6"}}>Deposits: {fmt(dep, targetCurrency)}</div>
                              <div style={{fontWeight:700,color:THEME.text,marginTop:6,paddingTop:6,borderTop:`1px solid ${THEME.border}`}}>Total: {fmt(acc + dep, targetCurrency)}</div>
                              {p?.source && <div style={{color:THEME.textLight,fontSize:10,marginTop:4}}>{p.source}</div>}
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{fontSize:10,color:THEME.textLight}} iconType="square" />
                      <Area type="monotone" dataKey="totalAccountValue" name="Accounts" stackId="portfolio" stroke="#059669" strokeWidth={1.5} fill="url(#mobileStackAccounts)" />
                      <Area type="monotone" dataKey="totalDepositValue" name="Deposits" stackId="portfolio" stroke="#2563EB" strokeWidth={1.5} fill="url(#mobileStackDeposits)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )
            )}
            {showPortfolioHistory && portfolioHistoryChartData.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setPortfolioHistoryToolsOpen((o) => !o)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: THEME.cardBgAlt,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 8,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    color: THEME.textLight,
                  }}
                >
                  <span>🗂 History & cleanup</span>
                  <span style={{ transform: portfolioHistoryToolsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                </button>
                {portfolioHistoryToolsOpen && (
                  <div style={{ marginTop: 8 }}>
                    <button type="button" onClick={clearPortfolioHistory} style={{background:"transparent",border:"none",color:THEME.textLight,fontSize:11,cursor:"pointer",textDecoration:"underline"}}>Clear all chart history</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
      /* ═══ DESKTOP OVERVIEW ═══ */
      <>
      {/* Currency Toggle Bar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:THEME.cardBg,borderRadius:10,padding:"8px 14px",border:`1px solid ${THEME.border}`,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:"#6B7280",fontWeight:600}}>VIEW:</span>
          <div style={{display:"flex",gap:4}}>
            <button
              onClick={() => { setDisplayCurrency('ORIGINAL'); persist(deposits, accounts, bills, actions, goals, exchangeRates, 'ORIGINAL', totalValueHistory); }}
              style={{
                background: displayCurrency === 'ORIGINAL' ? THEME.accent : THEME.cardBgAlt,
                color: displayCurrency === 'ORIGINAL' ? '#FFFFFF' : THEME.textMuted,
                border: 'none',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🌐 Mixed
            </button>
            {(['INR', 'USD', 'EUR', 'GBP'] as const).map(cur => (
              <button
                key={cur}
                onClick={() => { setDisplayCurrency(cur); persist(deposits, accounts, bills, actions, goals, exchangeRates, cur, totalValueHistory); }}
                style={{
                  background: displayCurrency === cur ? THEME.accent : THEME.cardBgAlt,
                  color: displayCurrency === cur ? '#FFFFFF' : THEME.textMuted,
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {CURRENCY_SYMBOLS[cur]} {cur}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowRatesModal(true)}
          style={{background:THEME.cardBgAlt,color:THEME.textMuted,border:"none",padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}
        >
          ⚙️ Rates
        </button>
      </div>
      
      {/* Quick Stats Row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:8}}>
        <div style={{background:THEME.cardBg,borderRadius:10,padding:"10px 8px",textAlign:"center",border:`1px solid ${THEME.border}`}}>
          <div style={{fontSize:20,fontWeight:800,color:"#3B82F6"}}>{deposits.length}</div>
          <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",fontWeight:600}}>Deposits</div>
        </div>
        <div style={{background:THEME.cardBg,borderRadius:10,padding:"10px 8px",textAlign:"center",border:`1px solid ${THEME.border}`}}>
          <div style={{fontSize:20,fontWeight:800,color:"#10B981"}}>{accounts.length}</div>
          <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",fontWeight:600}}>Accounts</div>
        </div>
        <div style={{background:THEME.cardBg,borderRadius:10,padding:"10px 8px",textAlign:"center",border:`1px solid ${THEME.border}`}}>
          <div style={{fontSize:20,fontWeight:800,color:"#F59E0B"}}>{bills.filter(b=>!b.done).length}</div>
          <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",fontWeight:600}}>Bills</div>
        </div>
        <div style={{background:THEME.cardBg,borderRadius:10,padding:"10px 8px",textAlign:"center",border:`1px solid ${THEME.border}`}}>
          <div style={{fontSize:20,fontWeight:800,color:overviewActionsCount>0?"#F59E0B":THEME.textMuted}}>{overviewActionsCount}</div>
          <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",fontWeight:600}}>Actions</div>
        </div>
      </div>

      {/* Portfolio Summary - Professional Card Layout with Currency Conversion */}
      {(() => {
        const accountTotal = sumConverted(accounts);
        const fdTotal = accounts.filter(a => a.type === "FD").reduce((s, a) => 
          s + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates), 0);
        const savingsTotal = accounts.filter(a => a.type === "Saving").reduce((s, a) => 
          s + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates), 0);
        const otherTotal = accountTotal - fdTotal - savingsTotal;
        /** Deposits tab principal + FD rows on Accounts (same basis as mobile Deposits tile) */
        const depositsCombined = depositsPrincipalConverted + fdTotal;
        const grandTotal = accountTotal + depositsPrincipalConverted;
        
        const segments = [
          { label: "Deposits", amount: depositsCombined, color: "#3B82F6", pct: grandTotal > 0 ? (depositsCombined / grandTotal) * 100 : 0 },
          { label: "Savings", amount: savingsTotal, color: "#10B981", pct: grandTotal > 0 ? (savingsTotal / grandTotal) * 100 : 0 },
          ...(otherTotal > 0 ? [{ label: "Other", amount: otherTotal, color: "#8B5CF6", pct: grandTotal > 0 ? (otherTotal / grandTotal) * 100 : 0 }] : [])
        ];
        
        return (
          <div style={{background:THEME.cardBg,borderRadius:16,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
            {/* Header with Total */}
            <div style={{padding:"16px 18px",borderBottom:`1px solid ${THEME.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:11,color:THEME.textMuted,fontWeight:500,letterSpacing:"0.5px"}}>TOTAL PORTFOLIO ({displayCurrency === 'ORIGINAL' ? 'Mixed → INR' : targetCurrency})</div>
                <div style={{fontSize:26,fontWeight:800,color:THEME.text,fontFamily:"monospace",marginTop:4}}>{fmt(grandTotal, targetCurrency)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:THEME.textMuted}}>
                  {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                  {deposits.length > 0
                    ? ` · ${deposits.length} deposit${deposits.length !== 1 ? 's' : ''}`
                    : ''}
                </div>
              </div>
            </div>
            
            {/* Allocation Bar */}
            {grandTotal > 0 && (
              <div style={{padding:"0 18px"}}>
                <div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",background:THEME.cardBgAlt}}>
                  {segments.map((seg, i) => (
                    <div 
                      key={seg.label} 
                      style={{
                        width:`${seg.pct}%`,
                        background:seg.color,
                        transition:"width 0.3s ease"
                      }} 
                      title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Breakdown Cards */}
            <div style={{display:"grid",gridTemplateColumns:`repeat(${segments.length}, 1fr)`,gap:1,background:THEME.border,marginTop:12}}>
              {segments.map((seg, i) => (
                <div key={seg.label} style={{background:THEME.cardBg,padding:"12px 14px",textAlign:"center"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}>
                    <div style={{width:8,height:8,borderRadius:2,background:seg.color}}/>
                    <span style={{fontSize:10,color:THEME.textMuted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.3px"}}>{seg.label}</span>
                  </div>
                  <div style={{fontSize:16,fontWeight:700,color:THEME.text,fontFamily:"monospace"}}>{fmt(seg.amount, targetCurrency)}</div>
                  <div style={{fontSize:10,color:seg.color,fontWeight:600,marginTop:2}}>{seg.pct.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Portfolio value over time - Desktop */}
      <div style={{background:THEME.cardBg,borderRadius:12,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
        <button
          onClick={() => setShowPortfolioHistory(!showPortfolioHistory)}
          style={{width:"100%",padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
        >
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:showPortfolioHistory?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
            <span style={{fontSize:11,fontWeight:700,color:"#E5E7EB",textTransform:"uppercase"}}>📈 Portfolio value over time</span>
          </div>
          {portfolioHistoryChartData.length > 0 && (
            <span style={{fontSize:10,color:"#6B7280",background:THEME.cardBgAlt,padding:"2px 8px",borderRadius:10}}>{portfolioHistorySnapshotCount} snapshots</span>
          )}
        </button>
        {showPortfolioHistory && (
          <div style={{padding:"0 14px 14px",borderTop:`1px solid ${THEME.border}`}}>
            {portfolioHistoryChartData.length === 0 ? (
              <div style={{color:THEME.textMuted,padding:20,textAlign:"center",fontSize:12}}>Edit balances or add accounts to build history. Each save records a snapshot.</div>
            ) : (
              <>
                <div style={{fontSize:10,color:THEME.textMuted,marginBottom:10,lineHeight:1.4}}>
                  Stacked areas: <strong style={{color:THEME.text}}>Accounts</strong> (bottom) + <strong style={{color:THEME.text}}>Deposits</strong> (top). Total height = combined value.
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={portfolioHistoryChartData} margin={{top:8,right:8,left:8,bottom:8}}>
                    <defs>
                      <linearGradient id="desktopStackAccounts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.35} />
                      </linearGradient>
                      <linearGradient id="desktopStackDeposits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.9} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="timestamp" type="number" domain={portfolioHistoryXDomain} tick={{fill:THEME.textLight,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={(ts) => new Date(ts).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })} />
                    <YAxis domain={portfolioHistoryYDomain} tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v => fmt(v, targetCurrency)} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0]?.payload as PortfolioHistoryChartPoint | undefined;
                        const acc = Number(p?.totalAccountValue) || 0;
                        const dep = Number(p?.totalDepositValue) || 0;
                        return (
                          <div style={{background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"10px 14px",fontSize:12,minWidth:180}}>
                            <div style={{color:THEME.textMuted,marginBottom:6}}>{p?.fullDate ? fmtDate(p.fullDate) : ''}</div>
                            <div style={{fontWeight:600,color:"#10B981"}}>Accounts: {fmt(acc, targetCurrency)}</div>
                            <div style={{fontWeight:600,color:"#3B82F6"}}>Deposits: {fmt(dep, targetCurrency)}</div>
                            <div style={{fontWeight:700,color:THEME.text,marginTop:8,paddingTop:8,borderTop:`1px solid ${THEME.border}`}}>Total: {fmt(acc + dep, targetCurrency)}</div>
                            {p?.source && <div style={{color:THEME.textLight,fontSize:11,marginTop:6}}>Source: {p.source}</div>}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{fontSize:11,color:THEME.textLight}} iconType="square" />
                    <Area type="monotone" dataKey="totalAccountValue" name="Accounts" stackId="portfolio" stroke="#059669" strokeWidth={1.5} fill="url(#desktopStackAccounts)" />
                    <Area type="monotone" dataKey="totalDepositValue" name="Deposits" stackId="portfolio" stroke="#2563EB" strokeWidth={1.5} fill="url(#desktopStackDeposits)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{marginTop:12}}>
                  <button
                    type="button"
                    onClick={() => setPortfolioHistoryToolsOpen((o) => !o)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: THEME.cardBgAlt,
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 8,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      color: THEME.textMuted,
                    }}
                  >
                    <span>🗂 History & cleanup</span>
                    <span style={{ transform: portfolioHistoryToolsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', fontSize: 10 }}>▶</span>
                  </button>
                  {portfolioHistoryToolsOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      <button type="button" onClick={clearPortfolioHistory} style={{alignSelf:"flex-start",background:"transparent",border:"none",color:THEME.textLight,fontSize:11,cursor:"pointer",textDecoration:"underline"}}>Clear all chart history</button>
                      <div style={{fontSize:10,color:THEME.textMuted,marginBottom:4}}>Remove a snapshot:</div>
                      <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:120,overflowY:"auto"}}>
                        {[...portfolioHistoryChartData].filter(p => !p.isProjected).reverse().slice(0, 10).map((p) => (
                          <div key={p.fullDate} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 8px",background:THEME.cardBgAlt,borderRadius:6,fontSize:11}}>
                            <span style={{color:THEME.text}}>{fmtDate(p.fullDate)} · {fmt(p.totalAccountValue, targetCurrency)}{p.source ? ` (${p.source})` : ''}</span>
                            <button type="button" onClick={() => deletePortfolioHistoryEntry(p.fullDate)} title="Remove this snapshot" style={{background:"none",border:"none",cursor:"pointer",padding:2,color:THEME.textLight,fontSize:12}}>🗑</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Next 30 Days - Collapsible (single list: maturities + manual + linked next-actions, by days left) */}
      {next30DaysUnified.length > 0 && (
        <div style={{background:THEME.cardBg,borderRadius:12,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
          <button 
            onClick={()=>setShow30Days(!show30Days)} 
            style={{width:"100%",padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
          >
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:show30Days?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
              <span style={{fontSize:11,fontWeight:700,color:"#F59E0B",textTransform:"uppercase"}}>⚡ Next 30 Days</span>
            </div>
            <div style={{fontSize:10,color:"#6B7280",background:THEME.cardBgAlt,padding:"2px 8px",borderRadius:10}}>
              {next30DaysUnified.filter((r) => r.kind === "maturity").length} deposits ·{" "}
              {next30DaysUnified.filter((r) => r.kind === "manual" || r.kind === "linked").length} actions
            </div>
          </button>
          {show30Days && (
            <div style={{maxHeight:320,overflowY:"auto",borderTop:"1px solid #1F2937"}}>
              <div style={{padding:"8px 14px",fontSize:10,color:"#6B7280",background:"#1F2937",fontWeight:600}}>
                Sorted by days left — maturities, manual due dates, linked Next action
              </div>
              {next30DaysUnified.map((item, i) => {
                const isMat = item.kind === "maturity";
                const isLinked = item.kind === "linked";
                const icon = isMat ? "💰" : isLinked ? "⚡" : "📋";
                const iconBg = isMat ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)";
                const iconColor = isMat ? "#EF4444" : "#F59E0B";
                const titleLine = isMat ? `${item.title} · ${item.bank}` : item.title;
                const subLine = isMat
                  ? `Maturity date: ${fmtDate(item.date)}${item.amount ? ` · ${fmt(Number(item.amount), (item.currency || "INR") as Currency)}` : ""}`
                  : item.kind === "manual"
                    ? `Due date: ${fmtDate(item.date)}${item.bank ? ` · ${item.bank}` : ""}`
                    : `${item.sourceField}: ${fmtDate(item.date)}${item.bank ? ` · ${item.bank}` : ""}`;
                const urgency = isMat ? item.days <= 7 : item.days <= 0;
                return (
                  <div key={`n30-${i}`} style={{padding:"10px 14px",borderBottom:"1px solid #1F2937",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,background:iconBg,color:iconColor}}>{icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:THEME.text}}>{titleLine}</div>
                      <div style={{fontSize:10,color:"#6B7280"}}>{subLine}</div>
                    </div>
                    <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:urgency ? "#EF4444" : "#F59E0B"}}>
                      {item.days >= 0 ? `${item.days}d left` : `${-item.days}d overdue`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {next30DaysUnified.length === 0 && (
        <div style={{background:THEME.cardBg,borderRadius:12,padding:"16px",textAlign:"center",border:`1px solid ${THEME.border}`}}>
          <div style={{fontSize:24,marginBottom:6}}>✅</div>
          <div style={{fontSize:12,color:"#10B981",fontWeight:600}}>All Clear!</div>
          <div style={{fontSize:11,color:"#6B7280"}}>No deposits maturing and no actions due in the next 30 days</div>
        </div>
      )}

      {/* FD Projections - Theme Aligned */}
      <div style={{background:THEME.cardBg,borderRadius:16,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",borderBottom:`1px solid ${THEME.border}`}}>
          <div style={{fontSize:11,color:THEME.textMuted,fontWeight:500,letterSpacing:"0.5px"}}>DEPOSIT PROJECTIONS (1 YEAR) - {displayCurrency === 'ORIGINAL' ? 'Mixed → INR' : targetCurrency}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:1,background:THEME.border}}>
          <div style={{background:THEME.cardBg,padding:"14px 16px",textAlign:"center"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}>
              <div style={{width:8,height:8,borderRadius:2,background:"#3B82F6"}}/>
              <span style={{fontSize:10,color:THEME.textMuted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.3px"}}>Invested</span>
            </div>
            <div style={{fontSize:18,fontWeight:700,color:THEME.text,fontFamily:"monospace"}}>{fmt(totalInvested, targetCurrency)}</div>
            <div style={{fontSize:10,color:THEME.textMuted,marginTop:4}}>{deposits.length + accounts.filter(a=>a.type==="FD").length} deposits</div>
          </div>
          <div style={{background:THEME.cardBg,padding:"14px 16px",textAlign:"center"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}>
              <div style={{width:8,height:8,borderRadius:2,background:"#10B981"}}/>
              <span style={{fontSize:10,color:THEME.textMuted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.3px"}}>Maturity</span>
            </div>
            <div style={{fontSize:18,fontWeight:700,color:THEME.text,fontFamily:"monospace"}}>{fmt(totalMaturity, targetCurrency)}</div>
            <div style={{fontSize:10,color:THEME.textMuted,marginTop:4}}>projected value</div>
          </div>
          <div style={{background:THEME.cardBg,padding:"14px 16px",textAlign:"center"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}>
              <div style={{width:8,height:8,borderRadius:2,background:"#F59E0B"}}/>
              <span style={{fontSize:10,color:THEME.textMuted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.3px"}}>Est. Gain</span>
            </div>
            <div style={{fontSize:18,fontWeight:700,color:THEME.success,fontFamily:"monospace"}}>{fmt(totalMaturity-totalInvested, targetCurrency)}</div>
            <div style={{fontSize:10,color:THEME.success,fontWeight:600,marginTop:4}}>{totalInvested?`+${(((totalMaturity-totalInvested)/totalInvested)*100).toFixed(1)}%`:""}</div>
          </div>
        </div>
      </div>
      
      {/* Net Worth Breakdown - Collapsible with Currency Conversion */}
      {(() => {
        const netWorth = netWorthConverted;
        const byType: Record<string, number> = {};
        accounts.forEach(a => {
          const t = a.type || 'Other';
          byType[t] = (byType[t] || 0) + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates);
        });
        const byBank: Record<string, number> = {};
        accounts.forEach(a => {
          byBank[a.bank] = (byBank[a.bank] || 0) + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates);
        });
        
        return (
          <div style={{background:THEME.cardBg,borderRadius:12,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
            <button 
              onClick={() => setExpandedBanks(prev => prev.has('_networth') ? new Set([...prev].filter(k => k !== '_networth')) : new Set([...prev, '_networth']))}
              style={{width:"100%",padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
            >
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:expandedBanks.has('_networth')?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                <span style={{fontSize:11,fontWeight:700,color:THEME.textLight,textTransform:"uppercase"}}>💎 Net Worth ({displayCurrency === 'ORIGINAL' ? 'Mixed → INR' : targetCurrency})</span>
              </div>
              <span style={{fontSize:12,color:THEME.text,fontFamily:"monospace",fontWeight:700}}>{fmt(netWorth, targetCurrency)}</span>
            </button>
            {expandedBanks.has('_networth') && (
              <div style={{borderTop:"1px solid #1F2937",padding:14,display:"flex",flexDirection:"column",gap:12}}>
                {/* Assets vs Liabilities Summary */}
                {(() => {
                  const totalAssets = Object.values(byType).filter(v => v > 0).reduce((s, v) => s + v, 0);
                  const totalLiabilities = Math.abs(Object.values(byType).filter(v => v < 0).reduce((s, v) => s + v, 0));
                  return (
                    <div style={{display:"flex",gap:12,marginBottom:4}}>
                      <div style={{flex:1,background:"#064E3B30",borderRadius:6,padding:8,borderLeft:"3px solid #10B981"}}>
                        <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Assets</div>
                        <div style={{fontSize:14,fontWeight:700,color:"#10B981",fontFamily:"monospace"}}>{fmt(totalAssets, targetCurrency)}</div>
                      </div>
                      <div style={{flex:1,background:"#7F1D1D30",borderRadius:6,padding:8,borderLeft:"3px solid #EF4444"}}>
                        <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Liabilities</div>
                        <div style={{fontSize:14,fontWeight:700,color:"#EF4444",fontFamily:"monospace"}}>{fmt(totalLiabilities, targetCurrency)}</div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* By Account Type */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:THEME.textMuted,marginBottom:8}}>📊 By Account Type</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {Object.entries(byType).sort((a,b) => b[1] - a[1]).map(([type, amt]) => {
                      const isNegative = amt < 0;
                      const typeColor = isNegative ? "#EF4444" : 
                        type === "FD" ? "#3B82F6" : type === "Saving" ? "#10B981" : type === "Credit Card" ? "#EF4444" : 
                        type === "401K" ? "#F59E0B" : type === "Stock" ? "#8B5CF6" : "#6366F1";
                      // For bar width: use absolute value relative to total assets (for positive) or total liabilities (for negative)
                      const totalAssets = Object.values(byType).filter(v => v > 0).reduce((s, v) => s + v, 0);
                      const totalLiabilities = Math.abs(Object.values(byType).filter(v => v < 0).reduce((s, v) => s + v, 0));
                      const barBase = isNegative ? totalLiabilities : totalAssets;
                      const barPct = barBase > 0 ? (Math.abs(amt) / barBase) * 100 : 0;
                      // For percentage display: show as % of net worth
                      const pctOfNetWorth = netWorth !== 0 ? ((amt / netWorth) * 100) : 0;
                      
                      return (
                        <div key={type} style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                              <span style={{fontSize:11,color:THEME.text}}>{type} {isNegative && <span style={{fontSize:9,color:"#EF4444"}}>(Liability)</span>}</span>
                              <span style={{fontSize:11,color:isNegative ? "#EF4444" : THEME.text,fontWeight:600,fontFamily:"monospace"}}>{fmt(amt, targetCurrency)}</span>
                            </div>
                            <div style={{background:THEME.cardBgAlt,borderRadius:3,height:5,overflow:"hidden"}}>
                              <div style={{width:`${Math.min(barPct, 100)}%`,height:"100%",background:typeColor,borderRadius:3}}/>
                            </div>
                          </div>
                          <span style={{fontSize:10,color:isNegative ? "#EF4444" : "#6B7280",minWidth:35,textAlign:"right"}}>{pctOfNetWorth.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Bank Concentration */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:THEME.textMuted,marginBottom:8}}>🏦 Bank Concentration</div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4, 1fr)",gap:6}}>
                    {Object.entries(byBank).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([bank, amt]) => {
                      const isNegative = amt < 0;
                      const pctOfNetWorth = netWorth !== 0 ? ((amt / netWorth) * 100) : 0;
                      return (
                        <div key={bank} style={{background:THEME.cardBgAlt,borderRadius:6,padding:8,borderLeft:`2px solid ${isNegative ? "#EF4444" : getBankColor(bank)}`}}>
                          <div style={{fontSize:10,color:THEME.textMuted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{bank}</div>
                          <div style={{fontSize:12,fontWeight:700,color:isNegative ? "#EF4444" : THEME.text,fontFamily:"monospace"}}>{fmt(amt, targetCurrency)}</div>
                          <div style={{fontSize:9,color:isNegative ? "#EF4444" : getBankColor(bank)}}>{pctOfNetWorth.toFixed(0)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      </>
      )}
    </div>
  );
}
