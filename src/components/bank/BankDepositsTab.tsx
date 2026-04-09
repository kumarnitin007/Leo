import React from "react";
import type { Deposit, Currency } from "../../types/bankRecords";
import type { BankDashboardTheme } from "../../bank/bankDashboardTheme";
import { daysUntil, fmt, fmtDate, getBankColor } from "../../bank/bankDashboardFormat";
import { UrgencyBadge, inputSt } from "./BankDashboardPrimitives";
import { BankDonutBarChart, type ChartSlice } from "./BankChartWidgets";

export type DepositsPieSlice = { name: string; value: number; color: string };

export interface BankDepositsTabProps {
  theme: BankDashboardTheme;
  deposits: Deposit[];
  filtered: Deposit[];
  banks: string[];
  isMobile: boolean;
  search: string;
  setSearch: (v: string) => void;
  filterBank: string;
  setFilterBank: (v: string) => void;
  depositsViewMode: "cards" | "grouped" | "flat";
  setDepositsViewMode: (m: "cards" | "grouped" | "flat") => void;
  expandedBanks: Set<string>;
  setExpandedBanks: React.Dispatch<React.SetStateAction<Set<string>>>;
  showLegend: Set<string>;
  setShowLegend: React.Dispatch<React.SetStateAction<Set<string>>>;
  typePieData: DepositsPieSlice[];
  depositsBankViz: 'donut' | 'bars';
  setDepositsBankViz: (m: 'donut' | 'bars') => void;
  openAdd: (t: string) => void;
  openEdit: (t: string, i: number) => void;
  deleteRow: (t: string, i: number) => void;
  toggleDone: (t: string, i: number) => void;
}

