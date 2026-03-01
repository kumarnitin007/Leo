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
import { Deposit, BankAccount, Bill, ActionItem, BankRecordsData, SavingsGoal, Currency, DepositCategory } from '../types/bankRecords';
import { updateFinancialAlertsCache, FinancialAlertsSummary } from './FinancialAlertsWidget';
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

const CURRENCY_SYMBOLS: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
const CURRENCY_LOCALES: Record<Currency, string> = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };

function fmt(n: number | string | null | undefined, currency: Currency = 'INR'): string {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const sym = CURRENCY_SYMBOLS[currency];
  
  if (currency === 'INR') {
    if (abs >= 10000000) return sign + sym + (abs/10000000).toFixed(2) + " Cr";
    if (abs >= 100000)  return sign + sym + (abs/100000).toFixed(2) + " L";
    if (abs >= 1000) return sign + sym + (abs/1000).toFixed(2) + " K";
  } else {
    if (abs >= 1000000000) return sign + sym + (abs/1000000000).toFixed(2) + "B";
    if (abs >= 1000000) return sign + sym + (abs/1000000).toFixed(2) + "M";
    if (abs >= 1000) return sign + sym + (abs/1000).toFixed(1) + "K";
  }
  return sign + sym + abs.toLocaleString(CURRENCY_LOCALES[currency], { maximumFractionDigits: 2 });
}

function fmtFull(n: number | string | null | undefined, currency: Currency = 'INR'): string {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return sign + CURRENCY_SYMBOLS[currency] + abs.toLocaleString(CURRENCY_LOCALES[currency], { maximumFractionDigits: 2 });
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
  const bs = (bg: string, color: string) => ({ background:bg, color, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:"nowrap" as const });
  if (days === null) return <span style={bs("#1F2937","#6B7280")}>No Date</span>;
  if (days < 0)   return <span style={bs("#1F2937","#4B5563")}>Matured</span>;
  if (days === 0) return <span style={bs("#7F1D1D","#FCA5A5")}>TODAY!</span>;
  if (days <= 30) return <span style={bs("#7F1D1D","#FCA5A5")}>🔴 {days}d</span>;
  if (days <= 90) return <span style={bs("#78350F","#FCD34D")}>🟡 {days}d</span>;
  if (days <= 180) return <span style={bs("#064E3B","#6EE7B7")}>🟢 {days}d</span>;
  return <span style={bs("#1E3A5F","#93C5FD")}>{days}d</span>;
}

const emptyDeposit: Deposit  = { bank:"", type:"Fixed Deposit", depositId:"", nominee:"", startDate:"", deposit:"", roi:"", maturityAmt:"", maturityDate:"", duration:"", maturityAction:"", done:false, currency:"INR", category:"General Savings", tdsPercent:"", autoRenewal:false, linkedAccount:"", notes:"" };
const emptyAccount: BankAccount  = { bank:"", type:"Saving", holders:"", amount:"", roi:"", online:"Yes", address:"", detail:"", nextAction:"", done:false, currency:"INR", accountNumber:"", ifscCode:"", branch:"" };
const emptyBill: Bill     = { name:"", freq:"Monthly", amount:"", due:"", priority:"Normal", phone:"", email:"", done:false, currency:"INR", category:"", autoPay:false };
const emptyAction: ActionItem   = { title:"", bank:"", date:"", note:"", done:false, priority:"Medium", reminderDays:[7,1] };
const emptyGoal: SavingsGoal = { id:"", name:"", targetAmount:0, currency:"INR", currentAmount:0, deadline:"", category:"General Savings", linkedDeposits:[], color:"#3B82F6", notes:"", createdAt:"", done:false };

const CATEGORIES: DepositCategory[] = ['Emergency Fund', 'Retirement', 'Child Education', 'House/Property', 'Vehicle', 'Wedding', 'Travel', 'General Savings', 'Tax Saving', 'Other'];
const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP'];

// Empty State Component
function EmptyState({ icon, title, description, action, onAction }: { icon: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{textAlign:"center",padding:"48px 24px",background:"#161B22",borderRadius:12,border:"1px solid #30363D"}}>
      <div style={{fontSize:48,marginBottom:12,opacity:0.6}}>{icon}</div>
      <div style={{fontSize:16,fontWeight:600,color:"#F0F6FC",marginBottom:6}}>{title}</div>
      <div style={{fontSize:13,color:"#8B949E",marginBottom:action?16:0,maxWidth:280,margin:"0 auto"}}>{description}</div>
      {action && onAction && (
        <button onClick={onAction} style={{background:"#238636",color:"#fff",border:"none",borderRadius:6,padding:"8px 20px",fontSize:12,fontWeight:600,cursor:"pointer",marginTop:16}}>{action}</button>
      )}
    </div>
  );
}

const inputSt: React.CSSProperties = { background:"#0D1117", border:"1px solid #374151", color:"#F9FAFB", borderRadius:8, padding:"8px 12px", fontSize:13, width:"100%", fontFamily:"inherit", outline:"none", boxSizing:"border-box", colorScheme:"dark" };
const labelSt: React.CSSProperties = { fontSize:11, color:"#9CA3AF", fontWeight:600, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 };

