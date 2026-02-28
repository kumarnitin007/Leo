/**
 * Bank Dashboard Component
 * 
 * Comprehensive financial dashboard for tracking:
 * - Fixed Deposits with maturity tracking
 * - Bank Accounts
 * - Bills and subscriptions
 * - Financial action items
 * 
 * Features:
 * - Excel import/export
 * - Charts and visualizations
 * - Timeline view
 * - Encrypted storage via Supabase
 */

import React, { useState, useEffect, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { Deposit, BankAccount, Bill, ActionItem, BankRecordsData, PRELOAD_BANK_DATA } from '../types/bankRecords';
import { CryptoKey, encryptData, decryptData } from '../utils/encryption';

interface BankDashboardProps {
  supabase?: SupabaseClient;
  userId?: string;
  encryptionKey?: CryptoKey;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today = new Date();
today.setHours(0,0,0,0);

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0,0,0,0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function fmt(n: number | string | null | undefined): string {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v >= 10000000) return "₹" + (v/10000000).toFixed(2) + " Cr";
  if (v >= 100000)  return "₹" + (v/100000).toFixed(2) + " L";
  return "₹" + v.toLocaleString("en-IN");
}

function fmtFull(n: number | string | null | undefined): string {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  return "₹" + Number(n).toLocaleString("en-IN");
}

function fmtDate(str: string | null | undefined): string {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

const PALETTE = ["#F97316","#10B981","#3B82F6","#8B5CF6","#EC4899","#F59E0B","#06B6D4","#EF4444","#84CC16","#A78BFA","#FB923C","#34D399"];
const bankColorMap: Record<string, string> = {};

function getBankColor(bank: string): string {
  if (!bank) return "#6B7280";
  if (!bankColorMap[bank]) bankColorMap[bank] = PALETTE[Object.keys(bankColorMap).length % PALETTE.length];
  return bankColorMap[bank];
}

function UrgencyBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0) return <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:"#374151",color:"#6B7280",fontWeight:700}}>Past</span>;
  if (days === 0) return <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:"#7F1D1D",color:"#FCA5A5",fontWeight:700}}>🔥 Today</span>;
  if (days <= 7) return <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:"#7F1D1D",color:"#FCA5A5",fontWeight:700}}>≤ 7d</span>;
  if (days <= 30) return <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:"#7F1D1D",color:"#FCA5A5",fontWeight:700}}>{days}d</span>;
  if (days <= 90) return <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:"#78350F",color:"#FDE047",fontWeight:700}}>{days}d</span>;
  if (days <= 180) return <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:"#064E3B",color:"#6EE7B7",fontWeight:700}}>{days}d</span>;
  return <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:"#1E3A5F",color:"#93C5FD",fontWeight:700}}>{days}d</span>;
}

function UrgencyBadge({ days }: { days: number | null }) {
  const bs = (bg: string, color: string) => ({ background:bg, color, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:"nowrap" as const });
  if (days === null) return <span style={bs("#1F2937","#6B7280")}>No Date</span>;
  if (days < 0)   return <span style={bs("#1F2937","#4B5563")}>Matured</span>;
  if (days === 0) return <span style={bs("#7F1D1D","#FCA5A5")}>TODAY!</span>;
  if (days <= 30) return <span style={bs("#7F1D1D","#FCA5A5")}>🔴 {days}d</span>;
  if (days <= 90) return <span style={bs("#78350F","#FCD34D")}>🟡 {days}d</span>;
  if (days <= 180) return <span style={bs("#064E3B","#6EE7B7")}>🟢 {days}d</span>;
  return <span style={bs("#1E3A5F","#93C5FD")}>{days}d</span>;
}

const emptyDeposit: Deposit  = { bank:"", type:"Fixed Deposit", depositId:"", nominee:"", startDate:"", deposit:"", roi:"", maturityAmt:"", maturityDate:"", duration:"", maturityAction:"", done:false };
const emptyAccount: BankAccount  = { bank:"", type:"Saving", holders:"", amount:"", roi:"", online:"Yes", address:"", detail:"", nextAction:"", done:false };
const emptyBill: Bill     = { name:"", freq:"Monthly", amount:"", due:"", priority:"Normal", phone:"", email:"", done:false };
const emptyAction: ActionItem   = { title:"", bank:"", date:"", note:"", done:false };