export function BankDepositsTab({
  theme: THEME,
  deposits,
  filtered,
  banks,
  isMobile,
  search,
  setSearch,
  filterBank,
  setFilterBank,
  depositsViewMode,
  setDepositsViewMode,
  expandedBanks,
  setExpandedBanks,
  showLegend,
  setShowLegend,
  typePieData,
  depositsBankViz,
  setDepositsBankViz,
  openAdd,
  openEdit,
  deleteRow,
  toggleDone,
}: BankDepositsTabProps) {
  // Group deposits by bank for collapsible headers
  const groupedDeps: Record<string, { deps: typeof filtered; indices: number[]; total: number }> = {};
  filtered.forEach((d) => {
    const origIdx = deposits.indexOf(d);
    const bankKey = (d.bank || '').trim() || (d.depositId || '').trim() || (d.type || '').trim() || 'Unnamed';
    if (!groupedDeps[bankKey]) groupedDeps[bankKey] = { deps: [], indices: [], total: 0 };
    groupedDeps[bankKey].deps.push(d);
    groupedDeps[bankKey].indices.push(origIdx);
    groupedDeps[bankKey].total += Number(d.deposit) || 0;
  });
  // Sort by total deposited amount (highest first)
  const depBankNames = Object.keys(groupedDeps).sort((a, b) => groupedDeps[b].total - groupedDeps[a].total);
  
  const toggleDepBank = (bankName: string) => {
    setExpandedBanks(prev => {
      const next = new Set(prev);
      const key = `dep_${bankName}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  
  const allExpanded = depBankNames.every(b => expandedBanks.has(`dep_${b}`));
  
  return (
    <div>
      {/* ═══ MOBILE DEPOSITS VIEW ═══ */}
      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Mobile: Summary Header */}
          <div style={{background:THEME.headerBg,borderRadius:14,padding:"16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:500}}>TOTAL INVESTED</div>
              <div style={{fontSize:22,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{fmt(filtered.reduce((s, d) => s + (Number(d.deposit) || 0), 0))}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:THEME.textMuted,fontWeight:500}}>MATURITY</div>
              <div style={{fontSize:22,fontWeight:800,color:THEME.accent,fontFamily:"monospace"}}>{fmt(filtered.reduce((s, d) => s + (Number(d.maturityAmt) || Number(d.deposit) || 0), 0))}</div>
            </div>
          </div>
          
          {/* Mobile: Search */}
          <input placeholder="🔍 Search deposits..." value={search} onChange={e => setSearch(e.target.value)} style={{...inputSt,padding:"12px 14px",borderRadius:10,fontSize:14}} />
          
          {/* Mobile: Bank Filter Pills */}
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
            <button onClick={() => setFilterBank("All")} style={{background:filterBank === "All" ? "#3B82F6" : THEME.cardBgAlt,color:filterBank === "All" ? "#FFF" : THEME.textMuted,border:"none",borderRadius:20,padding:"8px 14px",fontSize:12,fontWeight:600,flexShrink:0}}>All ({deposits.length})</button>
            {depBankNames.map(b => (
              <button key={b} onClick={() => setFilterBank(b)} style={{background:filterBank === b ? getBankColor(b) : THEME.cardBgAlt,color:filterBank === b ? "#FFF" : THEME.textMuted,border:"none",borderRadius:20,padding:"8px 14px",fontSize:12,fontWeight:600,flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:getBankColor(b)}} />
                {b} ({groupedDeps[b]?.deps.length || 0})
              </button>
            ))}
          </div>
          
          {/* Mobile: Deposit Cards */}
          {filtered.length === 0 ? (
            <div style={{padding:40,textAlign:"center",color:"#6B7280"}}>No deposits found</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filtered.map((d, idx) => {
                const origIdx = deposits.indexOf(d);
                const days = daysUntil(d.maturityDate);
                const bankLabel = (d.bank || '').trim() || d.depositId || d.type || 'Unnamed';
                const color = getBankColor(bankLabel);
                const urgency = days === null ? "none" : days < 0 ? "expired" : days <= 7 ? "urgent" : days <= 30 ? "soon" : "none";
                return (
                  <div 
                    key={idx} 
                    style={{
                      background:THEME.cardBgAlt,
                      borderRadius:14,
                      borderLeft:`4px solid ${color}`,
                      padding:"14px",
                      opacity: d.done ? 0.6 : 1
                    }}
                  >
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:THEME.text}}>{(d.bank || '').trim() || d.depositId || d.type || 'Unnamed'}</div>
                        <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>{d.type || "FD"} {d.depositId && `• ${d.depositId}`}</div>
                      </div>
                      {days !== null && !d.done && (
                        <div style={{
                          background: urgency === "urgent" ? "#fef2f2" : urgency === "soon" ? "#fef9c3" : urgency === "expired" ? "#f3f4f6" : THEME.cardBgAlt,
                          color: urgency === "urgent" ? "#dc2626" : urgency === "soon" ? "#ca8a04" : urgency === "expired" ? THEME.textLight : THEME.textMuted,
                          padding:"4px 10px",
                          borderRadius:20,
                          fontSize:11,
                          fontWeight:600
                        }}>
                          {days < 0 ? "Matured" : `${days}d`}
                        </div>
                      )}
                      {d.done && <span style={{fontSize:11,color:"#34D399",fontWeight:600}}>✓ Done</span>}
                    </div>
                    
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                      <div>
                        <div style={{fontSize:11,color:"#6B7280"}}>Invested</div>
                        <div style={{fontSize:18,fontWeight:700,fontFamily:"monospace",color:THEME.text}}>{fmt(d.deposit)}</div>
                        {d.roi && <div style={{fontSize:11,color:THEME.accent,marginTop:2}}>{(Number(d.roi) * 100).toFixed(2)}% pa</div>}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:11,color:"#6B7280"}}>Maturity</div>
                        <div style={{fontSize:18,fontWeight:700,fontFamily:"monospace",color:THEME.accent}}>{fmt(d.maturityAmt || d.deposit)}</div>
                        <div style={{fontSize:10,color:THEME.textLight,marginTop:2}}>{fmtDate(d.maturityDate)}</div>
                      </div>
                    </div>
                    {d.nextAction && !d.done && (
                      <div style={{fontSize:11,color:"#2563EB",marginTop:10,fontWeight:600}}>📌 Next: {d.nextAction}</div>
                    )}
                    
                    {/* Mobile: Action Buttons */}
                    <div style={{display:"flex",gap:8,marginTop:12,paddingTop:12,borderTop:`1px solid ${THEME.border}`}}>
                      <button 
                        onClick={() => toggleDone("deposit", origIdx)} 
                        style={{flex:1,background:d.done ? "#dcfce7" : THEME.cardBgAlt,color:d.done ? "#34D399" : THEME.textLight,border:"none",borderRadius:8,padding:"10px",fontSize:12,fontWeight:600}}
                      >
                        {d.done ? "↩ Undo" : "✓ Mark Done"}
                      </button>
                      <button 
                        onClick={() => openEdit("deposit", origIdx)} 
                        style={{background:"#1D4ED820",color:"#60A5FA",border:"none",borderRadius:8,padding:"10px 14px",fontSize:12}}
                      >✏️</button>
                      <button 
                        onClick={() => deleteRow("deposit", origIdx)} 
                        style={{background:"#7F1D1D20",color:"#FCA5A5",border:"none",borderRadius:8,padding:"10px 14px",fontSize:12}}
                      >🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      /* ═══ DESKTOP DEPOSITS VIEW ═══ */
      <>
      {/* Search & Filter - Sticky on scroll */}
      <div style={{position:"sticky",top:0,zIndex:10,background:THEME.cardBg,padding:"12px 0",marginBottom:8}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {/* View Mode Toggle */}
          <div style={{display:"flex",gap:1,background:THEME.cardBg,borderRadius:6,padding:2,border:`1px solid ${THEME.border}`}}>
            <button
              onClick={() => setDepositsViewMode('cards')}
              style={{background:depositsViewMode === 'cards' ? '#238636' : 'transparent',color:depositsViewMode === 'cards' ? '#FFF' : '#6B7280',border:'none',padding:'4px 10px',borderRadius:4,fontSize:10,fontWeight:600,cursor:'pointer'}}
              title="Card view grouped by bank"
            >
              ▦ Cards
            </button>
            <button
              onClick={() => setDepositsViewMode('grouped')}
              style={{background:depositsViewMode === 'grouped' ? '#238636' : 'transparent',color:depositsViewMode === 'grouped' ? '#FFF' : '#6B7280',border:'none',padding:'4px 10px',borderRadius:4,fontSize:10,fontWeight:600,cursor:'pointer'}}
              title="Grid view grouped by bank"
            >
              ▤ By Bank
            </button>
            <button
              onClick={() => setDepositsViewMode('flat')}
              style={{background:depositsViewMode === 'flat' ? '#238636' : 'transparent',color:depositsViewMode === 'flat' ? '#FFF' : '#6B7280',border:'none',padding:'4px 10px',borderRadius:4,fontSize:10,fontWeight:600,cursor:'pointer'}}
              title="Flat grid view - all rows"
            >
              ≡ All
            </button>
          </div>
          <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{...inputSt,flex:isMobile?1:"none",width:isMobile?"auto":180,minWidth:120}} />
          <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:isMobile?undefined:1}}>
            <button onClick={() => setFilterBank("All")} style={{background:filterBank === "All" ? "#3B82F6" : THEME.cardBgAlt,color:filterBank === "All" ? "#FFF" : THEME.textMuted,border:"none",borderRadius:16,padding:"5px 10px",fontSize:10,fontWeight:600,cursor:"pointer"}}>All</button>
            {banks.map(b => (
              <button key={b} onClick={() => setFilterBank(b)} style={{background:filterBank === b ? getBankColor(b) : THEME.cardBgAlt,color:filterBank === b ? "#FFF" : THEME.textMuted,border:"none",borderRadius:16,padding:"5px 10px",fontSize:10,fontWeight:600,cursor:"pointer"}}>{b}</button>
            ))}
          </div>
          <button 
            onClick={() => {
              const allKeys = depBankNames.map(b => `dep_${b}`);
              setExpandedBanks(prev => allExpanded ? new Set([...prev].filter(k => !k.startsWith('dep_'))) : new Set([...prev, ...allKeys]));
            }}
            style={{background:THEME.cardBgAlt,color:THEME.textMuted,border:`1px solid ${THEME.border}`,borderRadius:6,padding:"5px 10px",fontSize:10,fontWeight:600,cursor:"pointer"}}
          >
            {allExpanded ? "Collapse" : "Expand"}
          </button>
          {!isMobile && <button onClick={() => openAdd("deposit")} style={{marginLeft:"auto",background:THEME.accent,color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer"}}>+ Add</button>}
        </div>
      </div>

      {/* ═══ GROUPED GRID VIEW - By Bank ═══ */}
      {depositsViewMode === 'grouped' && (
      <div style={{background:THEME.cardBgAlt,borderRadius:12,overflow:"hidden",border:`1px solid ${THEME.border}`}}>
        <div style={{overflowX:"auto",scrollbarWidth:"thin",scrollbarColor:`${THEME.border} ${THEME.bg}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:THEME.cardBg,borderBottom:`1px solid ${THEME.border}`}}>
              {["Bank/ID","Type","Owner","Nominee","Invested","ROI","Maturity ₹","Start","Maturity","Days","Duration","Next","Action",""].map(h => (
                <th key={h} style={{padding:"8px 10px",textAlign:"left",color:THEME.textMuted,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={14} style={{padding:32,textAlign:"center",color:THEME.textMuted}}>No deposits found</td></tr>
              ) : (
                depBankNames.map(bankName => {
                  const { deps: bankDeps, indices } = groupedDeps[bankName];
                  const color = getBankColor(bankName);
                  const totalDeposited = bankDeps.reduce((s, d) => s + (Number(d.deposit) || 0), 0);
                  const totalMaturityAmt = bankDeps.reduce((s, d) => s + (Number(d.maturityAmt) || Number(d.deposit) || 0), 0);
                  const isExpanded = expandedBanks.has(`dep_${bankName}`);
                  const isSingleRow = bankDeps.length === 1;
                  const singleDep = isSingleRow ? bankDeps[0] : null;
                  // Find common values across all deposits in this bank
                  const commonNominee = bankDeps.every(d => d.nominee === bankDeps[0]?.nominee) ? bankDeps[0]?.nominee : null;
                  const commonType = bankDeps.every(d => d.type === bankDeps[0]?.type) ? bankDeps[0]?.type : null;
                  const commonOwner = bankDeps.every(d => (d.accountOwner || "") === (bankDeps[0]?.accountOwner || ""))
                    ? bankDeps[0]?.accountOwner
                    : null;
                  
                  return (
                    <React.Fragment key={bankName}>
                      {/* Bank Header Row - Clickable - Shows details if single row or common fields */}
                      <tr 
                        onClick={() => toggleDepBank(bankName)}
                        style={{background:`${color}15`,cursor:"pointer",borderBottom:`1px solid ${THEME.border}`}}
                      >
                        <td style={{padding:"8px 10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                            <div style={{width:10,height:10,borderRadius:"50%",background:color}} />
                            <span style={{fontWeight:700,color:THEME.text,fontSize:12}}>{bankName}</span>
                            <span style={{color:"#6B7280",fontSize:10}}>({bankDeps.length} FD{bankDeps.length > 1 ? "s" : ""})</span>
                          </div>
                          {isSingleRow && singleDep?.depositId && <div style={{fontSize:9,color:"#484F58",fontFamily:"monospace",marginLeft:30}}>{singleDep.depositId}</div>}
                        </td>
                        <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:10}}>{isSingleRow ? (singleDep?.type || "FD") : (commonType || "—")}</td>
                        <td style={{padding:"8px 10px",color:THEME.text,fontSize:10,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis"}} title={isSingleRow ? singleDep?.accountOwner : commonOwner || ""}>{isSingleRow ? (singleDep?.accountOwner || "—") : (commonOwner || (bankDeps.length > 1 ? "Various" : "—"))}</td>
                        <td style={{padding:"8px 10px",color:THEME.text,fontSize:10}}>{isSingleRow ? (singleDep?.nominee || "—") : (commonNominee || (bankDeps.length > 1 ? "Various" : "—"))}</td>
                        <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:700,color:THEME.text,fontSize:11}}>{fmt(totalDeposited)}</td>
                        <td style={{padding:"8px 10px",fontFamily:"monospace",color:THEME.accent,fontWeight:600,fontSize:10}}>{isSingleRow && singleDep?.roi ? (Number(singleDep.roi) * 100).toFixed(2) + "%" : "—"}</td>
                        <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:700,color:THEME.accent,fontSize:11}}>{fmt(totalMaturityAmt)}</td>
                        <td style={{padding:"8px 10px",color:THEME.textLight,whiteSpace:"nowrap",fontSize:10}}>{isSingleRow ? fmtDate(singleDep?.startDate) : "—"}</td>
                        <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                          {isSingleRow ? (
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <span style={{color:THEME.text,fontSize:10}}>{fmtDate(singleDep?.maturityDate)}</span>
                              <UrgencyBadge days={daysUntil(singleDep?.maturityDate)} />
                            </div>
                          ) : "—"}
                        </td>
                        <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:10,fontFamily:"monospace"}}>{isSingleRow ? (() => { const dm = daysUntil(singleDep?.maturityDate); return dm === null ? "—" : dm < 0 ? "0" : String(dm); })() : "—"}</td>
                        <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9}}>{isSingleRow ? (singleDep?.duration || "—") : "—"}</td>
                        <td style={{padding:"8px 10px",color:isSingleRow && singleDep?.nextAction && !singleDep.done ? "#F59E0B" : THEME.textLight,fontSize:9,maxWidth:72,overflow:"hidden",textOverflow:"ellipsis",fontWeight:isSingleRow && singleDep?.nextAction && !singleDep.done ? 600 : 400}} title={isSingleRow ? (singleDep?.nextAction || "") : ""}>{isSingleRow ? (singleDep?.nextAction ? (singleDep.done ? "✓ " : "⚡ ") + singleDep.nextAction : "—") : "—"}</td>
                        <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>{isSingleRow ? (singleDep?.maturityAction || "—") : "—"}</td>
                        <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                          {isSingleRow && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); toggleDone("deposit", indices[0]); }} style={{background:singleDep?.done ? "#238636" : THEME.cardBgAlt,color:singleDep?.done ? "#fff" : THEME.textMuted,border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3,fontWeight:600}}>{singleDep?.done ? "↩" : "✓"}</button>
                              <button onClick={(e) => { e.stopPropagation(); openEdit("deposit", indices[0]); }} style={{background:THEME.cardBgAlt,color:"#2563eb",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3}}>✏️</button>
                              <button onClick={(e) => { e.stopPropagation(); deleteRow("deposit", indices[0]); }} style={{background:THEME.cardBgAlt,color:"#F85149",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer"}}>🗑</button>
                            </>
                          )}
                        </td>
                      </tr>
                      
                      {/* Deposit Rows - Show when expanded */}
                      {isExpanded && bankDeps.map((d, j) => {
                        const origIdx = indices[j];
                        const days = daysUntil(d.maturityDate);
                        const daysCell = days === null ? "—" : days < 0 ? "0" : String(days);
                        return (
                          <tr key={`${bankName}-${j}`} style={{borderBottom:`1px solid ${THEME.border}`,background:d.done ? "rgba(46,160,67,0.05)" : days != null && days < 0 ? "rgba(110,118,129,0.1)" : days != null && days <= 90 ? "rgba(248,81,73,0.05)" : "transparent",opacity:d.done ? 0.6 : 1}}>
                            <td style={{padding:"8px 10px",paddingLeft:32}}>
                              <div style={{fontSize:9,color:"#484F58",fontFamily:"monospace"}}>{d.depositId || "—"}</div>
                            </td>
                            <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:10}}>{d.type || "FD"}</td>
                            <td style={{padding:"8px 10px",color:THEME.text,fontSize:10,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis"}} title={d.accountOwner || ""}>{d.accountOwner || "—"}</td>
                            <td style={{padding:"8px 10px",color:THEME.text,fontSize:10}}>{d.nominee || "—"}</td>
                            <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:600,color:THEME.text,fontSize:11}}>{fmt(d.deposit)}</td>
                            <td style={{padding:"8px 10px",fontFamily:"monospace",color:THEME.accent,fontWeight:600,fontSize:10}}>{d.roi ? (Number(d.roi) * 100).toFixed(2) + "%" : "—"}</td>
                            <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:600,color:THEME.accent,fontSize:11}}>{fmt(d.maturityAmt || d.deposit)}</td>
                            <td style={{padding:"8px 10px",color:THEME.textLight,whiteSpace:"nowrap",fontSize:10}}>{fmtDate(d.startDate)}</td>
                            <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                              <div style={{display:"flex",alignItems:"center",gap:4}}>
                                <span style={{color:THEME.text,fontSize:10}}>{fmtDate(d.maturityDate)}</span>
                                <UrgencyBadge days={days} />
                              </div>
                            </td>
                            <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:10,fontFamily:"monospace"}}>{daysCell}</td>
                            <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9}}>{d.duration || "—"}</td>
                            <td style={{padding:"8px 10px",color:d.nextAction && !d.done ? "#F59E0B" : THEME.textLight,fontSize:9,maxWidth:72,overflow:"hidden",textOverflow:"ellipsis",fontWeight:d.nextAction && !d.done ? 600 : 400}} title={d.nextAction || ""}>{d.nextAction ? (d.done ? "✓ " : "⚡ ") + d.nextAction : "—"}</td>
                            <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}} title={d.maturityAction}>{d.maturityAction || "—"}</td>
                            <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                              <button onClick={() => toggleDone("deposit", origIdx)} style={{background:d.done ? "#238636" : THEME.cardBgAlt,color:d.done ? "#fff" : THEME.textMuted,border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3,fontWeight:600}}>{d.done ? "↩" : "✓"}</button>
                              <button onClick={() => openEdit("deposit", origIdx)} style={{background:THEME.cardBgAlt,color:"#2563eb",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3}}>✏️</button>
                              <button onClick={() => deleteRow("deposit", origIdx)} style={{background:THEME.cardBgAlt,color:"#F85149",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer"}}>🗑</button>
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
      )}

      {/* ═══ FLAT GRID VIEW - All Rows ═══ */}
      {depositsViewMode === 'flat' && (
      <div style={{background:THEME.cardBgAlt,borderRadius:12,overflow:"hidden",border:`1px solid ${THEME.border}`}}>
        <div style={{overflowX:"auto",scrollbarWidth:"thin",scrollbarColor:`${THEME.border} ${THEME.bg}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:THEME.cardBg,borderBottom:`1px solid ${THEME.border}`}}>
              {["Bank","ID","Type","Owner","Nominee","Invested","ROI","Maturity ₹","Start","Maturity","Days","Duration","Next","Action",""].map(h => (
                <th key={h} style={{padding:"8px 10px",textAlign:"left",color:THEME.textMuted,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={15} style={{padding:32,textAlign:"center",color:THEME.textMuted}}>No deposits found</td></tr>
              ) : (
                filtered.map((d, idx) => {
                  const origIdx = deposits.indexOf(d);
                  const days = daysUntil(d.maturityDate);
                  const color = getBankColor(d.bank);
                  const daysCell = days === null ? "—" : days < 0 ? "0" : String(days);
                  return (
                    <tr key={idx} style={{borderBottom:`1px solid ${THEME.border}`,background:d.done ? "rgba(46,160,67,0.05)" : days != null && days < 0 ? "rgba(110,118,129,0.1)" : days != null && days <= 90 ? "rgba(248,81,73,0.05)" : "transparent",opacity:d.done ? 0.6 : 1}}>
                      <td style={{padding:"8px 10px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:color}} />
                          <span style={{fontWeight:600,color:THEME.text,fontSize:11}}>{d.bank}</span>
                        </div>
                      </td>
                      <td style={{padding:"8px 10px",fontSize:9,color:"#484F58",fontFamily:"monospace"}}>{d.depositId || "—"}</td>
                      <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:10}}>{d.type || "FD"}</td>
                      <td style={{padding:"8px 10px",color:THEME.text,fontSize:10,maxWidth:88,overflow:"hidden",textOverflow:"ellipsis"}} title={d.accountOwner || ""}>{d.accountOwner || "—"}</td>
                      <td style={{padding:"8px 10px",color:THEME.text,fontSize:10}}>{d.nominee || "—"}</td>
                      <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:600,color:THEME.text,fontSize:11}}>{fmt(d.deposit)}</td>
                      <td style={{padding:"8px 10px",fontFamily:"monospace",color:THEME.accent,fontWeight:600,fontSize:10}}>{d.roi ? (Number(d.roi) * 100).toFixed(2) + "%" : "—"}</td>
                      <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:600,color:THEME.accent,fontSize:11}}>{fmt(d.maturityAmt || d.deposit)}</td>
                      <td style={{padding:"8px 10px",color:THEME.textLight,whiteSpace:"nowrap",fontSize:10}}>{fmtDate(d.startDate)}</td>
                      <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{color:THEME.text,fontSize:10}}>{fmtDate(d.maturityDate)}</span>
                          <UrgencyBadge days={days} />
                        </div>
                      </td>
                      <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:10,fontFamily:"monospace"}}>{daysCell}</td>
                      <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9}}>{d.duration || "—"}</td>
                      <td style={{padding:"8px 10px",color:d.nextAction && !d.done ? "#F59E0B" : THEME.textLight,fontSize:9,maxWidth:72,overflow:"hidden",textOverflow:"ellipsis",fontWeight:d.nextAction && !d.done ? 600 : 400}} title={d.nextAction || ""}>{d.nextAction ? (d.done ? "✓ " : "⚡ ") + d.nextAction : "—"}</td>
                      <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}} title={d.maturityAction}>{d.maturityAction || "—"}</td>
                      <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                        <button onClick={() => toggleDone("deposit", origIdx)} style={{background:d.done ? "#238636" : THEME.cardBgAlt,color:d.done ? "#fff" : THEME.textMuted,border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3,fontWeight:600}}>{d.done ? "↩" : "✓"}</button>
                        <button onClick={() => openEdit("deposit", origIdx)} style={{background:THEME.cardBgAlt,color:"#2563eb",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3}}>✏️</button>
                        <button onClick={() => deleteRow("deposit", origIdx)} style={{background:THEME.cardBgAlt,color:"#F85149",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer"}}>🗑</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ═══ CARDS VIEW - Grouped by Bank ═══ */}
      {depositsViewMode === 'cards' && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12,alignItems:"start"}}>
          {filtered.length === 0 ? (
            <div style={{gridColumn:"1/-1",padding:32,textAlign:"center",color:THEME.textMuted}}>No deposits found</div>
          ) : (
            depBankNames.map(bankName => {
              const { deps: bankDeps, indices } = groupedDeps[bankName];
              const color = getBankColor(bankName);
              const totalDeposited = bankDeps.reduce((s, d) => s + (Number(d.deposit) || 0), 0);
              const totalMaturityAmt = bankDeps.reduce((s, d) => s + (Number(d.maturityAmt) || Number(d.deposit) || 0), 0);
              const isExpanded = expandedBanks.has(`dep_card_${bankName}`);
              
              const toggleCardBank = () => {
                setExpandedBanks(prev => {
                  const next = new Set(prev);
                  const key = `dep_card_${bankName}`;
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
              };
              
              return (
                <div key={bankName} style={{background:THEME.cardBgAlt,borderRadius:12,borderTop:`1px solid ${color}30`,borderRight:`1px solid ${color}30`,borderBottom:`1px solid ${color}30`,borderLeft:`3px solid ${color}`,overflow:"hidden"}}>
                  {/* Bank Header - Clickable */}
                  <div 
                    onClick={toggleCardBank}
                    style={{padding:"12px 14px",background:`${color}10`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                  >
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:THEME.text}}>{bankName}</div>
                        <div style={{fontSize:10,color:THEME.textLight}}>{bankDeps.length} FD{bankDeps.length > 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:12,fontWeight:600,fontFamily:"monospace",color:THEME.textLight}}>Inv: {fmt(totalDeposited)}</div>
                      <div style={{fontSize:14,fontWeight:800,fontFamily:"monospace",color:THEME.accent}}>Mat: {fmt(totalMaturityAmt)}</div>
                    </div>
                  </div>
                  
                  {/* Deposits List - Collapsible */}
                  {isExpanded && (
                    <div style={{borderTop:`1px solid ${color}20`}}>
                      {bankDeps.map((d, j) => {
                        const origIdx = indices[j];
                        const days = daysUntil(d.maturityDate);
                        const urgency = days === null ? "none" : days < 0 ? "expired" : days <= 7 ? "urgent" : days <= 30 ? "soon" : days <= 90 ? "warning" : "none";
                        return (
                          <div key={j} style={{padding:"10px 14px",borderBottom:j < bankDeps.length - 1 ? `1px solid ${THEME.border}` : "none",background:d.done ? "rgba(46,160,67,0.05)" : urgency === "expired" ? "rgba(110,118,129,0.1)" : urgency === "urgent" ? "rgba(248,81,73,0.05)" : "transparent",opacity:d.done ? 0.6 : 1}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                              <div style={{flex:1}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                  {d.depositId && <span style={{fontSize:9,color:"#484F58",fontFamily:"monospace"}}>{d.depositId}</span>}
                                  <span style={{background:"#1D4ED820",color:"#60A5FA",padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{d.type || "FD"}</span>
                                  {d.accountOwner && <span style={{fontSize:9,color:"#9CA3AF"}}>Owner: {d.accountOwner}</span>}
                                  {d.nominee && <span style={{fontSize:9,color:"#6B7280"}}>👤 {d.nominee}</span>}
                                  {d.done && <span style={{fontSize:9,color:"#34D399"}}>✓ Done</span>}
                                </div>
                                <div style={{display:"flex",alignItems:"baseline",gap:12,marginTop:6,flexWrap:"wrap"}}>
                                  <div>
                                    <span style={{fontSize:9,color:"#6B7280"}}>Invested</span>
                                    <div style={{fontSize:13,fontWeight:700,fontFamily:"monospace",color:THEME.text}}>{fmt(d.deposit)}</div>
                                  </div>
                                  <div>
                                    <span style={{fontSize:9,color:"#6B7280"}}>ROI</span>
                                    <div style={{fontSize:11,fontWeight:600,fontFamily:"monospace",color:THEME.accent}}>{d.roi ? (Number(d.roi) * 100).toFixed(2) + "%" : "—"}</div>
                                  </div>
                                  <div>
                                    <span style={{fontSize:9,color:"#6B7280"}}>Maturity</span>
                                    <div style={{fontSize:13,fontWeight:700,fontFamily:"monospace",color:THEME.accent}}>{fmt(d.maturityAmt || d.deposit)}</div>
                                  </div>
                                </div>
                                {d.balanceHistory?.length > 0 && (() => {
                                  const latest = d.balanceHistory[d.balanceHistory.length - 1];
                                  const prev = latest.previousAmount != null ? `${fmt(latest.previousAmount, (d.currency || 'INR') as Currency)} → ` : '';
                                  return (
                                    <div style={{fontSize:10,color:"#6B7280",marginTop:4}} title={d.balanceHistory.map((h: { date: string; amount: number; previousAmount?: number; source?: string }) => `${new Date(h.date).toLocaleString()}: ${h.previousAmount != null ? fmt(h.previousAmount, (d.currency || 'INR') as Currency) + ' → ' : ''}${fmt(h.amount, (d.currency || 'INR') as Currency)} ${h.source || ''}`).join('\n')}>
                                      📅 Updated {new Date(latest.date).toLocaleDateString(undefined, { dateStyle: 'short' })} · {prev}{fmt(latest.amount, (d.currency || 'INR') as Currency)} {latest.source && <span style={{color:"#9CA3AF"}}>({latest.source})</span>}
                                    </div>
                                  );
                                })()}
                                <div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:THEME.textLight}}>
                                  <span>{fmtDate(d.startDate)} → {fmtDate(d.maturityDate)}</span>
                                  {d.duration && <span style={{color:"#6B7280"}}>{d.duration}</span>}
                                  <UrgencyBadge days={days} />
                                </div>
                                {d.nextAction && !d.done && <div style={{fontSize:10,color:"#2563EB",marginTop:4,fontWeight:600}}>📌 {d.nextAction}</div>}
                                {d.maturityAction && <div style={{fontSize:10,color:"#F59E0B",marginTop:4}}>⚡ {d.maturityAction}</div>}
                              </div>
                              <div style={{display:"flex",gap:4,flexShrink:0}}>
                                <button onClick={(e) => { e.stopPropagation(); toggleDone("deposit", origIdx); }} style={{background:d.done ? "#dcfce7" : THEME.cardBgAlt,color:d.done ? "#34D399" : "#6B7280",border:`1px solid ${d.done ? "#16a34a" : THEME.border}`,borderRadius:5,padding:"2px 6px",fontSize:10,cursor:"pointer",fontWeight:700}}>{d.done ? "↩" : "✓"}</button>
                                <button onClick={(e) => { e.stopPropagation(); openEdit("deposit", origIdx); }} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:5,padding:"2px 5px",fontSize:10,cursor:"pointer"}}>✏️</button>
                                <button onClick={(e) => { e.stopPropagation(); deleteRow("deposit", origIdx); }} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:5,padding:"2px 5px",fontSize:10,cursor:"pointer"}}>🗑</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Summary Footer */}
      <div style={{display:"flex",justifyContent:isMobile?"center":"flex-end",gap:8,marginTop:12,flexWrap:"wrap"}}>
        <div style={{background:THEME.cardBgAlt,borderRadius:8,padding:"8px 14px",border:`1px solid ${THEME.border}`,fontSize:11}}>Invested: <strong style={{fontFamily:"monospace",color:THEME.text}}>{fmt(filtered.reduce((s, d) => s + (Number(d.deposit) || 0), 0))}</strong></div>
        <div style={{background:THEME.cardBgAlt,borderRadius:8,padding:"8px 14px",border:`1px solid ${THEME.border}`,fontSize:11}}>Maturity: <strong style={{fontFamily:"monospace",color:THEME.accent}}>{fmt(filtered.reduce((s, d) => s + (Number(d.maturityAmt) || Number(d.deposit) || 0), 0))}</strong></div>
      </div>

      {/* By Bank Chart - shared Donut / Bar widget */}
      <div style={{marginTop:16}}>
        <BankDonutBarChart
          theme={THEME}
          data={typePieData as ChartSlice[]}
          vizMode={depositsBankViz}
          setVizMode={setDepositsBankViz}
          currency="INR"
          title="🏦 Deposits by Bank"
          subtitle={`${typePieData.length} banks · invested amounts`}
          isMobile={isMobile}
          showLabels
          legendKey="dep_bank_chart"
          showLegend={showLegend}
          setShowLegend={setShowLegend}
        />
      </div>
      </>
      )}
    </div>
  );
}