// ─── Main Component ──────────────────────────────────────────────────────────
export default function BankDashboard({ supabase, userId, encryptionKey }: BankDashboardProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState(false);
  const [modal, setModal] = useState<{type: string; mode: string; idx?: number} | null>(null);
  const [form, setForm] = useState<any>({});
  const [filterBank, setFilterBank] = useState("All");
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(false);
  const [show30Days, setShow30Days] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Responsive detection ───────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modal) return; // Don't trigger shortcuts when modal is open
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch(e.key.toLowerCase()) {
        case 'n': // New item based on current tab
          e.preventDefault();
          if (tab === 'deposits') openAdd('deposit');
          else if (tab === 'accounts') openAdd('account');
          else if (tab === 'bills') openAdd('bill');
          else if (tab === 'actions') openAdd('action');
          break;
        case '1': setTab('overview'); break;
        case '2': setTab('charts'); break;
        case '3': setTab('timeline'); break;
        case '4': setTab('actions'); break;
        case '5': setTab('deposits'); break;
        case '6': setTab('accounts'); break;
        case '7': setTab('bills'); break;
        case '/': e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tab, modal]);

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
          // Start with empty data - user imports their own Excel
          setDeposits([]);
          setAccounts([]);
          setBills([]);
          setActions([]);
        } else if (data?.data) {
          // Decrypt the data - parse the stored JSON containing encrypted data and IV
          try {
            const { encrypted, iv } = JSON.parse(data.data);
            const decrypted = await decryptData(encrypted, iv, encryptionKey);
            const parsed: BankRecordsData = JSON.parse(decrypted);
            setDeposits(parsed.deposits || []);
            setAccounts(parsed.accounts || []);
            setBills(parsed.bills || []);
            setActions(parsed.actions || []);
            setGoals(parsed.goals || []);
            console.log('[BankDashboard] ✅ Loaded data from Supabase');
          } catch (decryptError) {
            console.error('[BankDashboard] Decryption error:', decryptError);
            // Clear corrupt data from database and start fresh
            console.warn('[BankDashboard] ⚠️ Data corrupted, clearing and starting fresh...');
            await supabase.from('myday_bank_records').delete().eq('user_id', userId);
            alert('Bank data was corrupted (possibly due to encryption key change). Data has been cleared. Please re-import your Excel file.');
            setDeposits([]);
            setAccounts([]);
            setBills([]);
            setActions([]);
          }
        } else {
          // No data yet — start empty (this is normal after clearing or first use)
          console.log('[BankDashboard] 📊 No data found, starting empty');
          setDeposits([]);
          setAccounts([]);
          setBills([]);
          setActions([]);
        }
      } else {
        // No Supabase/encryption — start empty
        console.log('[BankDashboard] 💾 No database connection, starting empty');
        setShowSetupBanner(true);
        setDeposits([]);
        setAccounts([]);
        setBills([]);
        setActions([]);
      }
    } catch (e) {
      console.error('[BankDashboard] Load error:', e);
      // Start empty on error
      setShowSetupBanner(true);
      setDeposits([]);
      setAccounts([]);
      setBills([]);
      setActions([]);
    }
    setLoading(false);
  }

  // Update home page cache whenever data changes
  useEffect(() => {
    if (loading) return;
    
    // ALL totals from Accounts sheet ONLY
    const accountBalance = accounts.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const fdTotal = accounts.filter(a => a.type === "FD").reduce((s,a)=>s+(Number(a.amount)||0),0);
    // Estimate FD maturity using ROI (1-year projection)
    const fdMaturityEst = accounts.filter(a => a.type === "FD").reduce((s,a) => {
      const principal = Number(a.amount) || 0;
      const roi = Number(a.roi) || 0.07;
      return s + principal * (1 + roi);
    }, 0);
    const totalInvested = fdTotal; // FDs from accounts
    const totalMaturity = fdMaturityEst; // Estimated maturity
    
    // Generate alerts - same logic as "Next 30 Days" section
    const alertsList: FinancialAlertsSummary['alerts'] = [];
    let urgentCount = 0, warningCount = 0;
    
    // Deposits maturing in 30 days
    deposits.forEach(d => {
      if (d.done) return;
      const days = daysUntil(d.maturityDate);
      if (days !== null && days >= 0 && days <= 30) {
        const severity = days <= 7 ? 'urgent' : days <= 14 ? 'warning' : 'info';
        if (severity === 'urgent') urgentCount++;
        if (severity === 'warning') warningCount++;
        alertsList.push({
          title: `${d.bank} FD Maturing`,
          description: fmt(Number(d.maturityAmt)||Number(d.deposit), d.currency),
          daysUntil: days,
          severity,
          type: 'maturity'
        });
      }
    });
    
    // Account next actions (like "Check Mama DOB")
    accounts.forEach(a => {
      if (a.done || !a.nextAction) return;
      alertsList.push({
        title: a.nextAction,
        description: a.bank,
        daysUntil: -1,
        severity: 'info',
        type: 'action'
      });
    });
    
    // Manual actions with dates
    actions.forEach(a => {
      if (a.done) return;
      const days = daysUntil(a.date);
      if (days !== null && days >= 0 && days <= 30) {
        const severity = days <= 3 ? 'urgent' : days <= 7 ? 'warning' : 'info';
        if (severity === 'urgent') urgentCount++;
        if (severity === 'warning') warningCount++;
        alertsList.push({
          title: a.title,
          description: a.bank || a.note || '',
          daysUntil: days,
          severity,
          type: 'action'
        });
      } else if (!a.date) {
        alertsList.push({
          title: a.title,
          description: a.bank || a.note || '',
          daysUntil: -1,
          severity: 'info',
          type: 'action'
        });
      }
    });
    
    // Bills due (Pay Airtel, Pay Jio, etc.)
    bills.forEach(b => {
      if (b.done) return;
      alertsList.push({
        title: `Pay ${b.name}`,
        description: b.amount ? fmt(Number(b.amount), b.currency) : b.due || '',
        daysUntil: -1,
        severity: b.priority === 'High' || b.priority === 'Urgent' ? 'warning' : 'info',
        type: 'bill'
      });
      if (b.priority === 'High' || b.priority === 'Urgent') warningCount++;
    });
    
    // Sort: urgent first, then warning, then by days (dated items first, undated last)
    alertsList.sort((a, b) => {
      const sevOrder = { urgent: 0, warning: 1, info: 2 };
      const sevDiff = sevOrder[a.severity] - sevOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      // Dated items before undated
      if (a.daysUntil === -1 && b.daysUntil === -1) return 0;
      if (a.daysUntil === -1) return 1;
      if (b.daysUntil === -1) return -1;
      return a.daysUntil - b.daysUntil;
    });
    
    const summary: FinancialAlertsSummary = {
      updatedAt: new Date().toISOString(),
      netWorth: accountBalance, // Accounts already includes FDs, don't double count
      totalInvested,
      totalMaturity,
      gainPercent: totalInvested > 0 ? ((totalMaturity - totalInvested) / totalInvested) * 100 : 0,
      upcomingMaturities: deposits.filter(d => { const x = daysUntil(d.maturityDate); return x !== null && x >= 0 && x <= 30 && !d.done; }).length,
      urgentCount,
      warningCount,
      pendingBills: bills.filter(b => !b.done).length,
      pendingActions: actions.filter(a => !a.done).length,
      alerts: alertsList.slice(0, 10)
    };
    
    updateFinancialAlertsCache(summary);
  }, [loading, deposits, accounts, bills, actions]);

  async function persist(deps: Deposit[], accs: BankAccount[], bls: Bill[], acts: ActionItem[], gls?: SavingsGoal[]) {
    const payload: BankRecordsData = { deposits: deps, accounts: accs, bills: bls, actions: acts, goals: gls || goals, updatedAt: new Date().toISOString(), version: 1 };
    try {
      if (supabase && userId && encryptionKey) {
        // Encrypt before saving - store both encrypted data and IV as JSON
        const { encrypted, iv } = await encryptData(JSON.stringify(payload), encryptionKey);
        const encryptedPayload = JSON.stringify({ encrypted, iv });
        await supabase
          .from('myday_bank_records')
          .upsert(
            { user_id: userId, data: encryptedPayload, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
      }
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (e) {
      console.error('BankDashboard save error:', e);
    }
  }

  function save(deps: Deposit[], accs: BankAccount[], bls: Bill[], acts: ActionItem[], gls?: SavingsGoal[]) {
    setDeposits(deps); setAccounts(accs); setBills(bls); setActions(acts);
    if (gls !== undefined) setGoals(gls);
    persist(deps, accs, bls, acts, gls);
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
          // Exact match first, then partial match
          const col = (n: string, exact = false) => {
            const nLower = n.toLowerCase();
            // Try exact match first
            const exactIdx = h.findIndex((x: any) => x && x.toString().toLowerCase().trim() === nLower);
            if (exactIdx >= 0) return exactIdx;
            // Fall back to partial match (but not for "Deposit" to avoid matching "Deposit ID")
            if (exact) return -1;
            return h.findIndex((x: any) => x && x.toString().toLowerCase().includes(nLower));
          };
          const [cB, cT, cI, cN, cS, cR, cM, cMD, cDu, cA] = [
            col("Bank"), col("Type"), col("Deposit ID"), col("Nominee"), 
            col("Start"), col("ROI"), col("Maturity Amount"), 
            col("Maturity Date"), col("Duration"), col("Maturity")
          ];
          // For "Deposit" (amount), find column that is exactly "Deposit" or contains "Deposit" but NOT "Deposit ID"
          const cD = h.findIndex((x: any) => {
            if (!x) return false;
            const s = x.toString().toLowerCase().trim();
            return s === "deposit" || (s.includes("deposit") && !s.includes("id"));
          });
          
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
    const today = new Date().toISOString().split('T')[0];
    const empty = type==="deposit"?{...emptyDeposit, startDate: today}:type==="account"?emptyAccount:type==="bill"?emptyBill:emptyAction;
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

  async function handleClearAll() {
    const summary = `🗑 Clear ALL financial data?\n\nThis will delete:\n• ${deposits.length} deposits\n• ${accounts.length} accounts\n• ${bills.length} bills\n• ${actions.length} actions\n\nThis cannot be undone!`;
    if (!confirm(summary)) return;
    
    try {
      // Clear from Supabase
      if (supabase && userId) {
        await supabase
          .from('myday_bank_records')
          .delete()
          .eq('user_id', userId);
        console.log('[BankDashboard] ✅ Cleared data from Supabase');
      }
      
      // Clear local state
      setDeposits([]);
      setAccounts([]);
      setBills([]);
      setActions([]);
      
      alert('✅ All data cleared! You can now import fresh data.');
    } catch (e) {
      console.error('[BankDashboard] Clear failed:', e);
      alert('❌ Failed to clear data');
    }
  }

  function handleExportPDF() {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bank Records Report - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #1a1a1a; border-bottom: 2px solid #3B82F6; padding-bottom: 10px; }
          h2 { color: #374151; margin-top: 24px; }
          .summary { display: flex; gap: 20px; margin: 20px 0; }
          .summary-card { background: #f3f4f6; padding: 16px 20px; border-radius: 8px; border-left: 4px solid #3B82F6; }
          .summary-card.green { border-left-color: #10B981; }
          .summary-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
          .summary-value { font-size: 24px; font-weight: 700; color: #1a1a1a; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
          th { background: #f9fafb; padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600; }
          td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
          .urgent { color: #dc2626; font-weight: 600; }
          .matured { color: #6b7280; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>🦁 Bank Records Report</h1>
        <p style="color:#6b7280;">Generated: ${new Date().toLocaleString()}</p>
        
        <div class="summary">
          <div class="summary-card">
            <div class="summary-label">Total Invested</div>
            <div class="summary-value">${fmt(deposits.reduce((s,d)=>s+(Number(d.deposit)||0),0))}</div>
          </div>
          <div class="summary-card green">
            <div class="summary-label">At Maturity</div>
            <div class="summary-value">${fmt(deposits.reduce((s,d)=>s+(Number(d.maturityAmt)||Number(d.deposit)||0),0))}</div>
          </div>
        </div>

        <h2>💰 Deposits (${deposits.length})</h2>
        <table>
          <thead><tr><th>Bank</th><th>Type</th><th>Nominee</th><th>Invested</th><th>ROI</th><th>Maturity</th><th>Matures</th><th>Days</th></tr></thead>
          <tbody>
            ${deposits.map(d => {
              const days = daysUntil(d.maturityDate);
              return `<tr>
                <td><strong>${d.bank}</strong><br><small style="color:#9ca3af">${d.depositId||''}</small></td>
                <td>${d.type}</td>
                <td>${d.nominee}</td>
                <td>${fmt(d.deposit)}</td>
                <td>${d.roi ? (Number(d.roi)*100).toFixed(2)+'%' : '—'}</td>
                <td>${fmt(d.maturityAmt||d.deposit)}</td>
                <td>${fmtDate(d.maturityDate)}</td>
                <td class="${days!==null && days<0 ? 'matured' : days!==null && days<=30 ? 'urgent' : ''}">${days!==null ? (days<0?'Matured':days+'d') : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <h2>🏦 Accounts (${accounts.length})</h2>
        <table>
          <thead><tr><th>Bank</th><th>Type</th><th>Holders</th><th>Balance</th><th>ROI</th><th>Next Action</th></tr></thead>
          <tbody>
            ${accounts.map(a => `<tr>
              <td><strong>${a.bank}</strong></td>
              <td>${a.type}</td>
              <td>${a.holders}</td>
              <td>${fmt(a.amount)}</td>
              <td>${a.roi ? (Number(a.roi)*100).toFixed(2)+'%' : '—'}</td>
              <td>${a.nextAction||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>

        <h2>📋 Bills (${bills.length})</h2>
        <table>
          <thead><tr><th>Name</th><th>Frequency</th><th>Amount</th><th>Due</th><th>Priority</th></tr></thead>
          <tbody>
            ${bills.map(b => `<tr>
              <td><strong>${b.name}</strong></td>
              <td>${b.freq}</td>
              <td>${fmt(b.amount)}</td>
              <td>${b.due||'—'}</td>
              <td>${b.priority||'Normal'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  function saveModal() {
    const {type,mode,idx}=modal!;
    if(type==="deposit"){ const d=[...deposits]; mode==="add"?d.push(form):d[idx!]=form; save(d,accounts,bills,actions); }
    else if(type==="account"){ const a=[...accounts]; mode==="add"?a.push(form):a[idx!]=form; save(deposits,a,bills,actions); }
    else if(type==="bill"){ const b=[...bills]; mode==="add"?b.push(form):b[idx!]=form; save(deposits,accounts,b,actions); }
    else if(type==="goal"){ const g=[...goals]; mode==="add"?g.push(form):g[idx!]=form; save(deposits,accounts,bills,actions,g); }
    else { const ac=[...actions]; mode==="add"?ac.push(form):ac[idx!]=form; save(deposits,accounts,bills,ac); }
    setModal(null);
  }

  function toggleDone(type: string, idx: number) {
    if(type==="deposit"){ const d=[...deposits]; d[idx]={...d[idx],done:!d[idx].done}; save(d,accounts,bills,actions); }
    else if(type==="account"){ const a=[...accounts]; a[idx]={...a[idx],done:!a[idx].done}; save(deposits,a,bills,actions); }
    else if(type==="bill"){ const b=[...bills]; b[idx]={...b[idx],done:!b[idx].done}; save(deposits,accounts,b,actions); }
    else { const ac=[...actions]; ac[idx]={...ac[idx],done:!ac[idx].done}; save(deposits,accounts,bills,ac); }
  }

  // ── Derived Data (FROM ACCOUNTS ONLY) ───────────────────────────────────
  const totalInvested = accounts.filter(a => a.type === "FD").reduce((s,a)=>s+(Number(a.amount)||0),0);
  const totalMaturity = accounts.filter(a => a.type === "FD").reduce((s,a) => {
    const principal = Number(a.amount) || 0;
    const roi = Number(a.roi) || 0.07;
    return s + principal * (1 + roi);
  }, 0);
  
  // Deposits are ONLY for maturity tracking/alerts
  const upcoming90 = deposits.filter(d=>{ const x=daysUntil(d.maturityDate); return x!=null&&x>=0&&x<=90&&!d.done; });
  const sortedDeps = [...deposits].sort((a,b)=>new Date(a.maturityDate||"2099").getTime()-new Date(b.maturityDate||"2099").getTime());

  // Bank totals from deposits (for deposits tab only)
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
    {id:"overview",  icon:"📊", label:"Overview", key:"1"},
    {id:"networth",  icon:"💎", label:"Net Worth", key:"2"},
    {id:"goals",     icon:"🎯", label:"Goals", key:"3"},
    {id:"timeline",  icon:"📅", label:"Timeline", key:"4"},
    {id:"deposits",  icon:"💰", label:"Deposits", key:"5"},
    {id:"accounts",  icon:"🏦", label:"Accounts", key:"6"},
    {id:"bills",     icon:"📋", label:"Bills", key:"7"},
    {id:"actions",   icon:"⚡", label:"Actions", key:"8"},
    {id:"charts",    icon:"📈", label:"Charts", key:"9"},
  ];
  
  const banks = Array.from(new Set(deposits.map(d => d.bank).filter(Boolean)));
  const filtered = deposits.filter(d => {
    if (filterBank && filterBank !== "All" && d.bank !== filterBank) return false;
    if (search && !`${d.bank} ${d.nominee} ${d.depositId}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Upcoming 30-day actions ─────────────────────────────────────────────
  const upcoming30Days: Array<{type:string; title:string; bank:string; date:string; days:number; amount?:string}> = [];
  
  // Deposits maturing in 30 days
  deposits.forEach(d => {
    if (d.done) return;
    const days = daysUntil(d.maturityDate);
    if (days !== null && days >= 0 && days <= 30) {
      upcoming30Days.push({ type:"maturity", title:`${d.type || "FD"} matures`, bank:d.bank, date:d.maturityDate, days, amount:String(d.maturityAmt) });
    }
  });
  
  // Account next actions
  accounts.forEach(a => {
    if (a.done || !a.nextAction) return;
    upcoming30Days.push({ type:"account", title:a.nextAction, bank:a.bank, date:"", days:-1 });
  });
  
  // Manual actions with dates in next 30 days
  actions.forEach(a => {
    if (a.done) return;
    const days = daysUntil(a.date);
    if (days !== null && days >= 0 && days <= 30) {
      upcoming30Days.push({ type:"action", title:a.title, bank:a.bank||"", date:a.date, days });
    } else if (!a.date) {
      upcoming30Days.push({ type:"action", title:a.title, bank:a.bank||"", date:"", days:-1 });
    }
  });
  
  // Bills due
  bills.forEach(b => {
    if (b.done) return;
    upcoming30Days.push({ type:"bill", title:`Pay ${b.name}`, bank:"", date:b.due||"", days:-1, amount:String(b.amount) });
  });
  
  // Sort by days (undated last)
  upcoming30Days.sort((a, b) => {
    if (a.days === -1 && b.days === -1) return 0;
    if (a.days === -1) return 1;
    if (b.days === -1) return -1;
    return a.days - b.days;
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
            <strong style={{color:"#FCA5A5",display:"block",marginBottom:4}}>Database Connection Issue</strong>
            <div style={{color:"#FCA5A5",fontSize:13}}>
              Unable to connect to database. Run <code style={{background:"rgba(0,0,0,0.3)",padding:"2px 6px",borderRadius:4}}>supabase-bank-records.sql</code> in Supabase SQL Editor if not done already.
            </div>
          </div>
          <button onClick={()=>setShowSetupBanner(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#FCA5A5",padding:"4px 12px",borderRadius:6,cursor:"pointer",fontSize:20}}>✕</button>
        </div>
      )}

      {/* Header - Bank Records title and buttons */}
      <div style={{background:"#161B22",borderBottom:"1px solid #21262D",padding:"12px 16px"}}>
        {/* Title Row */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>🦁</span>
            <div style={{fontSize:15,fontWeight:700,color:"#F9FAFB"}}>Bank Records</div>
            {savedMsg && <span style={{color:"#34D399",fontSize:11,fontWeight:600}}>✓ Saved</span>}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>fileRef.current?.click()} style={{background:"#238636",color:"#fff",border:"none",borderRadius:6,padding:"6px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}} title="Import Excel">📂{!isMobile && " Import"}</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleExcel(e.target.files[0]);e.target.value="";}} />
            <button onClick={handleExportPDF} style={{background:"#21262D",color:"#58A6FF",border:"1px solid #30363D",borderRadius:6,padding:"6px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}} title="Export PDF">📄{!isMobile && " PDF"}</button>
            <button onClick={handleClearAll} style={{background:"#21262D",color:"#F85149",border:"1px solid #30363D",borderRadius:6,padding:"6px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}} title="Clear All">🗑</button>
          </div>
        </div>
        {/* Tabs - Icons on mobile, full labels on desktop */}
        <div style={{display:"flex",gap:isMobile?4:8,overflowX:"auto",paddingBottom:8,WebkitOverflowScrolling:"touch",scrollbarWidth:"thin",scrollbarColor:"#30363D #161B22"}}>
          {allTabs.map(t=>(
            <button 
              key={t.id} 
              onClick={()=>setTab(t.id)} 
              title={isMobile ? `${t.label} (${t.key})` : `Press ${t.key}`}
              style={{
                background:tab===t.id?"#1F6FEB":"#21262D",
                color:tab===t.id?"#FFFFFF":"#8B949E",
                border:"none",
                padding:isMobile?"8px 10px":"7px 12px",
                borderRadius:20,cursor:"pointer",
                fontSize:isMobile?14:11,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap",
                flexShrink:0,
                minWidth:isMobile?40:"auto",
                display:"flex",alignItems:"center",justifyContent:"center",gap:4
              }}
            >
              <span>{t.icon}</span>
              {!isMobile && <span>{t.label}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:isMobile?"16px":"22px 28px"}}>
        {/* Tab Content */}
        {tab==="overview" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Quick Stats Row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:8}}>
              <div style={{background:"#0D1117",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid #1F2937"}}>
                <div style={{fontSize:20,fontWeight:800,color:"#3B82F6"}}>{deposits.length}</div>
                <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",fontWeight:600}}>Deposits</div>
              </div>
              <div style={{background:"#0D1117",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid #1F2937"}}>
                <div style={{fontSize:20,fontWeight:800,color:"#10B981"}}>{accounts.length}</div>
                <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",fontWeight:600}}>Accounts</div>
              </div>
              <div style={{background:"#0D1117",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid #1F2937"}}>
                <div style={{fontSize:20,fontWeight:800,color:"#F59E0B"}}>{bills.filter(b=>!b.done).length}</div>
                <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",fontWeight:600}}>Bills Due</div>
              </div>
              <div style={{background:"#0D1117",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid #1F2937"}}>
                <div style={{fontSize:20,fontWeight:800,color:upcoming30Days.length>0?"#EF4444":"#4B5563"}}>{upcoming30Days.length}</div>
                <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",fontWeight:600}}>Actions</div>
              </div>
            </div>

            {/* Account Summary - From Accounts/Banks sheet ONLY */}
            {(() => {
              const accountTotal = accounts.reduce((s, a) => s + (Number(a.amount) || 0), 0);
              const fdTotal = accounts.filter(a => a.type === "FD").reduce((s, a) => s + (Number(a.amount) || 0), 0);
              const savingsTotal = accounts.filter(a => a.type === "Saving").reduce((s, a) => s + (Number(a.amount) || 0), 0);
              const otherTotal = accountTotal - fdTotal - savingsTotal;
              
              // Bank-wise from accounts
              const accountsByBank: Record<string, number> = {};
              accounts.forEach(a => {
                accountsByBank[a.bank] = (accountsByBank[a.bank] || 0) + (Number(a.amount) || 0);
              });
              
              return (
                <div style={{background:"#0D1117",borderRadius:12,padding:"12px 14px",border:"1px solid #1F2937"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:10,color:"#6B7280",fontWeight:600,textTransform:"uppercase"}}>Total Balance</div>
                      <div style={{fontSize:18,fontWeight:800,color:"#F9FAFB",fontFamily:"monospace"}}>{fmt(accountTotal)}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10,color:"#6B7280",fontWeight:600,textTransform:"uppercase"}}>FDs</div>
                      <div style={{fontSize:18,fontWeight:800,color:"#3B82F6",fontFamily:"monospace"}}>{fmt(fdTotal)}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10,color:"#6B7280",fontWeight:600,textTransform:"uppercase"}}>Savings</div>
                      <div style={{fontSize:18,fontWeight:800,color:"#10B981",fontFamily:"monospace"}}>{fmt(savingsTotal)}</div>
                    </div>
                  </div>
                  
                  {/* Progress bar showing FD vs Savings */}
                  {accountTotal > 0 && (
                    <div style={{marginTop:10,display:"flex",gap:2}}>
                      <div style={{width:`${(fdTotal/accountTotal)*100}%`,height:6,background:"#3B82F6",borderRadius:"4px 0 0 4px"}} title={`FDs: ${((fdTotal/accountTotal)*100).toFixed(0)}%`}/>
                      <div style={{width:`${(savingsTotal/accountTotal)*100}%`,height:6,background:"#10B981"}} title={`Savings: ${((savingsTotal/accountTotal)*100).toFixed(0)}%`}/>
                      {otherTotal > 0 && <div style={{width:`${(otherTotal/accountTotal)*100}%`,height:6,background:"#8B5CF6",borderRadius:"0 4px 4px 0"}} title={`Other: ${((otherTotal/accountTotal)*100).toFixed(0)}%`}/>}
                    </div>
                  )}
                  
                  {/* Bank-wise breakdown from Accounts */}
                  <div style={{marginTop:12,borderTop:"1px solid #21262D",paddingTop:10}}>
                    <div style={{fontSize:10,color:"#6B7280",marginBottom:6,fontWeight:600}}>📊 BY BANK (from Accounts):</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:150,overflowY:"auto"}}>
                      {Object.entries(accountsByBank).sort((a,b) => b[1] - a[1]).map(([bank, amt]) => (
                        <div key={bank} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 8px",background:"#161B22",borderRadius:4}}>
                          <span style={{color:"#9CA3AF"}}>{bank}</span>
                          <span style={{fontFamily:"monospace",color:"#F9FAFB"}}>{fmt(amt)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:8,fontSize:10,color:"#6B7280",fontStyle:"italic"}}>
                      Source: Banks/Accounts sheet • {accounts.length} accounts
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Next 30 Days - Collapsible */}
            {upcoming30Days.length > 0 && (
              <div style={{background:"#0D1117",borderRadius:12,border:"1px solid #1F2937",overflow:"hidden"}}>
                <button 
                  onClick={()=>setShow30Days(!show30Days)} 
                  style={{width:"100%",padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                >
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:show30Days?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                    <span style={{fontSize:11,fontWeight:700,color:"#F59E0B",textTransform:"uppercase"}}>⚡ Next 30 Days</span>
                  </div>
                  <div style={{fontSize:10,color:"#6B7280",background:"#21262D",padding:"2px 8px",borderRadius:10}}>{upcoming30Days.length}</div>
                </button>
                {show30Days && (
                  <div style={{maxHeight:220,overflowY:"auto",borderTop:"1px solid #1F2937"}}>
                    {upcoming30Days.slice(0, 5).map((item, i) => (
                      <div key={i} style={{padding:"10px 14px",borderBottom:i<Math.min(4,upcoming30Days.length-1)?"1px solid #1F2937":"none",display:"flex",alignItems:"center",gap:10}}>
                        <div style={{
                          width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
                          background: item.type==="maturity"?"rgba(239,68,68,0.15)":item.type==="bill"?"rgba(245,158,11,0.15)":"rgba(59,130,246,0.15)",
                          color: item.type==="maturity"?"#EF4444":item.type==="bill"?"#F59E0B":"#3B82F6"
                        }}>
                          {item.type==="maturity"?"💰":item.type==="bill"?"📋":item.type==="account"?"🏦":"⚡"}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:"#F9FAFB",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.title}</div>
                          <div style={{fontSize:10,color:"#6B7280"}}>{item.bank}{item.bank && item.amount ? " · " : ""}{item.amount ? fmt(Number(item.amount)) : ""}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          {item.days >= 0 ? (
                            <>
                              <div style={{fontSize:14,fontWeight:800,color:item.days<=7?"#EF4444":item.days<=14?"#F59E0B":"#10B981"}}>{item.days}</div>
                              <div style={{fontSize:9,color:"#6B7280"}}>days</div>
                            </>
                          ) : (
                            <div style={{fontSize:10,color:"#6B7280"}}>{item.date || "No date"}</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {upcoming30Days.length > 5 && (
                      <div style={{padding:"8px 14px",textAlign:"center",fontSize:11,color:"#6B7280",background:"#161B22"}}>
                        +{upcoming30Days.length - 5} more actions
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {upcoming30Days.length === 0 && (
              <div style={{background:"#0D1117",borderRadius:12,padding:"16px",textAlign:"center",border:"1px solid #1F2937"}}>
                <div style={{fontSize:24,marginBottom:6}}>✅</div>
                <div style={{fontSize:12,color:"#10B981",fontWeight:600}}>All Clear!</div>
                <div style={{fontSize:11,color:"#6B7280"}}>No actions needed in the next 30 days</div>
              </div>
            )}

            {/* Overview Cards - FROM ACCOUNTS DATA */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <div style={{background:"#1C1C2E",borderRadius:14,padding:"16px 20px",borderLeft:"3px solid #3B82F6",flex:1,minWidth:140}}>
                <div style={{color:"#6B7280",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>FD Invested</div>
                <div style={{color:"#F9FAFB",fontSize:20,fontWeight:800,fontFamily:"monospace",marginTop:6}}>{fmt(totalInvested)}</div>
                <div style={{color:"#4B5563",fontSize:11,marginTop:4}}>{accounts.filter(a=>a.type==="FD").length} FDs</div>
              </div>
              <div style={{background:"#1C1C2E",borderRadius:14,padding:"16px 20px",borderLeft:"3px solid #10B981",flex:1,minWidth:140}}>
                <div style={{color:"#6B7280",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Est. Maturity</div>
                <div style={{color:"#F9FAFB",fontSize:20,fontWeight:800,fontFamily:"monospace",marginTop:6}}>{fmt(totalMaturity)}</div>
                <div style={{color:"#4B5563",fontSize:11,marginTop:4}}>~1 yr projection</div>
              </div>
              <div style={{background:"#1C1C2E",borderRadius:14,padding:"16px 20px",borderLeft:"3px solid #F59E0B",flex:1,minWidth:140}}>
                <div style={{color:"#6B7280",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Est. Gain</div>
                <div style={{color:"#F9FAFB",fontSize:20,fontWeight:800,fontFamily:"monospace",marginTop:6}}>{fmt(totalMaturity-totalInvested)}</div>
                <div style={{color:"#4B5563",fontSize:11,marginTop:4}}>{totalInvested?`+${(((totalMaturity-totalInvested)/totalInvested)*100).toFixed(1)}%`:""}</div>
              </div>
            </div>
          </div>
        )}

        {/* ══ NET WORTH TAB ═══════════════════════════════════════════════ */}
        {tab === "networth" && (() => {
          // ALL calculations from Accounts sheet ONLY
          const netWorth = accounts.reduce((s, a) => s + (Number(a.amount) || 0), 0);
          
          // Projected: Estimate FD growth using ROI from accounts (assume 1 year average)
          const fdAccounts = accounts.filter(a => a.type === "FD");
          const nonFdTotal = accounts.filter(a => a.type !== "FD").reduce((s, a) => s + (Number(a.amount) || 0), 0);
          const fdProjected = fdAccounts.reduce((s, a) => {
            const principal = Number(a.amount) || 0;
            const roi = Number(a.roi) || 0.07; // Default 7% if not specified
            return s + principal * (1 + roi); // Simple 1-year projection
          }, 0);
          const projectedNetWorth = nonFdTotal + fdProjected;
          
          // Group by account type for breakdown
          const byType: Record<string, number> = {};
          accounts.forEach(a => {
            const t = a.type || 'Other';
            byType[t] = (byType[t] || 0) + (Number(a.amount) || 0);
          });
          
          // Group by bank for concentration
          const byBank: Record<string, number> = {};
          accounts.forEach(a => {
            byBank[a.bank] = (byBank[a.bank] || 0) + (Number(a.amount) || 0);
          });
          
          // Check for mismatch between Accounts FDs and Deposits sheet
          const accountsFdTotal = fdAccounts.reduce((s, a) => s + (Number(a.amount) || 0), 0);
          const depositsPrincipalTotal = deposits.reduce((s, d) => s + (Number(d.deposit) || 0), 0);
          const hasMismatch = Math.abs(accountsFdTotal - depositsPrincipalTotal) > 1000; // Allow small rounding diff
          
          return (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Mismatch Warning */}
              {hasMismatch && (
                <div style={{background:"#7F1D1D20",border:"1px solid #F8714940",borderRadius:10,padding:12,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>⚠️</span>
                  <div>
                    <div style={{fontSize:12,color:"#FCA5A5",fontWeight:600}}>Data Mismatch Detected</div>
                    <div style={{fontSize:11,color:"#9CA3AF"}}>
                      Accounts FDs: {fmt(accountsFdTotal)} vs Deposits sheet: {fmt(depositsPrincipalTotal)}. 
                      Update your Deposits sheet for accurate maturity tracking.
                    </div>
                  </div>
                </div>
              )}
              
              {/* Net Worth Cards */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3, 1fr)",gap:12}}>
                <div style={{background:"linear-gradient(135deg,#1E3A5F 0%,#0F3460 100%)",borderRadius:16,padding:20,border:"1px solid #3B82F6"}}>
                  <div style={{fontSize:11,color:"#93C5FD",fontWeight:600,textTransform:"uppercase"}}>Current Net Worth</div>
                  <div style={{fontSize:28,fontWeight:800,color:"#F0F6FC",fontFamily:"monospace",marginTop:8}}>{fmt(netWorth)}</div>
                  <div style={{fontSize:11,color:"#6B7280",marginTop:4}}>{accounts.length} accounts from Banks sheet</div>
                </div>
                <div style={{background:"#161B22",borderRadius:16,padding:20,border:"1px solid #238636"}}>
                  <div style={{fontSize:11,color:"#3FB950",fontWeight:600,textTransform:"uppercase"}}>Projected Net Worth</div>
                  <div style={{fontSize:28,fontWeight:800,color:"#3FB950",fontFamily:"monospace",marginTop:8}}>{fmt(projectedNetWorth)}</div>
                  <div style={{fontSize:11,color:"#6B7280",marginTop:4}}>{fdAccounts.length} FDs with avg ROI ~1 year</div>
                </div>
                <div style={{background:"#161B22",borderRadius:16,padding:20,border:"1px solid #F59E0B"}}>
                  <div style={{fontSize:11,color:"#F59E0B",fontWeight:600,textTransform:"uppercase"}}>Est. Interest (1 yr)</div>
                  <div style={{fontSize:28,fontWeight:800,color:"#F59E0B",fontFamily:"monospace",marginTop:8}}>{fmt(projectedNetWorth - netWorth)}</div>
                  <div style={{fontSize:11,color:"#6B7280",marginTop:4}}>+{netWorth ? ((projectedNetWorth - netWorth) / netWorth * 100).toFixed(1) : 0}% growth</div>
                </div>
              </div>
              
              {/* Category Breakdown */}
              <div style={{background:"#161B22",borderRadius:12,padding:16,border:"1px solid #30363D"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#F0F6FC",marginBottom:12}}>📊 By Account Type</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {Object.entries(byType).sort((a,b) => b[1] - a[1]).map(([type, amt]) => {
                    const typeColor = type === "FD" ? "#3B82F6" : type === "Saving" ? "#10B981" : type === "Credit Card" ? "#EF4444" : "#8B5CF6";
                    return (
                      <div key={type} style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:12,color:"#C9D1D9"}}>{type}</span>
                            <span style={{fontSize:12,color:"#F0F6FC",fontWeight:600,fontFamily:"monospace"}}>{fmt(amt)}</span>
                          </div>
                          <div style={{background:"#21262D",borderRadius:4,height:6,overflow:"hidden"}}>
                            <div style={{width:`${netWorth ? (amt/netWorth)*100 : 0}%`,height:"100%",background:typeColor,borderRadius:4}}/>
                          </div>
                        </div>
                        <span style={{fontSize:11,color:"#8B949E",minWidth:40,textAlign:"right"}}>{netWorth ? ((amt/netWorth)*100).toFixed(0) : 0}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Bank Concentration */}
              <div style={{background:"#161B22",borderRadius:12,padding:16,border:"1px solid #30363D"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#F0F6FC",marginBottom:12}}>🏦 Bank Concentration</div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4, 1fr)",gap:8}}>
                  {Object.entries(byBank).sort((a,b) => b[1] - a[1]).map(([bank, amt]) => (
                    <div key={bank} style={{background:"#21262D",borderRadius:8,padding:12,borderLeft:`3px solid ${getBankColor(bank)}`}}>
                      <div style={{fontSize:11,color:"#8B949E"}}>{bank}</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#F0F6FC",fontFamily:"monospace"}}>{fmt(amt)}</div>
                      <div style={{fontSize:10,color:getBankColor(bank)}}>{((amt/netWorth)*100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
        
        {/* ══ GOALS TAB ═══════════════════════════════════════════════════ */}
        {tab === "goals" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#F0F6FC"}}>🎯 Savings Goals</div>
              <button onClick={() => {
                const newGoal: SavingsGoal = {
                  ...emptyGoal,
                  id: Date.now().toString(),
                  createdAt: new Date().toISOString()
                };
                setForm(newGoal);
                setModal({type:"goal",mode:"add"});
              }} style={{background:"#238636",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer"}}>+ Add Goal</button>
            </div>
            
            {goals.length === 0 ? (
              <EmptyState icon="🎯" title="No Goals Set" description="Set savings goals to track your progress towards financial milestones" action="+ Create Goal" onAction={() => {
                const newGoal: SavingsGoal = { ...emptyGoal, id: Date.now().toString(), createdAt: new Date().toISOString() };
                setForm(newGoal);
                setModal({type:"goal",mode:"add"});
              }} />
            ) : (
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2, 1fr)",gap:12}}>
                {goals.map((g, i) => {
                  const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
                  const daysLeft = g.deadline ? daysUntil(g.deadline) : null;
                  return (
                    <div key={g.id} style={{background:"#161B22",borderRadius:12,padding:16,border:`1px solid ${g.color || '#30363D'}`,borderTop:`3px solid ${g.color || '#3B82F6'}`,opacity:g.done?0.6:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:g.done?"#8B949E":"#F0F6FC",textDecoration:g.done?"line-through":"none"}}>{g.name}</div>
                          <div style={{fontSize:11,color:"#8B949E"}}>{g.category}</div>
                        </div>
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={() => { setForm(g); setModal({type:"goal",mode:"edit",idx:i}); }} style={{background:"#21262D",color:"#58A6FF",border:"none",borderRadius:4,padding:"4px 8px",fontSize:10,cursor:"pointer"}}>Edit</button>
                          <button onClick={() => { const newGoals = goals.filter((_,j) => j !== i); setGoals(newGoals); persist(deposits,accounts,bills,actions,newGoals); }} style={{background:"#21262D",color:"#F85149",border:"none",borderRadius:4,padding:"4px 8px",fontSize:10,cursor:"pointer"}}>🗑</button>
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                        <div style={{fontSize:20,fontWeight:800,color:g.color || '#3B82F6',fontFamily:"monospace"}}>{fmt(g.currentAmount, g.currency)}</div>
                        <div style={{fontSize:12,color:"#8B949E"}}>of {fmt(g.targetAmount, g.currency)}</div>
                      </div>
                      <div style={{background:"#21262D",borderRadius:6,height:8,overflow:"hidden",marginBottom:8}}>
                        <div style={{width:`${Math.min(100, progress)}%`,height:"100%",background:`linear-gradient(90deg, ${g.color || '#3B82F6'}, ${g.color || '#3B82F6'}aa)`,borderRadius:6,transition:"width 0.3s"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                        <span style={{color:progress>=100?"#3FB950":"#8B949E"}}>{progress.toFixed(0)}% complete</span>
                        {daysLeft !== null && <span style={{color:daysLeft<30?"#F85149":"#8B949E"}}>{daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? "Due today!" : "Overdue"}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

        {/* ══ DEPOSITS TAB - Table with Collapsible Bank Groups ═══════════ */}
        {tab === "deposits" && (() => {
          // Group deposits by bank for collapsible headers
          const groupedDeps: Record<string, { deps: typeof filtered; indices: number[] }> = {};
          filtered.forEach((d) => {
            const origIdx = deposits.indexOf(d);
            if (!groupedDeps[d.bank]) groupedDeps[d.bank] = { deps: [], indices: [] };
            groupedDeps[d.bank].deps.push(d);
            groupedDeps[d.bank].indices.push(origIdx);
          });
          const depBankNames = Object.keys(groupedDeps).sort();
          
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
              {/* Search & Filter - Sticky on scroll */}
              <div style={{position:"sticky",top:0,zIndex:10,background:"#0D1117",padding:"12px 0",marginBottom:8}}>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{...inputSt,flex:isMobile?1:"none",width:isMobile?"auto":180,minWidth:120}} />
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:isMobile?undefined:1}}>
                    <button onClick={() => setFilterBank("All")} style={{background:filterBank === "All" ? "#3B82F6" : "#21262D",color:filterBank === "All" ? "#FFF" : "#8B949E",border:"none",borderRadius:16,padding:"5px 10px",fontSize:10,fontWeight:600,cursor:"pointer"}}>All</button>
                    {banks.map(b => (
                      <button key={b} onClick={() => setFilterBank(b)} style={{background:filterBank === b ? getBankColor(b) : "#21262D",color:filterBank === b ? "#FFF" : "#8B949E",border:"none",borderRadius:16,padding:"5px 10px",fontSize:10,fontWeight:600,cursor:"pointer"}}>{b}</button>
                    ))}
                  </div>
                  <button 
                    onClick={() => {
                      const allKeys = depBankNames.map(b => `dep_${b}`);
                      setExpandedBanks(prev => allExpanded ? new Set([...prev].filter(k => !k.startsWith('dep_'))) : new Set([...prev, ...allKeys]));
                    }}
                    style={{background:"#21262D",color:"#8B949E",border:"1px solid #30363D",borderRadius:6,padding:"5px 10px",fontSize:10,fontWeight:600,cursor:"pointer"}}
                  >
                    {allExpanded ? "Collapse" : "Expand"}
                  </button>
                  {!isMobile && <button onClick={() => openAdd("deposit")} style={{marginLeft:"auto",background:"#238636",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer"}}>+ Add</button>}
                </div>
              </div>

              {/* Table View with Collapsible Bank Groups */}
              <div style={{background:"#161B22",borderRadius:12,overflow:"hidden",border:"1px solid #30363D"}}>
                <div style={{overflowX:"auto",scrollbarWidth:"thin",scrollbarColor:"#30363D #161B22"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:"#0D1117",borderBottom:"1px solid #21262D"}}>
                      {["Bank","Type","Nominee","Invested","ROI","Maturity ₹","Matures","Days",""].map(h => (
                        <th key={h} style={{padding:"10px 12px",textAlign:"left",color:"#8B949E",fontWeight:600,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={9} style={{padding:32,textAlign:"center",color:"#8B949E"}}>No deposits found</td></tr>
                      ) : (
                        depBankNames.map(bankName => {
                          const { deps: bankDeps, indices } = groupedDeps[bankName];
                          const color = getBankColor(bankName);
                          const totalDeposited = bankDeps.reduce((s, d) => s + (Number(d.deposit) || 0), 0);
                          const totalMaturityAmt = bankDeps.reduce((s, d) => s + (Number(d.maturityAmt) || Number(d.deposit) || 0), 0);
                          const isExpanded = expandedBanks.has(`dep_${bankName}`);
                          
                          return (
                            <React.Fragment key={bankName}>
                              {/* Bank Header Row - Clickable */}
                              <tr 
                                onClick={() => toggleDepBank(bankName)}
                                style={{background:`${color}15`,cursor:"pointer",borderBottom:"1px solid #21262D"}}
                              >
                                <td colSpan={3} style={{padding:"10px 12px"}}>
                                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                                    <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                                    <div style={{width:10,height:10,borderRadius:"50%",background:color}} />
                                    <span style={{fontWeight:700,color:"#F0F6FC",fontSize:13}}>{bankName}</span>
                                    <span style={{color:"#6B7280",fontSize:11}}>({bankDeps.length} FD{bankDeps.length > 1 ? "s" : ""})</span>
                                  </div>
                                </td>
                                <td style={{padding:"10px 12px",fontFamily:"monospace",fontWeight:700,color:"#F0F6FC"}}>{fmt(totalDeposited)}</td>
                                <td style={{padding:"10px 12px"}}></td>
                                <td style={{padding:"10px 12px",fontFamily:"monospace",fontWeight:700,color:"#3FB950"}}>{fmt(totalMaturityAmt)}</td>
                                <td colSpan={3} style={{padding:"10px 12px"}}></td>
                              </tr>
                              
                              {/* Deposit Rows - Show when expanded */}
                              {isExpanded && bankDeps.map((d, j) => {
                                const origIdx = indices[j];
                                const days = daysUntil(d.maturityDate);
                                return (
                                  <tr key={`${bankName}-${j}`} style={{borderBottom:"1px solid #21262D",background:d.done ? "rgba(46,160,67,0.05)" : days != null && days < 0 ? "rgba(110,118,129,0.1)" : days != null && days <= 90 ? "rgba(248,81,73,0.05)" : "transparent",opacity:d.done ? 0.6 : 1}}>
                                    <td style={{padding:"10px 12px",paddingLeft:36}}>
                                      <div style={{fontSize:10,color:"#484F58",fontFamily:"monospace"}}>{d.depositId || "—"}</div>
                                    </td>
                                    <td style={{padding:"10px 12px",color:"#8B949E"}}>{d.type}</td>
                                    <td style={{padding:"10px 12px",color:"#C9D1D9"}}>{d.nominee}</td>
                                    <td style={{padding:"10px 12px",fontFamily:"monospace",fontWeight:600,color:"#F0F6FC"}}>{fmt(d.deposit)}</td>
                                    <td style={{padding:"10px 12px",fontFamily:"monospace"}}><span style={{color:"#3FB950",fontWeight:600}}>{d.roi ? (Number(d.roi) * 100).toFixed(2) + "%" : "—"}</span></td>
                                    <td style={{padding:"10px 12px",fontFamily:"monospace",fontWeight:600,color:"#3FB950"}}>{fmt(d.maturityAmt || d.deposit)}</td>
                                    <td style={{padding:"10px 12px",color:"#C9D1D9",whiteSpace:"nowrap"}}>{fmtDate(d.maturityDate)}</td>
                                    <td style={{padding:"10px 12px"}}><UrgencyBadge days={days} /></td>
                                    <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
                                      <button onClick={() => toggleDone("deposit", origIdx)} style={{background:d.done ? "#238636" : "#21262D",color:d.done ? "#fff" : "#8B949E",border:"none",borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer",marginRight:4,fontWeight:600}}>{d.done ? "↩" : "✓"}</button>
                                      <button onClick={() => openEdit("deposit", origIdx)} style={{background:"#21262D",color:"#58A6FF",border:"none",borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer",marginRight:4}}>✏️</button>
                                      <button onClick={() => deleteRow("deposit", origIdx)} style={{background:"#21262D",color:"#F85149",border:"none",borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>🗑</button>
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

              {/* Summary Footer */}
              <div style={{display:"flex",justifyContent:isMobile?"center":"flex-end",gap:8,marginTop:12,flexWrap:"wrap"}}>
                <div style={{background:"#161B22",borderRadius:8,padding:"8px 14px",border:"1px solid #30363D",fontSize:11}}>Invested: <strong style={{fontFamily:"monospace",color:"#F0F6FC"}}>{fmt(filtered.reduce((s, d) => s + (Number(d.deposit) || 0), 0))}</strong></div>
                <div style={{background:"#161B22",borderRadius:8,padding:"8px 14px",border:"1px solid #30363D",fontSize:11}}>Maturity: <strong style={{fontFamily:"monospace",color:"#3FB950"}}>{fmt(filtered.reduce((s, d) => s + (Number(d.maturityAmt) || Number(d.deposit) || 0), 0))}</strong></div>
              </div>
            </div>
          );
        })()}

        {/* ══ ACCOUNTS TAB - Grouped by Bank (Collapsible) ═══════════════ */}
        {tab === "accounts" && (() => {
          // Group accounts by bank name
          const grouped: Record<string, { accounts: typeof accounts; indices: number[] }> = {};
          accounts.forEach((acc, i) => {
            if (!grouped[acc.bank]) grouped[acc.bank] = { accounts: [], indices: [] };
            grouped[acc.bank].accounts.push(acc);
            grouped[acc.bank].indices.push(i);
          });
          const bankNames = Object.keys(grouped).sort();
          
          const toggleBank = (bankName: string) => {
            setExpandedBanks(prev => {
              const next = new Set(prev);
              if (next.has(bankName)) next.delete(bankName);
              else next.add(bankName);
              return next;
            });
          };
          
          return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <button 
                  onClick={() => setExpandedBanks(expandedBanks.size === bankNames.length ? new Set() : new Set(bankNames))}
                  style={{background:"#21262D",color:"#8B949E",border:"1px solid #30363D",borderRadius:6,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}
                >
                  {expandedBanks.size === bankNames.length ? "Collapse All" : "Expand All"}
                </button>
                <button onClick={() => openAdd("account")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Account</button>
              </div>
              {accounts.length === 0 ? (
                <EmptyState icon="🏦" title="No Bank Accounts" description="Add your bank accounts to track balances and pending actions" action="+ Add Account" onAction={() => openAdd("account")} />
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12,alignItems:"start"}}>
                  {bankNames.map(bankName => {
                    const { accounts: bankAccounts, indices } = grouped[bankName];
                    const color = getBankColor(bankName);
                    const totalBalance = bankAccounts.reduce((s, a) => s + (Number(a.amount) || 0), 0);
                    const hasActions = bankAccounts.some(a => a.nextAction && !a.done);
                    const isExpanded = expandedBanks.has(bankName);
                    
                    return (
                      <div key={bankName} style={{background:"#1C1C2E",borderRadius:12,border:`1px solid ${color}30`,borderLeft:`3px solid ${color}`,overflow:"hidden"}}>
                        {/* Bank Header - Clickable */}
                        <div 
                          onClick={() => toggleBank(bankName)}
                          style={{padding:"12px 14px",background:`${color}10`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                        >
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                            <div>
                              <div style={{fontSize:14,fontWeight:700,color:"#F3F4F6"}}>{bankName}</div>
                              <div style={{fontSize:10,color:"#9CA3AF"}}>{bankAccounts.length} account{bankAccounts.length > 1 ? "s" : ""}{hasActions ? " · ⚡ Actions" : ""}</div>
                            </div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:"#F9FAFB"}}>{fmt(totalBalance)}</div>
                          </div>
                        </div>
                        
                        {/* Account Types List - Collapsible */}
                        {isExpanded && (
                          <div style={{borderTop:`1px solid ${color}20`}}>
                            {bankAccounts.map((acc, j) => {
                              const originalIndex = indices[j];
                              const typeColor = acc.type === "FD" ? "#3B82F6" : acc.type === "Saving" ? "#10B981" : acc.type === "Credit Card" ? "#EF4444" : "#8B5CF6";
                              return (
                                <div key={j} style={{padding:"10px 14px",borderBottom:j < bankAccounts.length - 1 ? "1px solid #21262D" : "none",opacity:acc.done ? 0.55 : 1}}>
                                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                                    <div style={{flex:1}}>
                                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                                        <span style={{background:`${typeColor}20`,color:typeColor,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700}}>{acc.type}</span>
                                        {acc.done && <span style={{fontSize:9,color:"#6B7280"}}>✓ Done</span>}
                                      </div>
                                      {acc.holders && <div style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>👤 {acc.holders}</div>}
                                      <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4}}>
                                        {acc.amount && <span style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:acc.done ? "#6B7280" : "#F9FAFB"}}>{fmt(acc.amount)}</span>}
                                        {acc.roi && <span style={{fontSize:11,color:"#34D399"}}>{(Number(acc.roi) * 100).toFixed(2)}% pa</span>}
                                      </div>
                                      {acc.nextAction && !acc.done && <div style={{fontSize:11,color:"#F59E0B",marginTop:4,fontWeight:600}}>⚡ {acc.nextAction}</div>}
                                      {acc.detail && <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{acc.detail}</div>}
                                    </div>
                                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                                      <button onClick={(e) => { e.stopPropagation(); toggleDone("account", originalIndex); }} style={{background:acc.done ? "#064E3B" : "#1C1C2E",color:acc.done ? "#34D399" : "#6B7280",border:`1px solid ${acc.done ? "#065F46" : "#374151"}`,borderRadius:5,padding:"2px 6px",fontSize:10,cursor:"pointer",fontWeight:700}}>{acc.done ? "↩" : "✓"}</button>
                                      <button onClick={(e) => { e.stopPropagation(); openEdit("account", originalIndex); }} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:5,padding:"2px 5px",fontSize:10,cursor:"pointer"}}>✏️</button>
                                      <button onClick={(e) => { e.stopPropagation(); deleteRow("account", originalIndex); }} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:5,padding:"2px 5px",fontSize:10,cursor:"pointer"}}>🗑</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ══ BILLS TAB ══════════════════════════════════════════════ */}
        {tab === "bills" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <button onClick={() => openAdd("bill")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Bill</button>
            </div>
            {bills.length === 0 ? (
              <EmptyState icon="📋" title="No Bills Tracked" description="Add recurring bills and subscriptions to never miss a payment" action="+ Add Bill" onAction={() => openAdd("bill")} />
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

      {/* Floating Action Button (Mobile) */}
      {isMobile && !modal && (
        <button
          onClick={() => {
            const typeMap: Record<string, string> = { deposits: "deposit", accounts: "account", bills: "bill", actions: "action" };
            const type = typeMap[tab] || "deposit";
            openAdd(type);
          }}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #238636 0%, #2EA043 100%)",
            color: "#fff",
            border: "none",
            boxShadow: "0 4px 20px rgba(35, 134, 54, 0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 700,
            zIndex: 100,
            transition: "transform 0.2s, box-shadow 0.2s"
          }}
          title="Add new item (n)"
        >
          +
        </button>
      )}

      {/* Modal for Add/Edit */}
      {modal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#1C1C2E",borderRadius:20,padding:28,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",border:"1px solid #374151"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:22}}>
              <div style={{fontSize:17,fontWeight:800}}>{modal.mode==="add"?"Add":"Edit"} {modal.type}</div>
              <button onClick={()=>setModal(null)} style={{background:"#374151",color:"#9CA3AF",border:"none",borderRadius:8,padding:"3px 12px",cursor:"pointer"}}>✕</button>
            </div>
            
            {/* Deposit Form */}
            {modal.type === "deposit" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Bank</label><input style={inputSt} value={form.bank||""} onChange={e=>setForm({...form,bank:e.target.value})} placeholder="e.g. ICICI, HDFC" /></div>
                <div><label style={labelSt}>Type</label><input style={inputSt} value={form.type||""} onChange={e=>setForm({...form,type:e.target.value})} placeholder="Fixed Deposit" /></div>
                <div><label style={labelSt}>Currency</label><select style={inputSt} value={form.currency||"INR"} onChange={e=>setForm({...form,currency:e.target.value})}>{CURRENCIES.map(c=><option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}</select></div>
                <div><label style={labelSt}>Category</label><select style={inputSt} value={form.category||"General Savings"} onChange={e=>setForm({...form,category:e.target.value})}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={labelSt}>Deposit ID</label><input style={inputSt} value={form.depositId||""} onChange={e=>setForm({...form,depositId:e.target.value})} /></div>
                <div><label style={labelSt}>Nominee</label><input style={inputSt} value={form.nominee||""} onChange={e=>setForm({...form,nominee:e.target.value})} /></div>
                <div><label style={labelSt}>Start Date</label><input style={inputSt} type="date" value={form.startDate||""} onChange={e=>setForm({...form,startDate:e.target.value})} /></div>
                <div><label style={labelSt}>Principal ({CURRENCY_SYMBOLS[form.currency as Currency || 'INR']})</label><input style={inputSt} type="number" value={form.deposit||""} onChange={e=>setForm({...form,deposit:e.target.value})} /></div>
                <div><label style={labelSt}>ROI (%)</label><input style={inputSt} type="number" step="0.01" value={form.roi ? (Number(form.roi)*100).toString() : ""} onChange={e=>setForm({...form,roi:Number(e.target.value)/100})} placeholder="7.5" /></div>
                <div><label style={labelSt}>TDS (%)</label><input style={inputSt} type="number" step="0.1" value={form.tdsPercent||""} onChange={e=>setForm({...form,tdsPercent:e.target.value})} placeholder="10" /></div>
                <div><label style={labelSt}>Maturity Amount</label><input style={inputSt} type="number" value={form.maturityAmt||""} onChange={e=>setForm({...form,maturityAmt:e.target.value})} /></div>
                <div><label style={labelSt}>Maturity Date</label><input style={inputSt} type="date" value={form.maturityDate||""} onChange={e=>setForm({...form,maturityDate:e.target.value})} /></div>
                <div><label style={labelSt}>Duration</label><input style={inputSt} value={form.duration||""} onChange={e=>setForm({...form,duration:e.target.value})} placeholder="60 months" /></div>
                <div><label style={labelSt}>Auto Renewal</label><select style={inputSt} value={form.autoRenewal?"Yes":"No"} onChange={e=>setForm({...form,autoRenewal:e.target.value==="Yes"})}><option value="No">No</option><option value="Yes">Yes</option></select></div>
                <div><label style={labelSt}>Linked Account</label><input style={inputSt} value={form.linkedAccount||""} onChange={e=>setForm({...form,linkedAccount:e.target.value})} placeholder="Interest credit account" /></div>
                <div><label style={labelSt}>Maturity Action</label><input style={inputSt} value={form.maturityAction||""} onChange={e=>setForm({...form,maturityAction:e.target.value})} placeholder="What to do at maturity" /></div>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Notes</label><textarea style={{...inputSt,minHeight:60,resize:"vertical"}} value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
              </div>
            )}

            {/* Account Form */}
            {modal.type === "account" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Bank</label><input style={inputSt} value={form.bank||""} onChange={e=>setForm({...form,bank:e.target.value})} placeholder="e.g. SBI, Axis" /></div>
                <div><label style={labelSt}>Type</label><input style={inputSt} value={form.type||""} onChange={e=>setForm({...form,type:e.target.value})} placeholder="Saving, Current" /></div>
                <div><label style={labelSt}>Holders</label><input style={inputSt} value={form.holders||""} onChange={e=>setForm({...form,holders:e.target.value})} placeholder="Account holders" /></div>
                <div><label style={labelSt}>Balance (₹)</label><input style={inputSt} type="number" value={form.amount||""} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
                <div><label style={labelSt}>ROI (decimal)</label><input style={inputSt} type="number" step="0.001" value={form.roi||""} onChange={e=>setForm({...form,roi:e.target.value})} /></div>
                <div><label style={labelSt}>Online Banking</label><input style={inputSt} value={form.online||""} onChange={e=>setForm({...form,online:e.target.value})} placeholder="Yes/No" /></div>
                <div><label style={labelSt}>Address</label><input style={inputSt} value={form.address||""} onChange={e=>setForm({...form,address:e.target.value})} /></div>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Details</label><input style={inputSt} value={form.detail||""} onChange={e=>setForm({...form,detail:e.target.value})} /></div>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Next Action</label><input style={inputSt} value={form.nextAction||""} onChange={e=>setForm({...form,nextAction:e.target.value})} placeholder="Pending task for this account" /></div>
              </div>
            )}

            {/* Bill Form */}
            {modal.type === "bill" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Bill Name</label><input style={inputSt} value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Electricity, Internet" /></div>
                <div><label style={labelSt}>Frequency</label><input style={inputSt} value={form.freq||""} onChange={e=>setForm({...form,freq:e.target.value})} placeholder="Monthly, Quarterly" /></div>
                <div><label style={labelSt}>Amount (₹)</label><input style={inputSt} type="number" value={form.amount||""} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
                <div><label style={labelSt}>Due Day</label><input style={inputSt} value={form.due||""} onChange={e=>setForm({...form,due:e.target.value})} placeholder="15th" /></div>
                <div><label style={labelSt}>Priority</label><input style={inputSt} value={form.priority||""} onChange={e=>setForm({...form,priority:e.target.value})} placeholder="Normal, High" /></div>
                <div><label style={labelSt}>Phone</label><input style={inputSt} value={form.phone||""} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
                <div><label style={labelSt}>Email</label><input style={inputSt} value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})} /></div>
              </div>
            )}

            {/* Action Form */}
            {modal.type === "action" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Title</label><input style={inputSt} value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What needs to be done" /></div>
                <div><label style={labelSt}>Related Bank (optional)</label><input style={inputSt} value={form.bank||""} onChange={e=>setForm({...form,bank:e.target.value})} placeholder="e.g. ICICI" /></div>
                <div><label style={labelSt}>Due Date</label><input style={inputSt} type="date" value={form.date||""} onChange={e=>setForm({...form,date:e.target.value})} /></div>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Notes</label><textarea style={{...inputSt,minHeight:80,resize:"vertical"}} value={form.note||""} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Additional details" /></div>
              </div>
            )}

            {/* Goal Form */}
            {modal.type === "goal" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Goal Name</label><input style={inputSt} value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Emergency Fund, Car Down Payment" /></div>
                <div><label style={labelSt}>Target Amount</label><input style={inputSt} type="number" value={form.targetAmount||""} onChange={e=>setForm({...form,targetAmount:Number(e.target.value)})} /></div>
                <div><label style={labelSt}>Currency</label><select style={inputSt} value={form.currency||"INR"} onChange={e=>setForm({...form,currency:e.target.value})}>{CURRENCIES.map(c=><option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}</select></div>
                <div><label style={labelSt}>Current Amount</label><input style={inputSt} type="number" value={form.currentAmount||""} onChange={e=>setForm({...form,currentAmount:Number(e.target.value)})} /></div>
                <div><label style={labelSt}>Category</label><select style={inputSt} value={form.category||"General Savings"} onChange={e=>setForm({...form,category:e.target.value})}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={labelSt}>Target Date (optional)</label><input style={inputSt} type="date" value={form.deadline||""} onChange={e=>setForm({...form,deadline:e.target.value})} /></div>
                <div><label style={labelSt}>Color</label><input style={{...inputSt,padding:4,height:38}} type="color" value={form.color||"#3B82F6"} onChange={e=>setForm({...form,color:e.target.value})} /></div>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Notes</label><textarea style={{...inputSt,minHeight:60,resize:"vertical"}} value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
              </div>
            )}

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