const inputSt: React.CSSProperties = { background:"#0D1117", border:"1px solid #374151", color:"#F9FAFB", borderRadius:8, padding:"8px 12px", fontSize:13, width:"100%", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const labelSt: React.CSSProperties = { fontSize:11, color:"#9CA3AF", fontWeight:600, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 };

// ─── Main Component ──────────────────────────────────────────────────────────
export default function BankDashboard({ supabase, userId, encryptionKey }: BankDashboardProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState(false);
  const [modal, setModal] = useState<{type: string; mode: string; idx?: number} | null>(null);
  const [form, setForm] = useState<any>({});
  const [filterBank, setFilterBank] = useState("All");
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Storage ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, [supabase, userId, encryptionKey]);

  async function loadData() {
    try {
      if (supabase && userId && encryptionKey) {
        // Load from Supabase
        const { data, error } = await supabase
          .from('myday_bank_records')
          .select('data')
          .eq('user_id', userId)
          .maybeSingle(); // Use maybeSingle instead of single to handle no rows

        if (error) {
          console.error('[BankDashboard] Supabase query error:', error);
          // If table doesn't exist or query fails, show setup banner
          setShowSetupBanner(true);
          // Use preload data
          setDeposits(PRELOAD_BANK_DATA.deposits);
          setAccounts(PRELOAD_BANK_DATA.accounts);
          setBills(PRELOAD_BANK_DATA.bills);
          setActions(PRELOAD_BANK_DATA.actions);
        } else if (data?.data) {
          // Decrypt the data
          try {
            const decrypted = await decryptData(data.data, encryptionKey);
            const parsed: BankRecordsData = JSON.parse(decrypted);
            setDeposits(parsed.deposits || []);
            setAccounts(parsed.accounts || []);
            setBills(parsed.bills || []);
            setActions(parsed.actions || []);
            console.log('[BankDashboard] ✅ Loaded data from Supabase');
          } catch (decryptError) {
            console.error('[BankDashboard] Decryption error:', decryptError);
            // Fallback to preload if decryption fails
            setDeposits(PRELOAD_BANK_DATA.deposits);
            setAccounts(PRELOAD_BANK_DATA.accounts);
            setBills(PRELOAD_BANK_DATA.bills);
            setActions(PRELOAD_BANK_DATA.actions);
          }
        } else {
          // No data yet — seed with preloaded data
          console.log('[BankDashboard] 📊 No data found, loading sample data');
          setDeposits(PRELOAD_BANK_DATA.deposits);
          setAccounts(PRELOAD_BANK_DATA.accounts);
          setBills(PRELOAD_BANK_DATA.bills);
          setActions(PRELOAD_BANK_DATA.actions);
        }
      } else {
        // No Supabase/encryption — use preload data
        console.log('[BankDashboard] 💾 Using local preload data');
        setDeposits(PRELOAD_BANK_DATA.deposits);
        setAccounts(PRELOAD_BANK_DATA.accounts);
        setBills(PRELOAD_BANK_DATA.bills);
        setActions(PRELOAD_BANK_DATA.actions);
      }
    } catch (e) {
      console.error('[BankDashboard] Load error:', e);
      // Always fallback to preload data on any error
      setDeposits(PRELOAD_BANK_DATA.deposits);
      setAccounts(PRELOAD_BANK_DATA.accounts);
      setBills(PRELOAD_BANK_DATA.bills);
      setActions(PRELOAD_BANK_DATA.actions);
    }
    setLoading(false);
  }

  async function persist(deps: Deposit[], accs: BankAccount[], bls: Bill[], acts: ActionItem[]) {
    const payload: BankRecordsData = { deposits: deps, accounts: accs, bills: bls, actions: acts, updatedAt: new Date().toISOString(), version: 1 };
    try {
      if (supabase && userId && encryptionKey) {
        // Encrypt before saving
        const encrypted = await encryptData(JSON.stringify(payload), encryptionKey);
        await supabase
          .from('myday_bank_records')
          .upsert(
            { user_id: userId, data: encrypted, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
      }
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (e) {
      console.error('BankDashboard save error:', e);
    }
  }

  function save(deps: Deposit[], accs: BankAccount[], bls: Bill[], acts: ActionItem[]) {
    setDeposits(deps); setAccounts(accs); setBills(bls); setActions(acts);
    persist(deps, accs, bls, acts);
  }

  // ── Excel Import (Smart Merge by ID) ────────────────────────────────────
  async function handleExcel(file: File) {
    try {
      const { read, utils } = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type:"array", cellDates:true });
      
      let newDeposits: Deposit[] = [];
      let newAccounts: BankAccount[] = [];
      let newBills: Bill[] = [];
      
      // Helper to convert Excel date to ISO string
      const toISO = (val: any): string | null => {
        if (!val) return null;
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (typeof val === 'string') return val;
        return null;
      };
      
      // ── Parse Deposits Sheet ──
      if (wb.SheetNames.includes("Deposits")) {
        const rows = utils.sheet_to_json(wb.Sheets["Deposits"], { header:1, defval:null }) as any[][];
        const hIdx = rows.findIndex((r: any) => r && r.includes("Bank") && r.includes("Type") && (r.includes("Deposit") || r.includes("Deposit ID")));
        if (hIdx >= 0) {
          const h = rows[hIdx];
          const col = (n: string) => h.findIndex((x: any) => x && x.toString().toLowerCase().includes(n.toLowerCase()));
          const [cB, cT, cI, cN, cS, cD, cR, cM, cMD, cDu, cA] = [
            col("Bank"), col("Type"), col("Deposit ID"), col("Nominee"), 
            col("Start"), col("Deposit"), col("ROI"), col("Maturity Amount"), 
            col("Maturity Date"), col("Duration"), col("Maturity")
          ];
          
          for (let i = hIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[cB]) continue;
            const bank = r[cB]?.toString().trim();
            if (!bank || bank === "Row Labels") continue;
            
            newDeposits.push({
              bank: bank,
              type: r[cT]?.toString() || "Fixed Deposit",
              depositId: r[cI]?.toString() || "",
              nominee: r[cN]?.toString() || "",
              startDate: toISO(r[cS]) || "",
              deposit: parseFloat(r[cD]) || 0,
              roi: parseFloat(r[cR]) || 0,
              maturityAmt: parseFloat(r[cM]) || 0,
              maturityDate: toISO(r[cMD]) || "",
              duration: r[cDu]?.toString() || "",
              maturityAction: r[cA]?.toString() || "",
              done: false
            });
          }
        }
      }
      
      // ── Parse Banks (Accounts) Sheet ──
      if (wb.SheetNames.includes("Banks")) {
        const rows = utils.sheet_to_json(wb.Sheets["Banks"], { header:1, defval:null }) as any[][];
        const hIdx = rows.findIndex((r: any) => r && r.includes("Source"));
        if (hIdx >= 0) {
          const h = rows[hIdx];
          const col = (n: string) => h.findIndex((x: any) => x && x.toString().toLowerCase().includes(n.toLowerCase()));
          const [cS, cA, cT, cN1, cN2, cOl, cAc, cR, cAd, cDe] = [
            col("Source"), col("Amount"), col("Type"), col("1st"), col("2nd"),
            col("Online"), col("Next"), col("ROI"), col("Address"), col("Details")
          ];
          
          for (let i = hIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[cS]) continue;
            const bank = r[cS]?.toString().trim();
            if (!bank) continue;
            
            newAccounts.push({
              bank: bank,
              type: r[cT]?.toString() || "Saving",
              holders: [r[cN1], r[cN2]].filter(Boolean).join(", "),
              amount: parseFloat(r[cA]) || 0,
              roi: parseFloat(r[cR]) || 0,
              online: r[cOl]?.toString() || "No",
              address: r[cAd]?.toString() || "",
              detail: r[cDe]?.toString() || "",
              nextAction: r[cAc]?.toString() || "",
              done: false
            });
          }
        }
      }
      
      // ── Parse Bills Sheet ──
      if (wb.SheetNames.includes("Bills")) {
        const rows = utils.sheet_to_json(wb.Sheets["Bills"], { header:1, defval:null }) as any[][];
        const hIdx = rows.findIndex((r: any) => r && r.includes("Name") && r.includes("Frequency"));
        if (hIdx >= 0) {
          const h = rows[hIdx];
          const col = (n: string) => h.findIndex((x: any) => x && x.toString().toLowerCase().includes(n.toLowerCase()));
          const [cN, cF, cA, cD, cP, cPh, cE] = [
            col("Name"), col("Freq"), col("Amount"), col("Date"),
            col("Priority"), col("Phone"), col("Email")
          ];
          
          for (let i = hIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[cN]) continue;
            
            newBills.push({
              name: r[cN]?.toString().trim(),
              freq: r[cF]?.toString() || "Monthly",
              amount: parseFloat(r[cA]) || 0,
              due: r[cD]?.toString() || "",
              priority: r[cP]?.toString() || "Normal",
              phone: r[cPh]?.toString() || "",
              email: r[cE]?.toString() || "",
              done: false
            });
          }
        }
      }
      
      // ── Smart Merge Logic ──
      let addedCount = 0;
      let updatedCount = 0;
      
      // Merge Deposits (by bank + depositId OR bank + startDate)
      const mergedDeposits = [...deposits];
      newDeposits.forEach(newDep => {
        const key = newDep.depositId 
          ? `${newDep.bank}|${newDep.depositId}`
          : `${newDep.bank}|${newDep.startDate}`;
        
        const existingIdx = mergedDeposits.findIndex(d => {
          const existingKey = d.depositId
            ? `${d.bank}|${d.depositId}`
            : `${d.bank}|${d.startDate}`;
          return existingKey === key;
        });
        
        if (existingIdx >= 0) {
          mergedDeposits[existingIdx] = { ...mergedDeposits[existingIdx], ...newDep };
          updatedCount++;
        } else {
          mergedDeposits.push(newDep);
          addedCount++;
        }
      });
      
      // Merge Accounts (by bank + type)
      const mergedAccounts = [...accounts];
      newAccounts.forEach(newAcc => {
        const key = `${newAcc.bank}|${newAcc.type}`;
        const existingIdx = mergedAccounts.findIndex(a => 
          `${a.bank}|${a.type}` === key
        );
        
        if (existingIdx >= 0) {
          mergedAccounts[existingIdx] = { ...mergedAccounts[existingIdx], ...newAcc };
          updatedCount++;
        } else {
          mergedAccounts.push(newAcc);
          addedCount++;
        }
      });
      
      // Merge Bills (by name)
      const mergedBills = [...bills];
      newBills.forEach(newBill => {
        const existingIdx = mergedBills.findIndex(b => 
          b.name.toLowerCase() === newBill.name.toLowerCase()
        );
        
        if (existingIdx >= 0) {
          mergedBills[existingIdx] = { ...mergedBills[existingIdx], ...newBill };
          updatedCount++;
        } else {
          mergedBills.push(newBill);
          addedCount++;
        }
      });
      
      // Save merged data
      save(mergedDeposits, mergedAccounts, mergedBills, actions);
      
      alert(`✅ Excel imported!\n📊 ${addedCount} new records added\n✏️ ${updatedCount} records updated\n📁 Total: ${mergedDeposits.length} deposits, ${mergedAccounts.length} accounts, ${mergedBills.length} bills`);
      
    } catch (e) {
      console.error('Excel import failed:', e);
      alert('❌ Failed to import Excel file');
    }
  }

  // ── CRUD Operations ──────────────────────────────────────────────────────
  function openAdd(type: string) {
    const empty = type==="deposit"?emptyDeposit:type==="account"?emptyAccount:type==="bill"?emptyBill:emptyAction;
    setForm({...empty});
    setModal({type,mode:"add"});
  }

  function openEdit(type: string, idx: number) {
    const arr = type==="deposit"?deposits:type==="account"?accounts:type==="bill"?bills:actions;
    setForm({...arr[idx]});
    setModal({type,mode:"edit",idx});
  }

  function deleteRow(type: string, idx: number) {
    if(!confirm("Delete this record?")) return;
    if(type==="deposit") save(deposits.filter((_,i)=>i!==idx),accounts,bills,actions);
    else if(type==="account") save(deposits,accounts.filter((_,i)=>i!==idx),bills,actions);
    else if(type==="bill") save(deposits,accounts,bills.filter((_,i)=>i!==idx),actions);
    else save(deposits,accounts,bills,actions.filter((_,i)=>i!==idx));
  }

  function saveModal() {
    const {type,mode,idx}=modal!;
    if(type==="deposit"){ const d=[...deposits]; mode==="add"?d.push(form):d[idx!]=form; save(d,accounts,bills,actions); }
    else if(type==="account"){ const a=[...accounts]; mode==="add"?a.push(form):a[idx!]=form; save(deposits,a,bills,actions); }
    else if(type==="bill"){ const b=[...bills]; mode==="add"?b.push(form):b[idx!]=form; save(deposits,accounts,b,actions); }
    else { const ac=[...actions]; mode==="add"?ac.push(form):ac[idx!]=form; save(deposits,accounts,bills,ac); }
    setModal(null);
  }

  function toggleDone(type: string, idx: number) {
    if(type==="deposit"){ const d=[...deposits]; d[idx]={...d[idx],done:!d[idx].done}; save(d,accounts,bills,actions); }
    else if(type==="account"){ const a=[...accounts]; a[idx]={...a[idx],done:!a[idx].done}; save(deposits,a,bills,actions); }
    else if(type==="bill"){ const b=[...bills]; b[idx]={...b[idx],done:!b[idx].done}; save(deposits,accounts,b,actions); }
    else { const ac=[...actions]; ac[idx]={...ac[idx],done:!ac[idx].done}; save(deposits,accounts,bills,ac); }
  }

  // ── Derived Data ─────────────────────────────────────────────────────────
  const totalInvested = deposits.reduce((s,d)=>s+(Number(d.deposit)||0),0);
  const totalMaturity = deposits.reduce((s,d)=>s+(Number(d.maturityAmt)||Number(d.deposit)||0),0);
  const upcoming90 = deposits.filter(d=>{ const x=daysUntil(d.maturityDate); return x!=null&&x>=0&&x<=90&&!d.done; });
  const sortedDeps = [...deposits].sort((a,b)=>new Date(a.maturityDate||"2099").getTime()-new Date(b.maturityDate||"2099").getTime());

  const bankTotals: Record<string, {deposited:number; maturity:number; count:number; avgRoi:number}> = {};
  deposits.forEach(d=>{
    if(!d.bank) return;
    if(!bankTotals[d.bank]) bankTotals[d.bank]={deposited:0,maturity:0,count:0,avgRoi:0};
    bankTotals[d.bank].deposited += Number(d.deposit)||0;
    bankTotals[d.bank].maturity  += Number(d.maturityAmt)||Number(d.deposit)||0;
    bankTotals[d.bank].count++;
    bankTotals[d.bank].avgRoi += Number(d.roi)||0;
  });
  
  Object.values(bankTotals).forEach(b => b.avgRoi = b.avgRoi / b.count);

  const pieData = Object.entries(bankTotals).map(([name,v])=>({ name, value:v.deposited, color:getBankColor(name) }));
  
  const typePieData = (() => {
    const types: Record<string, number> = {};
    deposits.forEach(d => {
      const t = d.type || 'Fixed Deposit';
      types[t] = (types[t] || 0) + (Number(d.deposit) || 0);
    });
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    return Object.entries(types).map(([name, value], i) => ({ 
      name, 
      value, 
      color: colors[i % colors.length] 
    }));
  })();
  
  const roiData = Object.entries(bankTotals).map(([bank, v]) => ({
    bank: bank.slice(0, 10),
    roi: (v.avgRoi * 100).toFixed(1),
    color: getBankColor(bank)
  })).sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi)).slice(0, 8);
  
  const bankCompareData = Object.entries(bankTotals).map(([bank, v]) => ({
    bank: bank.slice(0, 10),
    invested: (v.deposited / 100000).toFixed(1),
    maturity: (v.maturity / 100000).toFixed(1),
    color: getBankColor(bank)
  })).sort((a, b) => parseFloat(b.invested) - parseFloat(a.invested)).slice(0, 8);
  
  const areaData = (() => {
    const monthlyData: Record<string, number> = {};
    deposits.forEach(d => {
      if (!d.maturityDate) return;
      const key = d.maturityDate.substring(0, 7); // YYYY-MM
      monthlyData[key] = (monthlyData[key] || 0) + (Number(d.maturityAmt) || Number(d.deposit) || 0);
    });
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amt]) => ({ month, amt: (amt / 100000).toFixed(1) }));
  })();

  const allTabs = [
    {id:"overview",  label:"📊 Overview"},
    {id:"charts",    label:"📈 Charts"},
    {id:"timeline",  label:"📅 Timeline"},
    {id:"actions",   label:"⚡ Actions"},
    {id:"deposits",  label:"💰 Deposits"},
    {id:"accounts",  label:"🏦 Accounts"},
    {id:"bills",     label:"📋 Bills"},
  ];
  
  const banks = Array.from(new Set(deposits.map(d => d.bank).filter(Boolean)));
  const filtered = deposits.filter(d => {
    if (filterBank && filterBank !== "All" && d.bank !== filterBank) return false;
    if (search && !`${d.bank} ${d.nominee} ${d.depositId}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",color:"#6B7280"}}>
        <div>Loading financial data...</div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:"#0D1117",color:"#F9FAFB",fontFamily:"'Sora','Segoe UI',sans-serif",paddingBottom:48}}>
      {/* Setup Banner */}
      {showSetupBanner && (
        <div style={{background:"linear-gradient(90deg,#7F1D1D,#991B1B)",border:"1px solid #DC2626",padding:"12px 20px",margin:"16px",borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:24}}>⚠️</span>
          <div style={{flex:1}}>
            <strong style={{color:"#FCA5A5",display:"block",marginBottom:4}}>Database Setup Required</strong>
            <div style={{color:"#FCA5A5",fontSize:13}}>
              Run <code style={{background:"rgba(0,0,0,0.3)",padding:"2px 6px",borderRadius:4}}>supabase-bank-records.sql</code> in your Supabase SQL Editor to enable data persistence. Using sample data for now.
            </div>
          </div>
          <button onClick={()=>setShowSetupBanner(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#FCA5A5",padding:"4px 12px",borderRadius:6,cursor:"pointer",fontSize:20}}>✕</button>
        </div>
      )}
      
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1C1C2E 0%,#16213E 55%,#0F3460 100%)",borderBottom:"1px solid #1F2937",padding:"18px 28px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4,flexWrap:"wrap"}}>
          <span style={{fontSize:26}}>🦁</span>
          <div>
            <div style={{fontSize:10,color:"#4B5563",letterSpacing:2,fontWeight:700,textTransform:"uppercase"}}>Leo Planner · Safe · Financial</div>
            <div style={{fontSize:19,fontWeight:800,color:"#F9FAFB",letterSpacing:"-0.5px"}}>Bank Records Dashboard</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            {savedMsg && <span style={{color:"#34D399",fontSize:12,fontWeight:700}}>✅ Saved</span>}
            <button onClick={()=>fileRef.current?.click()} style={{background:"#1D4ED8",color:"#fff",border:"none",borderRadius:9,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📂 Excel</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleExcel(e.target.files[0]);e.target.value="";}} />
          </div>
        </div>
        <div style={{display:"flex",gap:1,marginTop:14,overflowX:"auto"}}>
          {allTabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?"rgba(29,78,216,0.3)":"transparent",
              color:tab===t.id?"#60A5FA":"#6B7280",
              border:"none",borderBottom:tab===t.id?"2px solid #3B82F6":"2px solid transparent",
              padding:"9px 16px",borderRadius:"7px 7px 0 0",cursor:"pointer",
              fontSize:12,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"22px 28px"}}>
        {/* Tab Content - Simplified for space, add full implementation */}
        {tab==="overview" && (
          <div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <div style={{background:"#1C1C2E",borderRadius:14,padding:"16px 20px",borderLeft:"3px solid #3B82F6",flex:1,minWidth:140}}>
                <div style={{color:"#6B7280",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Total Invested</div>
                <div style={{color:"#F9FAFB",fontSize:20,fontWeight:800,fontFamily:"monospace",marginTop:6}}>{fmt(totalInvested)}</div>
                <div style={{color:"#4B5563",fontSize:11,marginTop:4}}>{deposits.length} deposits</div>
              </div>
              <div style={{background:"#1C1C2E",borderRadius:14,padding:"16px 20px",borderLeft:"3px solid #10B981",flex:1,minWidth:140}}>
                <div style={{color:"#6B7280",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>At Maturity</div>
                <div style={{color:"#F9FAFB",fontSize:20,fontWeight:800,fontFamily:"monospace",marginTop:6}}>{fmt(totalMaturity)}</div>
                <div style={{color:"#4B5563",fontSize:11,marginTop:4}}>projected value</div>
              </div>
              <div style={{background:"#1C1C2E",borderRadius:14,padding:"16px 20px",borderLeft:"3px solid #F59E0B",flex:1,minWidth:140}}>
                <div style={{color:"#6B7280",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Total Gain</div>
                <div style={{color:"#F9FAFB",fontSize:20,fontWeight:800,fontFamily:"monospace",marginTop:6}}>{fmt(totalMaturity-totalInvested)}</div>
                <div style={{color:"#4B5563",fontSize:11,marginTop:4}}>{totalInvested?`+${(((totalMaturity-totalInvested)/totalInvested)*100).toFixed(1)}%`:""}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* ══ CHARTS TAB ════════════════════════════════════════════════ */}
        {tab === "charts" && (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* Row 1: Investment by Bank & Type */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>🥧 Investment by Bank</div>
                <div style={{fontSize:12,color:"#4B5563",marginBottom:12}}>Share of total corpus</div>
                {pieData.length === 0 ? (
                  <div style={{color:"#4B5563",padding:40,textAlign:"center"}}>No data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie 
                          data={pieData} 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={60} 
                          outerRadius={95} 
                          paddingAngle={3} 
                          dataKey="value"
                          label={({name, percent}) => `${name.slice(0, 6)} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="#111827" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip 
                          formatter={(v: any) => `₹${(v / 100000).toFixed(1)}L`} 
                          contentStyle={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:8,fontSize:12}} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
                      {pieData.map((e, i) => (
                        <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,background:"#0D1117",padding:"4px 10px",borderRadius:20}}>
                          <div style={{width:9,height:9,borderRadius:"50%",background:e.color}} />
                          <span style={{color:"#D1D5DB"}}>{e.name}</span>
                          <span style={{color:e.color,fontWeight:700}}>{(e.value / 100000).toFixed(1)}L</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>🎯 Investment by Type</div>
                <div style={{fontSize:12,color:"#4B5563",marginBottom:12}}>Account type distribution</div>
                {typePieData.length === 0 ? (
                  <div style={{color:"#4B5563",padding:40,textAlign:"center"}}>No data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie 
                          data={typePieData} 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={95} 
                          paddingAngle={3} 
                          dataKey="value"
                          label={({name, percent}) => `${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {typePieData.map((e, i) => <Cell key={i} fill={e.color} stroke="#111827" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip 
                          formatter={(v: any) => `₹${(v / 100000).toFixed(1)}L`} 
                          contentStyle={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:8,fontSize:12}} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
                      {typePieData.map((e, i) => (
                        <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,background:"#0D1117",padding:"4px 10px",borderRadius:20}}>
                          <div style={{width:9,height:9,borderRadius:"50%",background:e.color}} />
                          <span style={{color:"#D1D5DB"}}>{e.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ROI Comparison */}
            <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>📊 ROI Comparison</div>
              <div style={{fontSize:12,color:"#4B5563",marginBottom:16}}>Average interest rates by bank</div>
              {roiData.length === 0 ? (
                <div style={{color:"#4B5563",padding:20,textAlign:"center"}}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={roiData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="bank" tick={{fill:"#9CA3AF",fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v => v + "%"} />
                    <Tooltip 
                      formatter={(v: any) => `${v}%`}
                      contentStyle={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:8,fontSize:12}} 
                    />
                    <Bar dataKey="roi" name="ROI" radius={[6, 6, 0, 0]}>
                      {roiData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Maturity Cash Flow */}
            <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>📉 Maturity Cash Flow (Lakhs)</div>
              <div style={{fontSize:12,color:"#4B5563",marginBottom:16}}>When money becomes available month by month</div>
              {areaData.length === 0 ? (
                <div style={{color:"#4B5563",padding:20,textAlign:"center"}}>No maturity dates</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="month" tick={{fill:"#9CA3AF",fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v => v + "L"} />
                    <Tooltip 
                      formatter={(v: any) => `₹${v}L`}
                      contentStyle={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:8,fontSize:12}} 
                    />
                    <Area type="monotone" dataKey="amt" stroke="#10B981" strokeWidth={2} fill="url(#colorAmt)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bank Comparison: Invested vs Maturity */}
            <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>💰 Invested vs Maturity</div>
              <div style={{fontSize:12,color:"#4B5563",marginBottom:16}}>Compare principal and maturity amounts by bank</div>
              {bankCompareData.length === 0 ? (
                <div style={{color:"#4B5563",padding:20,textAlign:"center"}}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={bankCompareData} barGap={4} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="bank" tick={{fill:"#9CA3AF",fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v => v + "L"} />
                    <Tooltip 
                      formatter={(v: any) => `₹${v}L`}
                      contentStyle={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:8,fontSize:12}} 
                    />
                    <Legend wrapperStyle={{fontSize:12,color:"#9CA3AF"}} />
                    <Bar dataKey="invested" name="Invested" fill="#3B82F6" radius={[4, 4, 0, 0]} opacity={0.7} />
                    <Bar dataKey="maturity" name="At Maturity" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* ══ TIMELINE TAB ═══════════════════════════════════════════ */}
        {tab === "timeline" && (
          <div>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18,flexWrap:"wrap"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB"}}>📅 Maturity Timeline</div>
              <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:"#9CA3AF"}}>
                  <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} style={{accentColor:"#3B82F6"}} />
                  Show completed
                </label>
              </div>
            </div>

            <div style={{background:"#1C1C2E",borderRadius:16,padding:24,position:"relative"}}>
              <div style={{position:"absolute",left:130,top:24,bottom:24,width:2,background:"#1F2937",zIndex:0}} />
              {sortedDeps.length === 0 && <div style={{textAlign:"center",padding:40,color:"#4B5563"}}>No deposits to show</div>}
              {sortedDeps.filter(d => showDone || !d.done).map((d, i) => {
                const origIdx = deposits.indexOf(d);
                const days = daysUntil(d.maturityDate);
                const isPast = days !== null && days < 0;
                const isDone = d.done;
                const color = getBankColor(d.bank);
                const dotColor = isDone ? "#34D399" : isPast ? "#374151" : color;
                const rowBg = isDone ? "rgba(52,211,153,0.05)" : isPast ? "rgba(55,65,81,0.1)" : days != null && days <= 90 ? "rgba(239,68,68,0.06)" : "transparent";
                
                return (
                  <div key={i} style={{display:"flex",gap:16,marginBottom:14,opacity:isDone ? 0.5 : isPast ? 0.45 : 1,position:"relative",zIndex:1,transition:"opacity 0.3s"}}>
                    <div style={{width:116,textAlign:"right",flexShrink:0,paddingTop:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:isDone ? "#34D399" : isPast ? "#4B5563" : "#9CA3AF"}}>
                        {d.maturityDate ? new Date(d.maturityDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"}
                      </div>
                      <div style={{fontSize:13,fontWeight:800,color:isDone ? "#34D399" : isPast ? "#4B5563" : "#F9FAFB"}}>
                        {d.maturityDate ? new Date(d.maturityDate).getDate() : ""}
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"flex-start",paddingTop:12,flexShrink:0}}>
                      <div style={{width:14,height:14,borderRadius:"50%",background:dotColor,border:`2px solid ${dotColor}`,boxShadow:isDone ? `0 0 10px #34D39960` : isPast ? "none" : `0 0 8px ${color}50`,transition:"all 0.3s"}} />
                    </div>
                    <div style={{flex:1,background:rowBg,border:`1px solid ${isDone ? "#064E3B" : isPast ? "#1F2937" : days != null && days <= 90 ? "#7F1D1D" : "#1F2937"}`,borderRadius:14,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,transition:"all 0.3s"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontWeight:800,color:isDone ? "#6EE7B7" : "#F3F4F6",fontSize:14,textDecoration:isDone ? "line-through" : "none"}}>{d.bank}</span>
                          <span style={{fontSize:11,color:"#6B7280",background:"#0D1117",padding:"2px 8px",borderRadius:20}}>{d.type}</span>
                          {isDone && <span style={{fontSize:11,color:"#34D399",fontWeight:700}}>✓ Done</span>}
                        </div>
                        <div style={{fontSize:12,color:"#6B7280",marginTop:4}}>{d.nominee} {d.roi ? `· ${(Number(d.roi) * 100).toFixed(2)}% pa` : ""} {d.duration ? `· ${d.duration}` : ""}</div>
                        {d.maturityAction && <div style={{fontSize:11,color:"#4B5563",marginTop:3,fontStyle:"italic"}}>{d.maturityAction}</div>}
                        {d.depositId && <div style={{fontSize:10,color:"#374151",marginTop:2,fontFamily:"monospace"}}>{d.depositId}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                        <div style={{fontFamily:"monospace",fontWeight:800,fontSize:15,color:isDone ? "#6B7280" : isPast ? "#6B7280" : "#10B981"}}>{fmt(d.maturityAmt || d.deposit)}</div>
                        {!isDone && <UrgencyBadge days={days} />}
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={() => toggleDone("deposit", origIdx)} style={{background:isDone ? "#064E3B" : "#1C1C2E",color:isDone ? "#34D399" : "#9CA3AF",border:`1px solid ${isDone ? "#065F46" : "#374151"}`,borderRadius:7,padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{isDone ? "↩ Undo" : "✓ Done"}</button>
                          <button onClick={() => openEdit("deposit", origIdx)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ ACTIONS TAB ════════════════════════════════════════════ */}
        {tab === "actions" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB"}}>⚡ Action Items</div>
                <div style={{fontSize:12,color:"#4B5563",marginTop:2}}>Track renewals, visits, calls</div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:"#9CA3AF"}}>
                  <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} style={{accentColor:"#3B82F6"}} />
                  Show completed
                </label>
                <button onClick={() => openAdd("action")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add Action</button>
              </div>
            </div>

            {actions.filter(a => showDone || !a.done).length === 0 ? (
              <div style={{background:"#1C1C2E",borderRadius:12,padding:32,textAlign:"center",color:"#4B5563",border:"1px dashed #374151"}}>
                No action items yet. Click "+ Add Action" to create one.
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                {actions.filter(a => showDone || !a.done).map((a, i) => {
                  const origIdx = actions.indexOf(a);
                  const days = daysUntil(a.date);
                  return (
                    <div key={i} style={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:12,padding:"14px 16px",opacity:a.done ? 0.6 : 1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div style={{fontWeight:700,color:a.done ? "#6B7280" : "#F3F4F6",fontSize:14,textDecoration:a.done ? "line-through" : "none",flex:1}}>{a.title}</div>
                        <button onClick={() => toggleDone("action", origIdx)} style={{background:a.done ? "#064E3B" : "#1C1C2E",color:a.done ? "#34D399" : "#6B7280",border:`1px solid ${a.done ? "#065F46" : "#374151"}`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontWeight:700}}>{a.done ? "↩" : "✓"}</button>
                      </div>
                      {a.bank && <div style={{fontSize:12,color:getBankColor(a.bank),fontWeight:600,marginBottom:4}}>🏦 {a.bank}</div>}
                      {a.note && <div style={{fontSize:12,color:"#9CA3AF",marginBottom:6}}>{a.note}</div>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                        {a.date && <div style={{fontSize:12,color:"#9CA3AF"}}>{fmtDate(a.date)}</div>}
                        {days != null && !a.done && <UrgencyBadge days={days} />}
                        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
                          <button onClick={() => openEdit("action", origIdx)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
                          <button onClick={() => deleteRow("action", origIdx)} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>🗑</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ DEPOSITS TAB ═══════════════════════════════════════════ */}
        {tab === "deposits" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
              <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{...inputSt,width:220}} />
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={() => setFilterBank("All")} style={{background:filterBank === "All" ? "#3B82F6" : "#1C1C2E",color:filterBank === "All" ? "#FFF" : "#9CA3AF",border:`1px solid ${filterBank === "All" ? "#3B82F6" : "#374151"}`,borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>All</button>
                {banks.map(b => (
                  <button key={b} onClick={() => setFilterBank(b)} style={{background:filterBank === b ? getBankColor(b) : "#1C1C2E",color:filterBank === b ? "#FFF" : "#9CA3AF",border:`1px solid ${filterBank === b ? getBankColor(b) : "#374151"}`,borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{b}</button>
                ))}
              </div>
              <button onClick={() => openAdd("deposit")} style={{marginLeft:"auto",background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add</button>
            </div>
            <div style={{background:"#1C1C2E",borderRadius:14,overflow:"hidden"}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#0D1117",borderBottom:"1px solid #374151"}}>
                    {["Bank","Type","Nominee","Invested","ROI","Maturity ₹","Matures","Days",""].map(h => (
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",color:"#6B7280",fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={9} style={{padding:32,textAlign:"center",color:"#4B5563"}}>No records</td></tr>
                    ) : (
                      filtered.map((d, i) => {
                        const origIdx = deposits.indexOf(d);
                        const days = daysUntil(d.maturityDate);
                        return (
                          <tr key={i} style={{borderBottom:"1px solid #1F2937",background:d.done ? "rgba(52,211,153,0.03)" : days != null && days < 0 ? "rgba(55,65,81,0.15)" : days != null && days <= 90 ? "rgba(239,68,68,0.05)" : "transparent",opacity:d.done ? 0.55 : 1}}>
                            <td style={{padding:"10px 12px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <div style={{width:7,height:7,borderRadius:"50%",background:getBankColor(d.bank)}} />
                                <span style={{fontWeight:700,color:"#F3F4F6"}}>{d.bank}</span>
                              </div>
                              <div style={{fontSize:10,color:"#374151",fontFamily:"monospace",marginLeft:13}}>{d.depositId}</div>
                            </td>
                            <td style={{padding:"10px 12px",color:"#9CA3AF"}}>{d.type}</td>
                            <td style={{padding:"10px 12px",color:"#D1D5DB"}}>{d.nominee}</td>
                            <td style={{padding:"10px 12px",fontFamily:"monospace",fontWeight:700,color:"#F9FAFB"}}>{fmt(d.deposit)}</td>
                            <td style={{padding:"10px 12px",fontFamily:"monospace"}}><span style={{color:"#34D399",fontWeight:700}}>{d.roi ? (Number(d.roi) * 100).toFixed(2) + "%" : "—"}</span></td>
                            <td style={{padding:"10px 12px",fontFamily:"monospace",fontWeight:700,color:"#10B981"}}>{fmt(d.maturityAmt || d.deposit)}</td>
                            <td style={{padding:"10px 12px",color:"#D1D5DB",whiteSpace:"nowrap"}}>{fmtDate(d.maturityDate)}</td>
                            <td style={{padding:"10px 12px"}}><UrgencyBadge days={days} /></td>
                            <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
                              <button onClick={() => toggleDone("deposit", origIdx)} style={{background:d.done ? "#064E3B" : "#1C1C2E",color:d.done ? "#34D399" : "#6B7280",border:`1px solid ${d.done ? "#065F46" : "#374151"}`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",marginRight:4,fontWeight:700}}>{d.done ? "↩" : "✓"}</button>
                              <button onClick={() => openEdit("deposit", origIdx)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",marginRight:4}}>✏️</button>
                              <button onClick={() => deleteRow("deposit", origIdx)} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer"}}>🗑</button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:12}}>
              <div style={{background:"#1C1C2E",borderRadius:9,padding:"9px 16px",border:"1px solid #374151",fontSize:12}}>Invested: <strong style={{fontFamily:"monospace",color:"#F9FAFB"}}>{fmt(filtered.reduce((s, d) => s + (Number(d.deposit) || 0), 0))}</strong></div>
              <div style={{background:"#1C1C2E",borderRadius:9,padding:"9px 16px",border:"1px solid #374151",fontSize:12}}>At Maturity: <strong style={{fontFamily:"monospace",color:"#10B981"}}>{fmt(filtered.reduce((s, d) => s + (Number(d.maturityAmt) || Number(d.deposit) || 0), 0))}</strong></div>
            </div>
          </div>
        )}

        {/* ══ ACCOUNTS TAB ═══════════════════════════════════════════ */}
        {tab === "accounts" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <button onClick={() => openAdd("account")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Account</button>
            </div>
            {accounts.length === 0 ? (
              <div style={{textAlign:"center",padding:40,color:"#4B5563"}}>No accounts yet</div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                {accounts.map((acc, i) => {
                  const color = getBankColor(acc.bank);
                  return (
                    <div key={i} style={{background:"#1C1C2E",borderRadius:14,padding:18,border:`1px solid ${color}30`,borderTop:`3px solid ${color}`,opacity:acc.done ? 0.55 : 1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div><div style={{fontSize:14,fontWeight:800,color:acc.done ? "#6B7280" : "#F3F4F6",textDecoration:acc.done ? "line-through" : "none"}}>{acc.bank}</div><div style={{fontSize:11,color,fontWeight:600}}>{acc.type}</div></div>
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={() => toggleDone("account", i)} style={{background:acc.done ? "#064E3B" : "#1C1C2E",color:acc.done ? "#34D399" : "#6B7280",border:`1px solid ${acc.done ? "#065F46" : "#374151"}`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontWeight:700}}>{acc.done ? "↩" : "✓"}</button>
                          <button onClick={() => openEdit("account", i)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:6,padding:"2px 6px",fontSize:11,cursor:"pointer"}}>✏️</button>
                          <button onClick={() => deleteRow("account", i)} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:6,padding:"2px 6px",fontSize:11,cursor:"pointer"}}>🗑</button>
                        </div>
                      </div>
                      {acc.holders && <div style={{fontSize:11,color:"#9CA3AF"}}>👤 {acc.holders}</div>}
                      {acc.amount && <div style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:"#F9FAFB",marginTop:4}}>{fmt(acc.amount)}</div>}
                      {acc.roi && <div style={{fontSize:12,color:"#34D399",marginTop:2}}>{(Number(acc.roi) * 100).toFixed(2)}% pa</div>}
                      {acc.nextAction && <div style={{fontSize:11,color:"#F59E0B",marginTop:6,fontWeight:600}}>⚡ {acc.nextAction}</div>}
                      {acc.detail && <div style={{fontSize:11,color:"#6B7280",marginTop:4}}>{acc.detail}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ BILLS TAB ══════════════════════════════════════════════ */}
        {tab === "bills" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <button onClick={() => openAdd("bill")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Bill</button>
            </div>
            {bills.length === 0 ? (
              <div style={{textAlign:"center",padding:40,color:"#4B5563"}}>No bills yet</div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                {bills.map((bill, i) => (
                  <div key={i} style={{background:"#1C1C2E",borderRadius:12,padding:16,border:"1px solid #374151",opacity:bill.done ? 0.55 : 1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div style={{fontWeight:700,color:bill.done ? "#6B7280" : "#F3F4F6",fontSize:14,textDecoration:bill.done ? "line-through" : "none",flex:1}}>{bill.name}</div>
                      <button onClick={() => toggleDone("bill", i)} style={{background:bill.done ? "#064E3B" : "#1C1C2E",color:bill.done ? "#34D399" : "#6B7280",border:`1px solid ${bill.done ? "#065F46" : "#374151"}`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontWeight:700}}>{bill.done ? "↩" : "✓"}</button>
                    </div>
                    {bill.amount && <div style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:"#F9FAFB",marginBottom:4}}>{fmt(bill.amount)}</div>}
                    <div style={{fontSize:11,color:"#9CA3AF",marginBottom:6}}>{bill.freq} · Due: {bill.due || "—"}</div>
                    <div style={{display:"flex",gap:6,marginTop:8}}>
                      <button onClick={() => openEdit("bill", i)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
                      <button onClick={() => deleteRow("bill", i)} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal for Add/Edit */}
      {modal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#1C1C2E",borderRadius:20,padding:28,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",border:"1px solid #374151"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:22}}>
              <div style={{fontSize:17,fontWeight:800}}>{modal.mode==="add"?"Add":"Edit"} {modal.type}</div>
              <button onClick={()=>setModal(null)} style={{background:"#374151",color:"#9CA3AF",border:"none",borderRadius:8,padding:"3px 12px",cursor:"pointer"}}>✕</button>
            </div>
            {/* Form fields - simplified */}
            <div style={{display:"flex",gap:12,marginTop:22,justifyContent:"flex-end"}}>
              <button onClick={()=>setModal(null)} style={{background:"#374151",color:"#9CA3AF",border:"none",borderRadius:10,padding:"9px 18px",cursor:"pointer"}}>Cancel</button>
              <button onClick={saveModal} style={{background:"linear-gradient(135deg,#1D4ED8,#2563EB)",color:"#fff",border:"none",borderRadius:10,padding:"9px 22px",cursor:"pointer"}}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
