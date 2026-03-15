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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { Deposit, BankAccount, Bill, ActionItem, BankRecordsData, SavingsGoal, Currency, DepositCategory } from '../types/bankRecords';
import { updateFinancialAlertsCache, FinancialAlertsSummary } from './FinancialAlertsWidget';
import { CryptoKey, encryptData, decryptData } from '../utils/encryption';
import { useTheme } from '../contexts/ThemeContext';
import PendingFinancialImportsModal, { AccountUpdate } from './PendingFinancialImportsModal';
import { getPendingImportCount, approveFinancialImport } from '../services/pendingFinancialImports';

interface BankDashboardProps {
  supabase?: SupabaseClient;
  userId?: string;
  encryptionKey?: CryptoKey;
  onOpenGroupChat?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MS_PER_DAY = 86400000;
const EXCEL_EPOCH_OFFSET = 25569; // Days from 1/1/1900 to Unix epoch

const URGENCY_THRESHOLDS = {
  CRITICAL: 7,    // Days until maturity/due considered critical
  WARNING: 30,    // Days until maturity/due considered warning
  UPCOMING: 90,   // Days to show in upcoming section
} as const;

const CHART_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', 
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today = new Date();
today.setHours(0,0,0,0);

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0,0,0,0);
  return Math.round((d.getTime() - today.getTime()) / MS_PER_DAY);
}

const CURRENCY_SYMBOLS: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
const CURRENCY_LOCALES: Record<Currency, string> = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
const DEFAULT_RATES = { USD: 83, EUR: 90, GBP: 105 }; // Rates to INR

// Convert amount to target currency using exchange rates
function convertCurrency(
  amount: number, 
  fromCurrency: Currency, 
  toCurrency: Currency, 
  rates: {USD: number; EUR: number; GBP: number}
): number {
  // Validate currencies - default to INR if invalid
  const validFrom: Currency = (fromCurrency && CURRENCY_SYMBOLS[fromCurrency]) ? fromCurrency : 'INR';
  const validTo: Currency = (toCurrency && CURRENCY_SYMBOLS[toCurrency]) ? toCurrency : 'INR';
  
  if (validFrom === validTo) return amount;
  
  // First convert to INR (base currency)
  let inrAmount = amount;
  if (validFrom !== 'INR') {
    inrAmount = amount * (rates[validFrom as keyof typeof rates] || 1);
  }
  
  // Then convert from INR to target
  if (validTo === 'INR') return inrAmount;
  return inrAmount / (rates[validTo as keyof typeof rates] || 1);
}

function fmt(n: number | string | null | undefined, currency: Currency = 'INR'): string {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  // Validate currency - default to INR if invalid
  const validCurrency: Currency = (currency && CURRENCY_SYMBOLS[currency]) ? currency : 'INR';
  const sym = CURRENCY_SYMBOLS[validCurrency];
  
  if (validCurrency === 'INR') {
    if (abs >= 10000000) return sign + sym + (abs/10000000).toFixed(2) + " Cr";
    if (abs >= 100000)  return sign + sym + (abs/100000).toFixed(2) + " L";
    if (abs >= 1000) return sign + sym + (abs/1000).toFixed(2) + " K";
  } else {
    if (abs >= 1000000000) return sign + sym + (abs/1000000000).toFixed(2) + "B";
    if (abs >= 1000000) return sign + sym + (abs/1000000).toFixed(2) + "M";
    if (abs >= 1000) return sign + sym + (abs/1000).toFixed(1) + "K";
  }
  return sign + sym + abs.toLocaleString(CURRENCY_LOCALES[validCurrency], { maximumFractionDigits: 2 });
}

function fmtFull(n: number | string | null | undefined, currency: Currency = 'INR'): string {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const validCurrency: Currency = (currency && CURRENCY_SYMBOLS[currency]) ? currency : 'INR';
  return sign + CURRENCY_SYMBOLS[validCurrency] + abs.toLocaleString(CURRENCY_LOCALES[validCurrency], { maximumFractionDigits: 2 });
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

/** Default display currency from locale/timezone (e.g. USD for US, INR for India) */
function getDefaultDisplayCurrency(): 'ORIGINAL' | 'INR' | 'USD' | 'EUR' | 'GBP' {
  try {
    const lang = typeof navigator !== 'undefined' ? navigator.language : '';
    const tz = typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
    if (lang.startsWith('en-IN') || tz.includes('Kolkata') || tz.includes('India')) return 'INR';
    if (lang.startsWith('en-US') || lang.startsWith('en-GB') || tz.startsWith('America/') || tz.startsWith('Europe/London')) return 'USD';
    if (tz.startsWith('Europe/') && !tz.includes('London')) return 'EUR';
    return 'USD';
  } catch {
    return 'USD';
  }
}

function UrgencyBadge({ days }: { days: number | null }) {
  const bs = (bg: string, color: string) => ({ background:bg, color, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:"nowrap" as const });
  if (days === null) return <span style={bs("#f3f4f6","#6b7280")}>No Date</span>;
  if (days < 0)   return <span style={bs("#f3f4f6","#9ca3af")}>Matured</span>;
  if (days === 0) return <span style={bs("#fef2f2","#dc2626")}>TODAY!</span>;
  if (days <= 30) return <span style={bs("#fef2f2","#dc2626")}>🔴 {days}d</span>;
  if (days <= 90) return <span style={bs("#fef9c3","#ca8a04")}>🟡 {days}d</span>;
  if (days <= 180) return <span style={bs("#dcfce7","#16a34a")}>🟢 {days}d</span>;
  return <span style={bs("#dbeafe","#2563eb")}>{days}d</span>;
}

const emptyDeposit: Deposit  = { bank:"", type:"Fixed Deposit", depositId:"", nominee:"", startDate:"", deposit:"", roi:"", maturityAmt:"", maturityDate:"", duration:"", maturityAction:"", done:false, currency:"INR", category:"General Savings", tdsPercent:"", autoRenewal:false, linkedAccount:"", notes:"" };
const emptyAccount: BankAccount  = { bank:"", type:"Saving", holders:"", amount:"", roi:"", online:"Yes", address:"", detail:"", nextAction:"", done:false, currency:"INR", accountNumber:"", ifscCode:"", branch:"", hidden:false };
const emptyBill: Bill     = { name:"", freq:"Monthly", amount:"", due:"", priority:"Normal", phone:"", email:"", done:false, currency:"INR", category:"", autoPay:false };
const emptyAction: ActionItem   = { title:"", bank:"", date:"", note:"", done:false, priority:"Medium", reminderDays:[7,1] };
const emptyGoal: SavingsGoal = { id:"", name:"", targetAmount:0, currency:"INR", currentAmount:0, deadline:"", category:"General Savings", linkedDeposits:[], color:"#3B82F6", notes:"", createdAt:"", done:false };

const CATEGORIES: DepositCategory[] = ['Emergency Fund', 'Retirement', 'Child Education', 'House/Property', 'Vehicle', 'Wedding', 'Travel', 'General Savings', 'Tax Saving', 'Other'];
const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP'];

// ─── Theme Helper - Uses CSS Variables from ThemeContext ─────────────────────
// These CSS variables are set by ThemeContext based on user's selected theme
const getThemeStyles = () => ({
  bg: 'var(--color-background)',
  cardBg: 'var(--color-card-bg)',
  cardBgAlt: 'var(--color-card-bg-alt)',
  border: 'var(--color-card-border)',
  borderLight: 'var(--color-card-border)',
  text: 'var(--color-text)',
  textMuted: 'var(--color-text-muted)',
  textLight: 'var(--color-text-light)',
  accent: 'var(--color-primary)',
  accentHover: 'var(--color-secondary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  headerBg: 'linear-gradient(135deg, var(--gradient-from) 0%, var(--gradient-via) 50%, var(--gradient-to) 100%)',
});

// Empty State Component - uses CSS variables for theming
function EmptyState({ icon, title, description, action, onAction }: { icon: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{textAlign:"center",padding:"48px 24px",background:'var(--color-card-bg-alt)',borderRadius:12,border:'1px solid var(--color-card-border)'}}>
      <div style={{fontSize:48,marginBottom:12,opacity:0.6}}>{icon}</div>
      <div style={{fontSize:16,fontWeight:600,color:'var(--color-text)',marginBottom:6}}>{title}</div>
      <div style={{fontSize:13,color:'var(--color-text-muted)',marginBottom:action?16:0,maxWidth:280,margin:"0 auto"}}>{description}</div>
      {action && onAction && (
        <button onClick={onAction} style={{background:'var(--color-primary)',color:"#fff",border:"none",borderRadius:6,padding:"8px 20px",fontSize:12,fontWeight:600,cursor:"pointer",marginTop:16}}>{action}</button>
      )}
    </div>
  );
}

const inputSt: React.CSSProperties = { background:'var(--color-card-bg)', border:'1px solid var(--color-card-border)', color:'var(--color-text)', borderRadius:8, padding:"8px 12px", fontSize:13, width:"100%", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const labelSt: React.CSSProperties = { fontSize:11, color:'var(--color-text-muted)', fontWeight:600, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 };

// ─── Main Component ──────────────────────────────────────────────────────────
export default function BankDashboard({ supabase, userId, encryptionKey, onOpenGroupChat }: BankDashboardProps) {
  // Get theme from context - respects user's theme selection
  const { theme } = useTheme();
  
  // Create THEME object from user's selected theme (memoized for performance)
  const THEME = useMemo(() => ({
    bg: theme.colors.background,
    cardBg: theme.colors.cardBg,
    cardBgAlt: theme.colors.background,
    border: theme.colors.cardBorder,
    borderLight: theme.colors.cardBorder,
    text: theme.colors.text,
    textMuted: theme.colors.textLight,
    textLight: theme.colors.textLight,
    accent: theme.colors.primary,
    accentHover: theme.colors.secondary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
    headerBg: `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`,
  }), [theme]);

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState(false);
  const [pendingImportsCount, setPendingImportsCount] = useState(0);
  const [showPendingImportsModal, setShowPendingImportsModal] = useState(false);
  const [modal, setModal] = useState<{type: string; mode: string; idx?: number} | null>(null);
  const [form, setForm] = useState<any>({});
  const [filterBank, setFilterBank] = useState("All");
  
  // Currency conversion settings - default from locale (e.g. USD for US), 'ORIGINAL' = mixed
  const [displayCurrency, setDisplayCurrency] = useState<'ORIGINAL' | 'INR' | 'USD' | 'EUR' | 'GBP'>(getDefaultDisplayCurrency);
  const [exchangeRates, setExchangeRates] = useState<{USD: number; EUR: number; GBP: number}>({ USD: 83, EUR: 90, GBP: 105 });
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [accountsViewMode, setAccountsViewMode] = useState<'cards' | 'grouped' | 'flat'>('cards');
  const [depositsViewMode, setDepositsViewMode] = useState<'cards' | 'grouped' | 'flat'>('grouped');
  const [showAllAccounts, setShowAllAccounts] = useState(false); // false = hide accounts marked as hidden
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(false);
  const [show30Days, setShow30Days] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  const [showLegend, setShowLegend] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
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

  // ── Pending Financial Imports ───────────────────────────────────────────────
  useEffect(() => {
    setPendingImportsCount(getPendingImportCount());
  }, [showPendingImportsModal]);

  const handleApplyFinancialImport = async (importId: string, updates: AccountUpdate[]) => {
    const now = new Date().toISOString();
    const newAccounts = [...accounts];
    const newDeposits = [...deposits];

    updates.forEach(update => {
      if (update.action === 'skip') return;

      if (update.action === 'create') {
        if (update.type === 'account') {
          newAccounts.push({
            bank: update.accountName,
            type: 'Investment',
            holders: '',
            amount: update.newBalance,
            roi: 0,
            online: 'Yes',
            address: '',
            detail: 'Imported from screenshot',
            nextAction: '',
            done: false,
            currency: update.currency as Currency || 'USD',
            lastBalanceUpdatedAt: now,
            balanceHistory: [{ date: now, amount: Number(update.newBalance) || 0, source: 'Imported from screenshot' }],
          });
        }
      } else if (update.action === 'update' && update.existingIndex !== undefined) {
        if (update.type === 'account') {
          const prev = newAccounts[update.existingIndex];
          const prevAmount = Number(prev.amount) || 0;
          const newBalance = update.newBalance;
          const newAmount = Number(newBalance) || 0;
          newAccounts[update.existingIndex] = {
            ...prev,
            amount: newBalance,
            lastBalanceUpdatedAt: now,
            balanceHistory: [
              ...(prev.balanceHistory || []),
              { date: now, amount: newAmount, previousAmount: prevAmount, source: 'Financial import' },
            ],
          };
        } else if (update.type === 'deposit') {
          const prev = newDeposits[update.existingIndex];
          const prevAmount = Number(prev.deposit) || 0;
          const newBalance = update.newBalance;
          const newAmount = Number(newBalance) || 0;
          newDeposits[update.existingIndex] = {
            ...prev,
            deposit: newBalance,
            lastBalanceUpdatedAt: now,
            balanceHistory: [
              ...(prev.balanceHistory || []),
              { date: now, amount: newAmount, previousAmount: prevAmount, source: 'Financial import' },
            ],
          };
        }
      }
    });

    setAccounts(newAccounts);
    setDeposits(newDeposits);
    approveFinancialImport(importId);
    setPendingImportsCount(getPendingImportCount());

    await persist(newDeposits, newAccounts, bills, actions, goals);
    alert('✅ Financial import applied successfully!');
  };

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
            if (parsed.exchangeRates) setExchangeRates(parsed.exchangeRates);
            if (parsed.displayCurrency) setDisplayCurrency(parsed.displayCurrency);
            else setDisplayCurrency(getDefaultDisplayCurrency());
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
          // No data yet — start empty; keep display currency from locale
          console.log('[BankDashboard] 📊 No data found, starting empty');
          setDeposits([]);
          setAccounts([]);
          setBills([]);
          setActions([]);
          setDisplayCurrency(getDefaultDisplayCurrency());
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

  async function persist(deps: Deposit[], accs: BankAccount[], bls: Bill[], acts: ActionItem[], gls?: SavingsGoal[], rates?: {USD: number; EUR: number; GBP: number}, dispCur?: 'ORIGINAL' | 'INR' | 'USD' | 'EUR' | 'GBP') {
    const payload: BankRecordsData = { deposits: deps, accounts: accs, bills: bls, actions: acts, goals: gls || goals, exchangeRates: rates || exchangeRates, displayCurrency: dispCur || displayCurrency, updatedAt: new Date().toISOString(), version: 1 };
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
      
      // Track items to DELETE
      let deleteDeposits: { bank: string; depositId?: string; startDate?: string }[] = [];
      let deleteAccounts: { bank: string; type: string; holders: string }[] = [];
      let deleteBills: { name: string }[] = [];
      
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
          
          // Find Status column for skip logic (use trim for robust matching)
          const cStatus = h.findIndex((x: any) => x && x.toString().toLowerCase().trim() === "status");
          const cCur = h.findIndex((x: any) => x && x.toString().toLowerCase().trim() === "currency");
          console.log("[Excel Import] Deposits sheet - Currency column index:", cCur, "Headers:", h);
          
          for (let i = hIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[cB]) continue;
            const bank = r[cB]?.toString().trim();
            if (!bank || bank === "Row Labels") continue;
            // Skip total/summary rows
            const bankLower = bank.toLowerCase();
            if (bankLower.includes("total") || bankLower.includes("grand") || bankLower.includes("sum") || bankLower === "total") continue;
            // Handle Status column
            if (cStatus >= 0 && r[cStatus]) {
              const status = r[cStatus].toString().toLowerCase().trim();
              // DELETE - mark for removal
              if (status === "delete" || status === "remove") {
                deleteDeposits.push({
                  bank: bank,
                  depositId: r[cI]?.toString() || "",
                  startDate: toISO(r[cS]) || ""
                });
                continue;
              }
              // Skip rows with Status = SKIP, ARCHIVE, DRAFT, IGNORE
              if (["skip", "archive", "draft", "ignore", "old", "inactive"].includes(status)) continue;
            }
            
            const currencyVal = (cCur >= 0 && r[cCur]) ? r[cCur].toString().trim().toUpperCase() : "INR";
            console.log("[Excel Import] Deposit:", bank, "Currency col value:", r[cCur], "→", currencyVal);
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
              currency: currencyVal as any,
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
          // Find Status, Currency, and Hidden columns (use trim for robust matching)
          const cStatus = h.findIndex((x: any) => x && x.toString().toLowerCase().trim() === "status");
          const cCur = h.findIndex((x: any) => x && x.toString().toLowerCase().trim() === "currency");
          const cHidden = h.findIndex((x: any) => x && x.toString().toLowerCase().trim() === "hidden");
          console.log("[Excel Import] Banks sheet - Currency column index:", cCur, "Headers:", h);
          
          for (let i = hIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[cS]) continue;
            const bank = r[cS]?.toString().trim();
            if (!bank) continue;
            // Skip total/summary rows
            const bankLower = bank.toLowerCase();
            if (bankLower.includes("total") || bankLower.includes("grand") || bankLower.includes("sum")) continue;
            // Handle Status column
            if (cStatus >= 0 && r[cStatus]) {
              const status = r[cStatus].toString().toLowerCase().trim();
              // DELETE - mark for removal
              if (status === "delete" || status === "remove") {
                deleteAccounts.push({
                  bank: bank,
                  type: r[cT]?.toString() || "Saving",
                  holders: [r[cN1], r[cN2]].filter(Boolean).join(", ")
                });
                continue;
              }
              // Skip rows with Status = SKIP, ARCHIVE, DRAFT, IGNORE
              if (["skip", "archive", "draft", "ignore", "old", "inactive"].includes(status)) continue;
            }
            
            const currencyVal = (cCur >= 0 && r[cCur]) ? r[cCur].toString().trim().toUpperCase() : "INR";
            const hiddenVal = cHidden >= 0 && r[cHidden] ? ["yes", "true", "1", "y"].includes(r[cHidden].toString().toLowerCase().trim()) : false;
            console.log("[Excel Import] Account:", bank, "Currency col value:", r[cCur], "→", currencyVal);
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
              currency: currencyVal as any,
              hidden: hiddenVal,
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
          // Find Status and Currency columns (use trim for robust matching)
          const cStatus = h.findIndex((x: any) => x && x.toString().toLowerCase().trim() === "status");
          const cCur = h.findIndex((x: any) => x && x.toString().toLowerCase().trim() === "currency");
          
          for (let i = hIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[cN]) continue;
            const name = r[cN]?.toString().trim();
            if (!name) continue;
            // Skip total/summary rows
            const nameLower = name.toLowerCase();
            if (nameLower.includes("total") || nameLower.includes("grand") || nameLower.includes("sum")) continue;
            // Handle Status column
            if (cStatus >= 0 && r[cStatus]) {
              const status = r[cStatus].toString().toLowerCase().trim();
              // DELETE - mark for removal
              if (status === "delete" || status === "remove") {
                deleteBills.push({ name: name });
                continue;
              }
              // Skip rows with Status = SKIP, ARCHIVE, DRAFT, IGNORE
              if (["skip", "archive", "draft", "ignore", "old", "inactive"].includes(status)) continue;
            }
            
            const currencyVal = (cCur >= 0 && r[cCur]) ? r[cCur].toString().trim().toUpperCase() : "INR";
            newBills.push({
              name: name,
              freq: r[cF]?.toString() || "Monthly",
              amount: parseFloat(r[cA]) || 0,
              due: r[cD]?.toString() || "",
              priority: r[cP]?.toString() || "Normal",
              phone: r[cPh]?.toString() || "",
              email: r[cE]?.toString() || "",
              currency: currencyVal as any,
              done: false
            });
          }
        }
      }
      
      // ── Smart Merge Logic ──
      let addedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;
      
      // First, handle DELETIONS
      // Delete Deposits
      let mergedDeposits = [...deposits];
      deleteDeposits.forEach(del => {
        const key = del.depositId 
          ? `${del.bank}|${del.depositId}`
          : `${del.bank}|${del.startDate}`;
        const idx = mergedDeposits.findIndex(d => {
          const existingKey = d.depositId
            ? `${d.bank}|${d.depositId}`
            : `${d.bank}|${d.startDate}`;
          return existingKey === key;
        });
        if (idx >= 0) {
          mergedDeposits.splice(idx, 1);
          deletedCount++;
        }
      });
      
      // Delete Accounts
      let mergedAccounts = [...accounts];
      deleteAccounts.forEach(del => {
        const key = `${del.bank}|${del.type}|${del.holders || ''}`;
        const idx = mergedAccounts.findIndex(a => 
          `${a.bank}|${a.type}|${a.holders || ''}` === key
        );
        if (idx >= 0) {
          mergedAccounts.splice(idx, 1);
          deletedCount++;
        }
      });
      
      // Delete Bills
      let mergedBills = [...bills];
      deleteBills.forEach(del => {
        const idx = mergedBills.findIndex(b => 
          b.name.toLowerCase() === del.name.toLowerCase()
        );
        if (idx >= 0) {
          mergedBills.splice(idx, 1);
          deletedCount++;
        }
      });
      
      // Then, handle ADD/UPDATE
      // Merge Deposits (by bank + depositId OR bank + startDate)
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
      
      // Merge Accounts (by bank + type + holders to allow multiple accounts of same type)
      newAccounts.forEach(newAcc => {
        const key = `${newAcc.bank}|${newAcc.type}|${newAcc.holders || ''}`;
        const existingIdx = mergedAccounts.findIndex(a => 
          `${a.bank}|${a.type}|${a.holders || ''}` === key
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
      
      alert(`✅ Excel imported!\n📊 ${addedCount} new records added\n✏️ ${updatedCount} records updated\n🗑️ ${deletedCount} records deleted\n📁 Total: ${mergedDeposits.length} deposits, ${mergedAccounts.length} accounts, ${mergedBills.length} bills`);
      
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
          h2 { color: ${THEME.border}; margin-top: 24px; }
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

  async function handleExportTemplate() {
    const { utils, writeFile } = await import('xlsx');
    
    // Helper to convert date string to Excel serial number
    const dateToExcel = (dateStr: string) => {
      const d = new Date(dateStr);
      return EXCEL_EPOCH_OFFSET + d.getTime() / MS_PER_DAY;
    };
    
    // Instructions sheet - Updated with ALL fields + Status column
    const instructionsData = [
      ["📋 BANK RECORDS TEMPLATE - INSTRUCTIONS"],
      [""],
      ["⚠️ IMPORTANT RULES:"],
      ["1. DO NOT add new columns - only the columns listed below are imported"],
      ["2. DO NOT rename existing columns - the app looks for specific column names"],
      ["3. DO NOT add new sheets - only Deposits, Banks, and Bills sheets are processed"],
      ["4. DO NOT include 'Total' or 'Grand Total' rows - they will be skipped automatically"],
      ["5. Keep the header row intact - it's required for import to work"],
      [""],
      ["📝 HOW TO USE:"],
      ["1. Fill in your data in the Deposits, Banks, and Bills sheets"],
      ["2. Delete the example rows or modify them with your data"],
      ["3. Save the file as .xlsx"],
      ["4. Import it using the Import button in the app"],
      [""],
      ["🚫 SKIP / DELETE ROWS:"],
      ["- Use the 'Status' column to control how rows are processed"],
      ["- SKIP, ARCHIVE, DRAFT, IGNORE, OLD, INACTIVE → Row is skipped (not imported)"],
      ["- DELETE or REMOVE → Matching record is DELETED from dashboard"],
      ["- Blank or ACTIVE → Row is imported/updated normally"],
      ["- DELETE uses the same matching keys: Bank+DepositID, Bank+Type+Holders, or Bill Name"],
      [""],
      ["💰 CURRENCY SUPPORT:"],
      ["- Supported currencies: INR (₹), USD ($), EUR (€), GBP (£)"],
      ["- Add a 'Currency' column with values: INR, USD, EUR, or GBP"],
      ["- If no currency specified, INR is assumed"],
      [""],
      ["═══════════════════════════════════════════════════════════════"],
      ["📊 DEPOSITS SHEET - ALL SUPPORTED COLUMNS:"],
      ["═══════════════════════════════════════════════════════════════"],
      ["Status         - ACTIVE (import), SKIP/ARCHIVE (don't import), DELETE (remove from dashboard)"],
      ["Bank           - Bank name (required)"],
      ["Type           - FD, RD, SCSS, PPF, Tax Saver FD, etc."],
      ["Deposit ID     - Unique ID from bank"],
      ["Nominee        - Name of nominee"],
      ["Start Date     - When deposit was created (Excel date)"],
      ["Deposit        - Amount invested (number)"],
      ["ROI            - Interest rate as decimal (0.07 = 7%)"],
      ["Maturity Amount - Expected amount at maturity"],
      ["Maturity Date  - When deposit matures (Excel date)"],
      ["Duration       - e.g., '12 months', '5 years', '365 days'"],
      ["Maturity Action - What to do: Renew, Close, Transfer, etc."],
      ["Currency       - INR, USD, EUR, GBP"],
      ["Category       - Emergency Fund, Retirement, Tax Saving, etc."],
      ["TDS Percent    - Tax deducted at source % (e.g., 10)"],
      ["Auto Renewal   - Yes/No"],
      ["Linked Account - Account where interest credits"],
      ["Notes          - Any additional notes"],
      [""],
      ["═══════════════════════════════════════════════════════════════"],
      ["🏦 BANKS (ACCOUNTS) SHEET - ALL SUPPORTED COLUMNS:"],
      ["═══════════════════════════════════════════════════════════════"],
      ["Status         - ACTIVE (import), SKIP/ARCHIVE (don't import), DELETE (remove from dashboard)"],
      ["Source         - Bank name (required)"],
      ["Amount         - Current balance (number)"],
      ["Type           - Saving, FD, Current, Credit Card, PPF, etc."],
      ["1st Holder     - Primary account holder name"],
      ["2nd Holder     - Joint holder (if any)"],
      ["Online         - Yes/No - Online banking enabled?"],
      ["Next Action    - Pending action (Update KYC, etc.)"],
      ["ROI            - Interest rate as decimal"],
      ["Address        - Branch address"],
      ["Details        - Additional details (account number, etc.)"],
      ["Currency       - INR, USD, EUR, GBP"],
      ["Account Number - Full account number"],
      ["IFSC Code      - IFSC code for transfers"],
      ["Branch         - Branch name"],
      ["Hidden         - Yes/No - Hide from default view (shown as 'Other Accounts' aggregate)"],
      [""],
      ["═══════════════════════════════════════════════════════════════"],
      ["📄 BILLS SHEET - ALL SUPPORTED COLUMNS:"],
      ["═══════════════════════════════════════════════════════════════"],
      ["Status         - ACTIVE (import), SKIP/ARCHIVE (don't import), DELETE (remove from dashboard)"],
      ["Name           - Bill name (required)"],
      ["Frequency      - Monthly, Quarterly, Yearly, etc."],
      ["Amount         - Bill amount (number)"],
      ["Date           - Due date (e.g., '15th', '2024-03-15')"],
      ["Priority       - Low, Normal, High"],
      ["Phone          - Contact phone"],
      ["Email          - Contact email"],
      ["Currency       - INR, USD, EUR, GBP"],
      ["Category       - Utility, Entertainment, Insurance, etc."],
      ["Auto Pay       - Yes/No"],
      [""],
      ["💡 TIPS:"],
      ["- Dates: Use Excel date format (select cell > Format as Date)"],
      ["- ROI: Enter as decimal (0.07 = 7%) - app displays as percentage"],
      ["- Amounts: Enter numbers only, no currency symbols"],
      ["- Duration: Free text like '12 months', '1 year', '365 days'"],
      ["- To keep old FDs in Excel but not import: set Status to ARCHIVE"],
    ];
    
    // Deposits sheet - ALL supported columns with Status + INR/USD examples
    const depositsHeaders = ["Status", "Bank", "Type", "Deposit ID", "Nominee", "Start Date", "Deposit", "ROI", "Maturity Amount", "Maturity Date", "Duration", "Maturity Action", "Currency", "Category", "TDS Percent", "Auto Renewal", "Linked Account", "Notes"];
    const depositsData = [
      depositsHeaders,
      ["ACTIVE", "ICICI Bank", "Fixed Deposit", "FD123456", "Rahul Kumar", dateToExcel("2024-01-15"), 500000, 0.072, 536000, dateToExcel("2025-01-15"), "12 months", "Renew", "INR", "General Savings", 10, "Yes", "ICICI Savings A/C", "Auto renewal enabled"],
      ["ACTIVE", "SBI", "Tax Saver FD", "FD789012", "Priya Sharma", dateToExcel("2024-03-01"), 150000, 0.068, 161200, dateToExcel("2029-03-01"), "5 years", "Close", "INR", "Tax Saving", 0, "No", "", "Under 80C limit"],
      ["ACTIVE", "HDFC Bank", "SCSS", "SCSS001", "Retired Kumar", dateToExcel("2024-06-01"), 1500000, 0.082, 1623000, dateToExcel("2029-06-01"), "5 years", "Transfer", "INR", "Retirement", 10, "No", "HDFC Savings", "Senior Citizen Scheme"],
      ["ACTIVE", "Chase Bank", "Certificate of Deposit", "CD456789", "John Smith", dateToExcel("2024-02-15"), 10000, 0.045, 10450, dateToExcel("2025-02-15"), "12 months", "Renew", "USD", "Emergency Fund", 0, "Yes", "Chase Checking", "US emergency fund"],
      ["ARCHIVE", "Old Bank", "Fixed Deposit", "OLD123", "Old Nominee", dateToExcel("2020-01-01"), 100000, 0.08, 140000, dateToExcel("2025-01-01"), "5 years", "Closed", "INR", "", 0, "No", "", "This row will NOT be imported (Status=ARCHIVE)"],
    ];
    
    // Banks sheet - ALL supported columns with Status + INR/USD examples + Hidden
    const banksHeaders = ["Status", "Source", "Amount", "Type", "1st Holder", "2nd Holder", "Online", "Next Action", "ROI", "Address", "Details", "Currency", "Account Number", "IFSC Code", "Branch", "Hidden"];
    const banksData = [
      banksHeaders,
      ["ACTIVE", "HDFC Bank", 150000, "Saving", "Rahul Kumar", "Priya Kumar", "Yes", "Update KYC", 0.035, "Andheri West, Mumbai", "Primary savings account", "INR", "50100123456789", "HDFC0001234", "Andheri West", "No"],
      ["ACTIVE", "ICICI Bank", 500000, "FD", "Rahul Kumar", "", "Yes", "Check maturity", 0.072, "Bandra, Mumbai", "Fixed deposit", "INR", "157701234567", "ICIC0001234", "Bandra", "No"],
      ["ACTIVE", "SBI", 25000, "Current", "Kumar Enterprises", "", "Yes", "", 0, "Noida Sector 18", "Business account", "INR", "32105678901", "SBIN0012345", "Noida Sec 18", "No"],
      ["ACTIVE", "HDFC Bank", -45000, "Credit Card", "Rahul Kumar", "", "Yes", "Pay by 15th", 0, "", "Regalia Credit Card", "INR", "4567XXXX8901", "", "", "No"],
      ["ACTIVE", "Bank of America", 5000, "Checking", "John Smith", "Jane Smith", "Yes", "", 0.001, "NYC Manhattan", "US checking account", "USD", "1234567890", "", "Manhattan", "No"],
      ["ACTIVE", "Old PPF Account", 50000, "PPF", "Rahul Kumar", "", "No", "", 0.071, "SBI Main Branch", "Dormant PPF from 2015", "INR", "PPF123456", "", "Main Branch", "Yes"],
      ["SKIP", "Closed Bank", 0, "Saving", "Old Account", "", "No", "", 0, "", "Account closed in 2020", "INR", "", "", "", "No"],
    ];
    
    // Bills sheet - ALL supported columns with Status
    const billsHeaders = ["Status", "Name", "Frequency", "Amount", "Date", "Priority", "Phone", "Email", "Currency", "Category", "Auto Pay"];
    const billsData = [
      billsHeaders,
      ["ACTIVE", "Electricity Bill", "Monthly", 2500, "15th", "High", "1800-123-456", "support@power.com", "INR", "Utility", "No"],
      ["ACTIVE", "Internet - Airtel", "Monthly", 999, "1st", "Normal", "1800-987-654", "support@airtel.com", "INR", "Utility", "Yes"],
      ["ACTIVE", "Health Insurance", "Yearly", 25000, "2024-04-15", "High", "", "claims@insurance.com", "INR", "Insurance", "No"],
      ["ACTIVE", "Netflix", "Monthly", 15.99, "20th", "Low", "", "support@netflix.com", "USD", "Entertainment", "Yes"],
      ["SKIP", "Old Subscription", "Monthly", 0, "", "Low", "", "", "INR", "", "This row will NOT be imported"],
    ];
    
    // Helper to apply header styling (background color + borders)
    const applyHeaderStyle = (ws: any, numCols: number) => {
      const headerStyle = {
        fill: { fgColor: { rgb: "1F4E79" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };
      const cols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      for (let i = 0; i < numCols; i++) {
        const cell = cols[i] + "1";
        if (ws[cell]) {
          ws[cell].s = headerStyle;
        }
      }
    };
    
    // Create workbook
    const wb = utils.book_new();
    
    // Add Instructions sheet
    const wsInstructions = utils.aoa_to_sheet(instructionsData);
    wsInstructions['!cols'] = [{ wch: 80 }];
    utils.book_append_sheet(wb, wsInstructions, "Instructions");
    
    // Add Deposits sheet with formatting (Status is col A, so columns shift by 1)
    const wsDeposits = utils.aoa_to_sheet(depositsData);
    wsDeposits['!cols'] = [
      { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, 
      { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 30 }
    ];
    // Apply number formats to data cells (rows 2-6, columns shifted: F=StartDate, J=MaturityDate, G=Deposit, I=MaturityAmt, H=ROI)
    for (let r = 2; r <= 6; r++) {
      ['F','J'].forEach(col => { const c = col + r; if(wsDeposits[c]) wsDeposits[c].z = 'yyyy-mm-dd'; }); // Dates
      ['G','I'].forEach(col => { const c = col + r; if(wsDeposits[c]) wsDeposits[c].z = '#,##0'; }); // Amounts
      ['H'].forEach(col => { const c = col + r; if(wsDeposits[c]) wsDeposits[c].z = '0.00%'; }); // ROI as %
    }
    applyHeaderStyle(wsDeposits, depositsHeaders.length);
    utils.book_append_sheet(wb, wsDeposits, "Deposits");
    
    // Add Banks sheet with formatting (Status is col A, Amount is col C, ROI is col I, Hidden is col P)
    const wsBanks = utils.aoa_to_sheet(banksData);
    wsBanks['!cols'] = [
      { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
      { wch: 8 }, { wch: 16 }, { wch: 8 }, { wch: 22 }, { wch: 22 }, 
      { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 8 }
    ];
    for (let r = 2; r <= 8; r++) {
      ['C'].forEach(col => { const c = col + r; if(wsBanks[c]) wsBanks[c].z = '#,##0'; }); // Amounts
      ['I'].forEach(col => { const c = col + r; if(wsBanks[c]) wsBanks[c].z = '0.00%'; }); // ROI as %
    }
    applyHeaderStyle(wsBanks, banksHeaders.length);
    utils.book_append_sheet(wb, wsBanks, "Banks");
    
    // Add Bills sheet with formatting (Status is col A, Amount is col D)
    const wsBills = utils.aoa_to_sheet(billsData);
    wsBills['!cols'] = [
      { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, 
      { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 10 }
    ];
    for (let r = 2; r <= 6; r++) {
      ['D'].forEach(col => { const c = col + r; if(wsBills[c]) wsBills[c].z = '#,##0.00'; }); // Amounts (col D now due to Status)
    }
    applyHeaderStyle(wsBills, billsHeaders.length);
    utils.book_append_sheet(wb, wsBills, "Bills");
    
    // Download
    writeFile(wb, "BankRecords_Template.xlsx");
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

  // ── Derived Data (FROM ACCOUNTS ONLY) with Multi-Currency Support ─────────
  // For totals: use INR as default when in ORIGINAL mode (can't sum mixed currencies meaningfully)
  const targetCurrency = displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency;
  
  // Helper to sum amounts converting to target currency
  const sumConverted = (items: {amount?: number|string; currency?: Currency}[]) => 
    items.reduce((s, a) => s + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates), 0);
  
  const totalInvested = accounts.filter(a => a.type === "FD").reduce((s,a) => 
    s + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates), 0);
  
  const totalMaturity = accounts.filter(a => a.type === "FD").reduce((s,a) => {
    const principal = Number(a.amount) || 0;
    const roi = Number(a.roi) || 0.07;
    const maturityVal = principal * (1 + roi);
    return s + convertCurrency(maturityVal, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates);
  }, 0);
  
  const netWorthConverted = accounts.reduce((s, a) => 
    s + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates), 0);
  
  // PERF-007: Memoize derived deposit data
  const upcoming90 = useMemo(() => 
    deposits.filter(d => { 
      const x = daysUntil(d.maturityDate); 
      return x != null && x >= 0 && x <= 90 && !d.done; 
    }), [deposits]);

  const sortedDeps = useMemo(() => 
    [...deposits].sort((a, b) => 
      new Date(a.maturityDate || "2099").getTime() - new Date(b.maturityDate || "2099").getTime()
    ), [deposits]);

  // PERF-007: Memoize bank totals computation
  const bankTotals = useMemo(() => {
    const totals: Record<string, {deposited: number; maturity: number; count: number; avgRoi: number}> = {};
    deposits.forEach(d => {
      if (!d.bank) return;
      if (!totals[d.bank]) totals[d.bank] = {deposited: 0, maturity: 0, count: 0, avgRoi: 0};
      totals[d.bank].deposited += Number(d.deposit) || 0;
      totals[d.bank].maturity += Number(d.maturityAmt) || Number(d.deposit) || 0;
      totals[d.bank].count++;
      totals[d.bank].avgRoi += Number(d.roi) || 0;
    });
    Object.values(totals).forEach(b => b.avgRoi = b.avgRoi / b.count);
    return totals;
  }, [deposits]);

  const pieData = useMemo(() => 
    Object.entries(bankTotals).map(([name, v]) => ({ name, value: v.deposited, color: getBankColor(name) })),
    [bankTotals]);

  // Accounts tab: pie by bank from accounts (not deposits) so "Investment by Bank" reflects account balances
  const accountsPieData = useMemo(() => {
    const byBank: Record<string, number> = {};
    accounts.forEach(a => {
      const bank = (a.bank || '').trim() || 'Unnamed';
      const accCurrency = (a.currency && CURRENCY_SYMBOLS[a.currency as Currency]) ? a.currency as Currency : 'INR';
      const converted = convertCurrency(Number(a.amount) || 0, accCurrency, displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency as Currency, exchangeRates);
      byBank[bank] = (byBank[bank] || 0) + converted;
    });
    return Object.entries(byBank)
      .filter(([, v]) => v !== 0)
      .map(([name, value]) => ({ name, value, color: getBankColor(name) }));
  }, [accounts, displayCurrency, exchangeRates]);
  
  const typePieData = (() => {
    const banks: Record<string, number> = {};
    deposits.forEach(d => {
      const b = d.bank || 'Unknown';
      banks[b] = (banks[b] || 0) + (Number(d.deposit) || 0);
    });
    return Object.entries(banks).map(([name, value]) => ({ 
      name, 
      value, 
      color: getBankColor(name) 
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

  const mainTabs = [
    {id:"overview",  icon:"📊", label:"Overview", key:"1"},
    {id:"accounts",  icon:"🏦", label:"Accounts", key:"2"},
    {id:"deposits",  icon:"💰", label:"Deposits", key:"3"},
    {id:"bills",     icon:"📋", label:"Bills", key:"4"},
  ];
  const moreTabs = [
    {id:"timeline",  icon:"📅", label:"Timeline", key:"5"},
    {id:"actions",   icon:"⚡", label:"Actions", key:"6"},
    {id:"charts",    icon:"📈", label:"Charts", key:"7"},
  ];
  const allTabs = [...mainTabs, ...moreTabs];
  
  const banks = Array.from(new Set(deposits.map(d => d.bank).filter(Boolean)));
  const filtered = deposits.filter(d => {
    if (filterBank && filterBank !== "All" && d.bank !== filterBank) return false;
    if (search && !`${d.bank} ${d.nominee} ${d.depositId}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Maturing Soon: ONLY Fixed Deposits (deposits table) with maturityDate in next 30 days ──
  const maturingSoonDeposits: Array<{ type: 'maturity'; title: string; bank: string; date: string; days: number; amount?: string; sourceField: string }> = [];
  deposits.forEach(d => {
    if (d.done) return;
    const days = daysUntil(d.maturityDate);
    if (days !== null && days >= 0 && days <= 30) {
      maturingSoonDeposits.push({
        type: 'maturity',
        title: `${d.type || 'FD'} matures`,
        bank: d.bank,
        date: d.maturityDate,
        days,
        amount: String(d.maturityAmt),
        sourceField: 'Maturity date',
      });
    }
  });
  maturingSoonDeposits.sort((a, b) => a.days - b.days);

  // ── Actions due: action items with date in next 30 days or overdue (uses actions[].date) ──
  const actionsDue30: Array<{ type: 'action'; title: string; bank: string; date: string; days: number; sourceField: string }> = [];
  actions.forEach(a => {
    if (a.done) return;
    const days = daysUntil(a.date);
    if (days !== null && days <= 30) {
      actionsDue30.push({
        type: 'action',
        title: a.title,
        bank: a.bank || '',
        date: a.date,
        days,
        sourceField: 'Due date',
      });
    }
  });
  actionsDue30.sort((a, b) => a.days - b.days);

  // ── Legacy "Next 30 Days" combined list (deposits + actions due; no account next-actions in count) ──
  const upcoming30Days: Array<{ type: string; title: string; bank: string; date: string; days: number; amount?: string }> = [
    ...maturingSoonDeposits.map(({ type, title, bank, date, days, amount }) => ({ type, title, bank, date, days, amount })),
    ...actionsDue30.map(({ type, title, bank, date, days }) => ({ type, title, bank, date, days })),
  ];
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
    <div style={{minHeight:"100vh",background:THEME.bg,color:THEME.text,fontFamily:"'Sora','Segoe UI',sans-serif",paddingBottom:isMobile?110:48,margin:isMobile?"-0.5rem":"0",width:isMobile?"calc(100% + 1rem)":"auto"}}>
      {/* Setup Banner */}
      {showSetupBanner && (
        <div style={{background:"linear-gradient(90deg,#fef2f2,#fee2e2)",border:"1px solid #fecaca",padding:"12px 20px",margin:"16px",borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:24}}>⚠️</span>
          <div style={{flex:1}}>
            <strong style={{color:"#dc2626",display:"block",marginBottom:4}}>Database Connection Issue</strong>
            <div style={{color:"#991b1b",fontSize:13}}>
              Unable to connect to database. Run <code style={{background:"rgba(220,38,38,0.1)",padding:"2px 6px",borderRadius:4}}>supabase-bank-records.sql</code> in Supabase SQL Editor if not done already.
            </div>
          </div>
          <button onClick={()=>setShowSetupBanner(false)} style={{background:"rgba(220,38,38,0.1)",border:"none",color:"#dc2626",padding:"4px 12px",borderRadius:6,cursor:"pointer",fontSize:20}}>✕</button>
        </div>
      )}

      {/* Header - Bank Records title and buttons */}
      <div style={{background:THEME.headerBg,borderBottom:`1px solid ${THEME.border}`,padding:isMobile?"8px 10px":"12px 16px"}}>
        {/* Title Row */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:isMobile?4:10,flexShrink:0}}>
            <span style={{fontSize:isMobile?16:22}}>🦁</span>
            {!isMobile && <div style={{fontSize:15,fontWeight:700,color:"white"}}>Bank Records</div>}
            {savedMsg && <span style={{color:"#d1fae5",fontSize:11,fontWeight:600}}>✓</span>}
          </div>
          <div style={{display:"flex",gap:isMobile?4:6,alignItems:"center"}}>
            {onOpenGroupChat && (
              <button onClick={onOpenGroupChat} style={{background:"rgba(255,255,255,0.2)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:6,padding:isMobile?"5px 8px":"6px 10px",fontSize:isMobile?10:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}} title="Open Group Chat">💬{!isMobile && " Chat"}</button>
            )}
            {pendingImportsCount > 0 && (
              <button 
                onClick={() => setShowPendingImportsModal(true)} 
                style={{
                  background:"#f59e0b",
                  color:"#fff",
                  border:"none",
                  borderRadius:6,
                  padding:isMobile?"5px 8px":"6px 10px",
                  fontSize:isMobile?10:11,
                  fontWeight:600,
                  cursor:"pointer",
                  fontFamily:"inherit",
                  display:"flex",
                  alignItems:"center",
                  gap:4,
                  animation:"pulse 2s infinite"
                }} 
                title={`${pendingImportsCount} pending import(s) from screenshots`}
              >
                📊 {pendingImportsCount}
              </button>
            )}
            <button onClick={handleExportTemplate} style={{background:"rgba(255,255,255,0.15)",color:"white",border:"1px solid rgba(255,255,255,0.2)",borderRadius:6,padding:isMobile?"5px 8px":"6px 10px",fontSize:isMobile?10:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}} title="Download Template">📥</button>
            <button onClick={()=>fileRef.current?.click()} style={{background:"white",color:THEME.accent,border:"none",borderRadius:6,padding:isMobile?"5px 8px":"6px 10px",fontSize:isMobile?10:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}} title="Import Excel">📂</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleExcel(e.target.files[0]);e.target.value="";}} />
            <button onClick={handleClearAll} style={{background:"rgba(255,255,255,0.15)",color:"#fecaca",border:"1px solid rgba(255,255,255,0.2)",borderRadius:6,padding:isMobile?"5px 8px":"6px 10px",fontSize:isMobile?10:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}} title="Clear All">🗑</button>
          </div>
        </div>
        {/* Tabs - Desktop only (mobile uses bottom bar) */}
        {!isMobile && (
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginTop:8}}>
            {allTabs.map(t=>(
              <button 
                key={t.id} 
                onClick={()=>setTab(t.id)} 
                title={`Press ${t.key}`}
                style={{
                  background:tab===t.id?"white":"rgba(255,255,255,0.15)",
                  color:tab===t.id?THEME.accent:"rgba(255,255,255,0.9)",
                  border:"none",
                  padding:"7px 12px",
                  borderRadius:20,cursor:"pointer",
                  fontSize:11,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap",
                  flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:4
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{padding:isMobile?"8px 6px":"22px 28px",paddingBottom:isMobile?125:28}}>
        {/* Tab Content */}
        {tab==="overview" && (
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
                        onClick={() => { setDisplayCurrency(cur); persist(deposits, accounts, bills, actions, goals, exchangeRates, cur); }}
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
                    <div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginTop:4}}>Fixed Deposits</div>
                    <div style={{fontSize:12,color:"#3B82F6",fontFamily:"monospace",marginTop:6}}>{fmt(totalInvested, targetCurrency)}</div>
                  </div>
                  <div onClick={() => setTab("accounts")} style={{background:THEME.cardBg,borderRadius:14,padding:"16px",border:`1px solid ${THEME.border}`,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:28,fontWeight:800,color:"#10B981"}}>{accounts.length}</div>
                    <div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginTop:4}}>Accounts</div>
                    <div style={{fontSize:12,color:"#10B981",fontFamily:"monospace",marginTop:6}}>{fmt(sumConverted(accounts), targetCurrency)}</div>
                  </div>
                  <div onClick={() => setTab("bills")} style={{background:THEME.cardBg,borderRadius:14,padding:"16px",border:`1px solid ${bills.filter(b=>!b.done).length > 0 ? '#92400E' : THEME.border}`,cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:28,fontWeight:800,color:bills.filter(b=>!b.done).length > 0 ? "#F59E0B" : "#6B7280"}}>{bills.filter(b=>!b.done).length}</div>
                    <div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginTop:4}}>Bills Due</div>
                    <div style={{fontSize:12,color:"#F59E0B",fontFamily:"monospace",marginTop:6}}>{fmt(bills.filter(b=>!b.done).reduce((s,b)=>s+(Number(b.amount)||0),0), targetCurrency)}</div>
                  </div>
                  <div style={{background:THEME.cardBg,borderRadius:14,padding:"16px",border:`1px solid ${maturingSoonDeposits.length > 0 ? '#7F1D1D' : THEME.border}`,textAlign:"center"}}>
                    <div style={{fontSize:28,fontWeight:800,color:maturingSoonDeposits.length > 0 ? "#EF4444" : "#6B7280"}}>{maturingSoonDeposits.length}</div>
                    <div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginTop:4}}>Maturing Soon</div>
                    <div style={{fontSize:10,color:THEME.textLight,marginTop:6}}>FDs · Next 30 days</div>
                  </div>
                </div>

                {/* Mobile: Maturing Soon - ONLY Fixed Deposits (deposits table, maturityDate) */}
                {maturingSoonDeposits.length > 0 && (
                  <div style={{background:THEME.cardBg,borderRadius:14,padding:"14px",border:"1px solid #7F1D1D"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#EF4444",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                      <span>⚡</span> Maturing Soon ({maturingSoonDeposits.length} FD{maturingSoonDeposits.length !== 1 ? 's' : ''})
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {maturingSoonDeposits.map((d, i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:THEME.cardBgAlt,borderRadius:10,borderLeft:`3px solid ${d.days <= 7 ? '#EF4444' : '#F59E0B'}`}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:THEME.text}}>{d.bank} · {d.title}</div>
                            <div style={{fontSize:11,color:THEME.textLight}}>{d.sourceField}: {fmtDate(d.date)}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:THEME.accent}}>{d.amount ? fmt(d.amount) : '—'}</div>
                            <div style={{fontSize:10,color:d.days <= 7 ? '#EF4444' : '#F59E0B',fontWeight:600}}>
                              {d.days >= 0 ? `${d.days}d left` : `${-d.days}d overdue`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mobile: Actions due (uses actions[].date - e.g. loan payment due dates) */}
                {actionsDue30.length > 0 && (
                  <div style={{background:THEME.cardBg,borderRadius:14,padding:"14px",border:"1px solid #92400E"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#F59E0B",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                      <span>📋</span> Actions due ({actionsDue30.length})
                    </div>
                    <div style={{fontSize:10,color:THEME.textLight,marginBottom:8}}>Uses <strong>Due date</strong> from Safe → More → Actions</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {actionsDue30.map((d, i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:THEME.cardBgAlt,borderRadius:10,borderLeft:`3px solid ${d.days <= 0 ? '#EF4444' : '#F59E0B'}`}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:THEME.text}}>{d.title}</div>
                            <div style={{fontSize:11,color:THEME.textLight}}>{d.sourceField}: {fmtDate(d.date)}{d.bank ? ` · ${d.bank}` : ''}</div>
                          </div>
                          <div style={{fontSize:10,color:d.days <= 0 ? '#EF4444' : '#F59E0B',fontWeight:600}}>
                            {d.days >= 0 ? `${d.days}d left` : `${-d.days}d overdue`}
                          </div>
                        </div>
                      ))}
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
                            <span style={{fontSize:13,fontWeight:700,fontFamily:"monospace",color:"#F59E0B"}}>{fmt(b.amount)}</span>
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
                    const total = typeAmounts.reduce((s, t) => s + Math.abs(t.amount), 0);
                    
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
                    onClick={() => { setDisplayCurrency('ORIGINAL'); persist(deposits, accounts, bills, actions, goals, exchangeRates, 'ORIGINAL'); }}
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
                      onClick={() => { setDisplayCurrency(cur); persist(deposits, accounts, bills, actions, goals, exchangeRates, cur); }}
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
                <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",fontWeight:600}}>Bills Due</div>
              </div>
              <div style={{background:THEME.cardBg,borderRadius:10,padding:"10px 8px",textAlign:"center",border:`1px solid ${THEME.border}`}}>
                <div style={{fontSize:20,fontWeight:800,color:upcoming30Days.length>0?"#EF4444":THEME.textMuted}}>{upcoming30Days.length}</div>
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
              
              const segments = [
                { label: "Fixed Deposits", amount: fdTotal, color: "#3B82F6", pct: accountTotal ? (fdTotal/accountTotal)*100 : 0 },
                { label: "Savings", amount: savingsTotal, color: "#10B981", pct: accountTotal ? (savingsTotal/accountTotal)*100 : 0 },
                ...(otherTotal > 0 ? [{ label: "Other", amount: otherTotal, color: "#8B5CF6", pct: accountTotal ? (otherTotal/accountTotal)*100 : 0 }] : [])
              ];
              
              return (
                <div style={{background:THEME.cardBg,borderRadius:16,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
                  {/* Header with Total */}
                  <div style={{padding:"16px 18px",borderBottom:`1px solid ${THEME.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:11,color:THEME.textMuted,fontWeight:500,letterSpacing:"0.5px"}}>TOTAL PORTFOLIO ({displayCurrency === 'ORIGINAL' ? 'Mixed → INR' : targetCurrency})</div>
                      <div style={{fontSize:26,fontWeight:800,color:THEME.text,fontFamily:"monospace",marginTop:4}}>{fmt(accountTotal, targetCurrency)}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10,color:THEME.textMuted}}>{accounts.length} accounts</div>
                    </div>
                  </div>
                  
                  {/* Allocation Bar */}
                  {accountTotal > 0 && (
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

            {/* Next 30 Days - Collapsible */}
            {(maturingSoonDeposits.length > 0 || actionsDue30.length > 0) && (
              <div style={{background:THEME.cardBg,borderRadius:12,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
                <button 
                  onClick={()=>setShow30Days(!show30Days)} 
                  style={{width:"100%",padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                >
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:show30Days?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                    <span style={{fontSize:11,fontWeight:700,color:"#F59E0B",textTransform:"uppercase"}}>⚡ Next 30 Days</span>
                  </div>
                  <div style={{fontSize:10,color:"#6B7280",background:THEME.cardBgAlt,padding:"2px 8px",borderRadius:10}}>{maturingSoonDeposits.length} FD · {actionsDue30.length} actions</div>
                </button>
                {show30Days && (
                  <div style={{maxHeight:320,overflowY:"auto",borderTop:"1px solid #1F2937"}}>
                    {maturingSoonDeposits.length > 0 && (
                      <>
                        <div style={{padding:"8px 14px",fontSize:10,color:"#6B7280",background:"#1F2937",fontWeight:600}}>💰 Maturing Soon — from Deposits (Maturity date)</div>
                        {maturingSoonDeposits.map((item, i) => (
                          <div key={`m-${i}`} style={{padding:"10px 14px",borderBottom:"1px solid #1F2937",display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,background:"rgba(239,68,68,0.15)",color:"#EF4444"}}>💰</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:600,color:THEME.text}}>{item.title} · {item.bank}</div>
                              <div style={{fontSize:10,color:"#6B7280"}}>Maturity date: {fmtDate(item.date)}{item.amount ? ` · ${fmt(Number(item.amount))}` : ''}</div>
                            </div>
                            <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:item.days<=7?"#EF4444":"#F59E0B"}}>
                              {item.days >= 0 ? `${item.days}d left` : `${-item.days}d overdue`}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {actionsDue30.length > 0 && (
                      <>
                        <div style={{padding:"8px 14px",fontSize:10,color:"#6B7280",background:"#1F2937",fontWeight:600}}>📋 Actions due — from More → Actions (Due date)</div>
                        {actionsDue30.map((item, i) => (
                          <div key={`a-${i}`} style={{padding:"10px 14px",borderBottom:"1px solid #1F2937",display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,background:"rgba(245,158,11,0.15)",color:"#F59E0B"}}>📋</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:600,color:THEME.text}}>{item.title}</div>
                              <div style={{fontSize:10,color:"#6B7280"}}>Due date: {fmtDate(item.date)}{item.bank ? ` · ${item.bank}` : ''}</div>
                            </div>
                            <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:item.days<=0?"#EF4444":"#F59E0B"}}>
                              {item.days >= 0 ? `${item.days}d left` : `${-item.days}d overdue`}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {maturingSoonDeposits.length === 0 && actionsDue30.length === 0 && (
              <div style={{background:THEME.cardBg,borderRadius:12,padding:"16px",textAlign:"center",border:`1px solid ${THEME.border}`}}>
                <div style={{fontSize:24,marginBottom:6}}>✅</div>
                <div style={{fontSize:12,color:"#10B981",fontWeight:600}}>All Clear!</div>
                <div style={{fontSize:11,color:"#6B7280"}}>No FDs maturing and no actions due in the next 30 days</div>
              </div>
            )}

            {/* FD Projections - Theme Aligned */}
            <div style={{background:THEME.cardBg,borderRadius:16,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
              <div style={{padding:"12px 18px",borderBottom:`1px solid ${THEME.border}`}}>
                <div style={{fontSize:11,color:THEME.textMuted,fontWeight:500,letterSpacing:"0.5px"}}>FD PROJECTIONS (1 YEAR) - {displayCurrency === 'ORIGINAL' ? 'Mixed → INR' : targetCurrency}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:1,background:THEME.border}}>
                <div style={{background:THEME.cardBg,padding:"14px 16px",textAlign:"center"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}>
                    <div style={{width:8,height:8,borderRadius:2,background:"#3B82F6"}}/>
                    <span style={{fontSize:10,color:THEME.textMuted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.3px"}}>Invested</span>
                  </div>
                  <div style={{fontSize:18,fontWeight:700,color:THEME.text,fontFamily:"monospace"}}>{fmt(totalInvested, targetCurrency)}</div>
                  <div style={{fontSize:10,color:THEME.textMuted,marginTop:4}}>{accounts.filter(a=>a.type==="FD").length} FDs</div>
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
        )}
        
        {/* ══ GOALS TAB ═══════════════════════════════════════════════════ */}
        {/* ══ CHARTS TAB ════════════════════════════════════════════════ */}
        {tab === "charts" && (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* Summary insight cards */}
            {(() => {
              const totalInvested = deposits.reduce((s, d) => s + (Number(d.deposit) || 0), 0);
              const totalMaturity = deposits.reduce((s, d) => s + (Number(d.maturityAmt) || Number(d.deposit) || 0), 0);
              const nextMaturity = deposits.filter(d => d.maturityDate && !d.done).map(d => ({ date: d.maturityDate!, amt: Number(d.maturityAmt) || Number(d.deposit) || 0 })).sort((a, b) => a.date.localeCompare(b.date))[0];
              return (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:12}}>
                  <div style={{background:THEME.cardBg,borderRadius:12,padding:16,border:`1px solid ${THEME.border}`}}>
                    <div style={{fontSize:11,color:THEME.textLight,marginBottom:4}}>Total Invested</div>
                    <div style={{fontSize:18,fontWeight:800,fontFamily:"monospace",color:THEME.accent}}>{fmt(totalInvested, displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency)}</div>
                  </div>
                  <div style={{background:THEME.cardBg,borderRadius:12,padding:16,border:`1px solid ${THEME.border}`}}>
                    <div style={{fontSize:11,color:THEME.textLight,marginBottom:4}}>At Maturity</div>
                    <div style={{fontSize:18,fontWeight:800,fontFamily:"monospace",color:"#10B981"}}>{fmt(totalMaturity, displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency)}</div>
                  </div>
                  <div style={{background:THEME.cardBg,borderRadius:12,padding:16,border:`1px solid ${THEME.border}`}}>
                    <div style={{fontSize:11,color:THEME.textLight,marginBottom:4}}>Fixed Deposits</div>
                    <div style={{fontSize:18,fontWeight:800,color:THEME.text}}>{deposits.filter(d => !d.done).length}</div>
                  </div>
                  {nextMaturity && (
                    <div style={{background:THEME.cardBg,borderRadius:12,padding:16,border:`1px solid ${THEME.border}`}}>
                      <div style={{fontSize:11,color:THEME.textLight,marginBottom:4}}>Next Maturity</div>
                      <div style={{fontSize:14,fontWeight:700,color:THEME.text}}>{new Date(nextMaturity.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div style={{fontSize:12,fontFamily:"monospace",color:THEME.accent}}>{fmt(nextMaturity.amt, displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency)}</div>
                    </div>
                  )}
                </div>
              );
            })()}
            {/* ROI Comparison */}
            <div style={{background:THEME.cardBgAlt,borderRadius:14,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>📊 ROI Comparison</div>
              <div style={{fontSize:12,color:THEME.textMuted,marginBottom:16}}>Average interest rates by bank</div>
              {roiData.length === 0 ? (
                <div style={{color:THEME.textMuted,padding:20,textAlign:"center"}}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={roiData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="bank" tick={{fill:THEME.textLight,fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v => v + "%"} />
                    <Tooltip 
                      formatter={(v: any) => `${v}%`}
                      contentStyle={{background:THEME.cardBgAlt,border:"1px solid ${THEME.border}",borderRadius:8,fontSize:12}} 
                    />
                    <Bar dataKey="roi" name="ROI" radius={[6, 6, 0, 0]}>
                      {roiData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Maturity Cash Flow */}
            <div style={{background:THEME.cardBgAlt,borderRadius:14,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>📉 Maturity Cash Flow (Lakhs)</div>
              <div style={{fontSize:12,color:THEME.textMuted,marginBottom:16}}>When money becomes available month by month</div>
              {areaData.length === 0 ? (
                <div style={{color:THEME.textMuted,padding:20,textAlign:"center"}}>No maturity dates</div>
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
                    <XAxis dataKey="month" tick={{fill:THEME.textLight,fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v => v + "L"} />
                    <Tooltip 
                      formatter={(v: any) => `₹${v}L`}
                      contentStyle={{background:THEME.cardBgAlt,border:"1px solid ${THEME.border}",borderRadius:8,fontSize:12}} 
                    />
                    <Area type="monotone" dataKey="amt" stroke="#10B981" strokeWidth={2} fill="url(#colorAmt)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bank Comparison: Invested vs Maturity */}
            <div style={{background:THEME.cardBgAlt,borderRadius:14,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>💰 Invested vs Maturity</div>
              <div style={{fontSize:12,color:THEME.textMuted,marginBottom:16}}>Compare principal and maturity amounts by bank</div>
              {bankCompareData.length === 0 ? (
                <div style={{color:THEME.textMuted,padding:20,textAlign:"center"}}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={bankCompareData} barGap={4} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="bank" tick={{fill:THEME.textLight,fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v => v + "L"} />
                    <Tooltip 
                      formatter={(v: any) => `₹${v}L`}
                      contentStyle={{background:THEME.cardBgAlt,border:"1px solid ${THEME.border}",borderRadius:8,fontSize:12}} 
                    />
                    <Legend wrapperStyle={{fontSize:12,color:THEME.textLight}} />
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
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:THEME.textLight}}>
                  <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} style={{accentColor:"#3B82F6"}} />
                  Show completed
                </label>
              </div>
            </div>

            <div style={{background:THEME.cardBgAlt,borderRadius:16,padding:24,position:"relative"}}>
              <div style={{position:"absolute",left:130,top:24,bottom:24,width:2,background:"#1F2937",zIndex:0}} />
              {sortedDeps.length === 0 && <div style={{textAlign:"center",padding:40,color:THEME.textMuted}}>No deposits to show</div>}
              {sortedDeps.filter(d => showDone || !d.done).map((d, i) => {
                const origIdx = deposits.indexOf(d);
                const days = daysUntil(d.maturityDate);
                const isPast = days !== null && days < 0;
                const isDone = d.done;
                const color = getBankColor(d.bank);
                const dotColor = isDone ? "#34D399" : isPast ? THEME.border : color;
                const rowBg = isDone ? "rgba(52,211,153,0.05)" : isPast ? "rgba(55,65,81,0.1)" : days != null && days <= 90 ? "rgba(239,68,68,0.06)" : "transparent";
                
                return (
                  <div key={i} style={{display:"flex",gap:16,marginBottom:14,opacity:isDone ? 0.5 : isPast ? 0.45 : 1,position:"relative",zIndex:1,transition:"opacity 0.3s"}}>
                    <div style={{width:116,textAlign:"right",flexShrink:0,paddingTop:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:isDone ? "#34D399" : isPast ? THEME.textMuted : THEME.textLight}}>
                        {d.maturityDate ? new Date(d.maturityDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"}
                      </div>
                      <div style={{fontSize:13,fontWeight:800,color:isDone ? "#34D399" : isPast ? THEME.textMuted : "#F9FAFB"}}>
                        {d.maturityDate ? new Date(d.maturityDate).getDate() : ""}
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"flex-start",paddingTop:12,flexShrink:0}}>
                      <div style={{width:14,height:14,borderRadius:"50%",background:dotColor,border:`2px solid ${dotColor}`,boxShadow:isDone ? `0 0 10px #34D39960` : isPast ? "none" : `0 0 8px ${color}50`,transition:"all 0.3s"}} />
                    </div>
                    <div style={{flex:1,background:rowBg,border:`1px solid ${isDone ? "#dcfce7" : isPast ? "#1F2937" : days != null && days <= 90 ? "#fecaca" : "#1F2937"}`,borderRadius:14,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,transition:"all 0.3s"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontWeight:800,color:isDone ? "#6EE7B7" : "#F3F4F6",fontSize:14,textDecoration:isDone ? "line-through" : "none"}}>{d.bank}</span>
                          <span style={{fontSize:11,color:"#6B7280",background:THEME.cardBg,padding:"2px 8px",borderRadius:20}}>{d.type}</span>
                          {isDone && <span style={{fontSize:11,color:"#34D399",fontWeight:700}}>✓ Done</span>}
                        </div>
                        <div style={{fontSize:12,color:"#6B7280",marginTop:4}}>{d.nominee} {d.roi ? `· ${(Number(d.roi) * 100).toFixed(2)}% pa` : ""} {d.duration ? `· ${d.duration}` : ""}</div>
                        {d.maturityAction && <div style={{fontSize:11,color:THEME.textMuted,marginTop:3,fontStyle:"italic"}}>{d.maturityAction}</div>}
                        {d.depositId && <div style={{fontSize:10,color:THEME.border,marginTop:2,fontFamily:"monospace"}}>{d.depositId}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                        <div style={{fontFamily:"monospace",fontWeight:800,fontSize:15,color:isDone ? "#6B7280" : isPast ? "#6B7280" : "#10B981"}}>{fmt(d.maturityAmt || d.deposit)}</div>
                        {!isDone && <UrgencyBadge days={days} />}
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={() => toggleDone("deposit", origIdx)} style={{background:isDone ? "#dcfce7" : THEME.cardBgAlt,color:isDone ? "#34D399" : THEME.textLight,border:`1px solid ${isDone ? "#16a34a" : THEME.border}`,borderRadius:7,padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{isDone ? "↩ Undo" : "✓ Done"}</button>
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
                <div style={{fontSize:12,color:THEME.textMuted,marginTop:2}}>Track renewals, visits, calls</div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:THEME.textLight}}>
                  <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} style={{accentColor:"#3B82F6"}} />
                  Show completed
                </label>
                <button onClick={() => openAdd("action")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add Action</button>
              </div>
            </div>

            {actions.filter(a => showDone || !a.done).length === 0 ? (
              <div style={{background:THEME.cardBgAlt,borderRadius:12,padding:32,textAlign:"center",color:THEME.textMuted,border:"1px dashed ${THEME.border}"}}>
                No action items yet. Click "+ Add Action" to create one.
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                {actions.filter(a => showDone || !a.done).map((a, i) => {
                  const origIdx = actions.indexOf(a);
                  const days = daysUntil(a.date);
                  return (
                    <div key={i} style={{background:THEME.cardBgAlt,border:"1px solid ${THEME.border}",borderRadius:12,padding:"14px 16px",opacity:a.done ? 0.6 : 1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div style={{fontWeight:700,color:a.done ? "#6B7280" : "#F3F4F6",fontSize:14,textDecoration:a.done ? "line-through" : "none",flex:1}}>{a.title}</div>
                        <button onClick={() => toggleDone("action", origIdx)} style={{background:a.done ? "#dcfce7" : THEME.cardBgAlt,color:a.done ? "#34D399" : "#6B7280",border:`1px solid ${a.done ? "#16a34a" : THEME.border}`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontWeight:700}}>{a.done ? "↩" : "✓"}</button>
                      </div>
                      {a.bank && <div style={{fontSize:12,color:getBankColor(a.bank),fontWeight:600,marginBottom:4}}>🏦 {a.bank}</div>}
                      {a.note && <div style={{fontSize:12,color:THEME.textLight,marginBottom:6}}>{a.note}</div>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                        {a.date && <div style={{fontSize:12,color:THEME.textLight}}>{fmtDate(a.date)}</div>}
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
          const groupedDeps: Record<string, { deps: typeof filtered; indices: number[]; total: number }> = {};
          filtered.forEach((d) => {
            const origIdx = deposits.indexOf(d);
            if (!groupedDeps[d.bank]) groupedDeps[d.bank] = { deps: [], indices: [], total: 0 };
            groupedDeps[d.bank].deps.push(d);
            groupedDeps[d.bank].indices.push(origIdx);
            groupedDeps[d.bank].total += Number(d.deposit) || 0;
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
                        const color = getBankColor(d.bank);
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
                                <div style={{fontSize:15,fontWeight:700,color:THEME.text}}>{d.bank}</div>
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
                      {["Bank/ID","Type","Nominee","Invested","ROI","Maturity ₹","Start","Maturity","Duration","Action",""].map(h => (
                        <th key={h} style={{padding:"8px 10px",textAlign:"left",color:THEME.textMuted,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={11} style={{padding:32,textAlign:"center",color:THEME.textMuted}}>No deposits found</td></tr>
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
                                <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9}}>{isSingleRow ? (singleDep?.duration || "—") : "—"}</td>
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
                                return (
                                  <tr key={`${bankName}-${j}`} style={{borderBottom:`1px solid ${THEME.border}`,background:d.done ? "rgba(46,160,67,0.05)" : days != null && days < 0 ? "rgba(110,118,129,0.1)" : days != null && days <= 90 ? "rgba(248,81,73,0.05)" : "transparent",opacity:d.done ? 0.6 : 1}}>
                                    <td style={{padding:"8px 10px",paddingLeft:32}}>
                                      <div style={{fontSize:9,color:"#484F58",fontFamily:"monospace"}}>{d.depositId || "—"}</div>
                                    </td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:10}}>{d.type || "FD"}</td>
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
                                    <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9}}>{d.duration || "—"}</td>
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
                      {["Bank","ID","Type","Nominee","Invested","ROI","Maturity ₹","Start","Maturity","Duration","Action",""].map(h => (
                        <th key={h} style={{padding:"8px 10px",textAlign:"left",color:THEME.textMuted,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={12} style={{padding:32,textAlign:"center",color:THEME.textMuted}}>No deposits found</td></tr>
                      ) : (
                        filtered.map((d, idx) => {
                          const origIdx = deposits.indexOf(d);
                          const days = daysUntil(d.maturityDate);
                          const color = getBankColor(d.bank);
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
                              <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9}}>{d.duration || "—"}</td>
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
                                <div style={{fontSize:14,fontWeight:700,color:"#F3F4F6"}}>{bankName}</div>
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

              {/* By Bank Chart - Below data */}
              <div style={{background:THEME.cardBg,borderRadius:12,border:`1px solid ${THEME.border}`,padding:14,marginTop:16}}>
                <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:10}}>🏦 Deposits by Bank</div>
                {typePieData.length === 0 ? (
                  <div style={{color:THEME.textMuted,padding:20,textAlign:"center"}}>No data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie 
                          data={typePieData} 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={60} 
                          paddingAngle={3} 
                          dataKey="value"
                          label={({name, percent}) => `${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {typePieData.map((e, i) => <Cell key={i} fill={e.color} stroke="#111827" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip 
                          formatter={(v: any) => fmt(v)} 
                          contentStyle={{background:THEME.cardBgAlt,border:"1px solid ${THEME.border}",borderRadius:8,fontSize:12}} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <button 
                      onClick={() => setShowLegend(prev => prev.has('dep_type') ? new Set([...prev].filter(k => k !== 'dep_type')) : new Set([...prev, 'dep_type']))}
                      style={{marginTop:6,background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,color:THEME.textLight,padding:"4px 12px",borderRadius:6,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
                    >
                      <span style={{fontSize:10,transition:"transform 0.2s",transform:showLegend.has('dep_type')?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                      Legend ({typePieData.length})
                    </button>
                    {showLegend.has('dep_type') && (
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                        {typePieData.map((e, i) => {
                          const total = typePieData.reduce((s, x) => s + x.value, 0);
                          const pct = total ? (e.value / total) * 100 : 0;
                          return (
                            <div key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,background:THEME.cardBgAlt,padding:"3px 8px",borderRadius:12}}>
                              <div style={{width:8,height:8,borderRadius:"50%",background:e.color}} />
                              <span style={{color:"#D1D5DB"}}>{e.name}</span>
                              <span style={{color:e.color,fontWeight:600}}>{fmt(e.value)}</span>
                              <span style={{color:THEME.textLight,fontSize:10}}>({pct.toFixed(1)}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
              </>
              )}
            </div>
          );
        })()}

        {/* ══ ACCOUNTS TAB - Grouped by Bank (Collapsible) ═══════════════ */}
        {tab === "accounts" && (() => {
          // Separate visible and hidden accounts
          const hiddenAccounts = accounts.filter(acc => acc.hidden && !showAllAccounts);
          const visibleAccounts = showAllAccounts ? accounts : accounts.filter(acc => !acc.hidden);
          const hiddenCount = accounts.filter(acc => acc.hidden).length;
          
          // Calculate aggregated hidden accounts total
          const hiddenTotal = hiddenAccounts.reduce((sum, acc) => {
            const accCurrency = (acc.currency && CURRENCY_SYMBOLS[acc.currency as Currency]) ? acc.currency as Currency : 'INR';
            return sum + convertCurrency(Number(acc.amount) || 0, accCurrency, displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency as Currency, exchangeRates);
          }, 0);
          
          // Group accounts by bank name - track currencies for mixed mode
          const grouped: Record<string, { accounts: typeof accounts; indices: number[]; total: number; sortTotal: number; currencies: Set<string>; dominantCurrency: Currency; hasHidden?: boolean }> = {};
          visibleAccounts.forEach((acc) => {
            const origIdx = accounts.indexOf(acc);
            const accCurrency = (acc.currency && CURRENCY_SYMBOLS[acc.currency as Currency]) ? acc.currency as Currency : 'INR';
            if (!grouped[acc.bank]) grouped[acc.bank] = { accounts: [], indices: [], total: 0, sortTotal: 0, currencies: new Set(), dominantCurrency: accCurrency };
            grouped[acc.bank].accounts.push(acc);
            grouped[acc.bank].indices.push(origIdx);
            grouped[acc.bank].currencies.add(accCurrency);
            if (acc.hidden) grouped[acc.bank].hasHidden = true;
            
            // sortTotal: always convert to INR for proper sorting comparison
            grouped[acc.bank].sortTotal += convertCurrency(Number(acc.amount) || 0, accCurrency, 'INR', exchangeRates);
            
            // total: for display - raw in ORIGINAL mode, converted otherwise
            if (displayCurrency === 'ORIGINAL') {
              grouped[acc.bank].total += Number(acc.amount) || 0;
            } else {
              grouped[acc.bank].total += convertCurrency(Number(acc.amount) || 0, accCurrency, displayCurrency, exchangeRates);
            }
          });
          
          // Determine dominant currency for each bank (for ORIGINAL mode display)
          Object.values(grouped).forEach(g => {
            if (g.currencies.size === 1) {
              g.dominantCurrency = Array.from(g.currencies)[0] as Currency;
            } else {
              // Mixed currencies - find the one with highest total value (converted to INR)
              const byAmount: Record<string, number> = {};
              g.accounts.forEach(acc => {
                const cur = (acc.currency && CURRENCY_SYMBOLS[acc.currency as Currency]) ? acc.currency : 'INR';
                byAmount[cur] = (byAmount[cur] || 0) + convertCurrency(Number(acc.amount) || 0, cur as Currency, 'INR', exchangeRates);
              });
              g.dominantCurrency = Object.entries(byAmount).sort((a, b) => b[1] - a[1])[0]?.[0] as Currency || 'INR';
            }
          });
          
          // Sort by converted total (INR) for proper comparison across currencies
          const bankNames = Object.keys(grouped).sort((a, b) => grouped[b].sortTotal - grouped[a].sortTotal);
          
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
              {/* ═══ MOBILE ACCOUNTS VIEW ═══ */}
              {isMobile ? (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {/* Mobile: Summary Header */}
                  <div style={{background:THEME.headerBg,borderRadius:14,padding:"16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:500}}>NET BALANCE {!showAllAccounts && hiddenCount > 0 && `(${visibleAccounts.length} active)`}</div>
                        <div style={{fontSize:24,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{fmt(sumConverted(visibleAccounts), targetCurrency)}</div>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        {(['INR', 'USD'] as const).map(cur => (
                          <button
                            key={cur}
                            onClick={() => { setDisplayCurrency(cur); persist(deposits, accounts, bills, actions, goals, exchangeRates, cur); }}
                            style={{
                              background: displayCurrency === cur ? '#10B981' : 'rgba(255,255,255,0.1)',
                              color: displayCurrency === cur ? '#FFF' : '#94A3B8',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: 16,
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            {CURRENCY_SYMBOLS[cur]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Show All / Active Toggle */}
                    {hiddenCount > 0 && (
                      <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8}}>
                        <button
                          onClick={() => setShowAllAccounts(!showAllAccounts)}
                          style={{
                            background: showAllAccounts ? '#0D9488' : 'rgba(255,255,255,0.1)',
                            color: showAllAccounts ? '#FFF' : '#94A3B8',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: 16,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {showAllAccounts ? `👁 All (${accounts.length})` : `👁 Show All (+${hiddenCount} hidden)`}
                        </button>
                        {!showAllAccounts && hiddenTotal > 0 && (
                          <span style={{fontSize:11,color:"#6B7280"}}>Hidden: {fmt(hiddenTotal, targetCurrency)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Mobile: Bank List with Inline Accounts - Vertical Layout */}
                  {visibleAccounts.length === 0 && hiddenAccounts.length === 0 ? (
                    <div style={{padding:40,textAlign:"center",color:"#6B7280"}}>No accounts found</div>
                  ) : visibleAccounts.length === 0 && !showAllAccounts ? (
                    <div style={{padding:40,textAlign:"center",color:"#6B7280"}}>
                      <div style={{fontSize:14,marginBottom:8}}>All accounts are hidden</div>
                      <button onClick={() => setShowAllAccounts(true)} style={{background:"#0D9488",color:"#FFF",border:"none",padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"}}>Show All Accounts</button>
                    </div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {bankNames.map(bankName => {
                        const { total, currencies, dominantCurrency, accounts: bankAccounts, indices } = grouped[bankName];
                        const color = getBankColor(bankName);
                        const headerCurrency = displayCurrency === 'ORIGINAL' ? dominantCurrency : displayCurrency as Currency;
                        const isExpanded = expandedBanks.has(bankName);
                        
                        return (
                          <div key={bankName}>
                            {/* Bank Header Row */}
                            <button 
                              onClick={() => toggleBank(bankName)}
                              style={{
                                width: "100%",
                                background: isExpanded ? `${color}10` : THEME.cardBg,
                                color: THEME.text,
                                borderTop: `1px solid ${isExpanded ? color : THEME.border}`,
                                borderRight: `1px solid ${isExpanded ? color : THEME.border}`,
                                borderBottom: `1px solid ${isExpanded ? color : THEME.border}`,
                                borderLeft: `4px solid ${color}`,
                                borderRadius: isExpanded ? "10px 10px 0 0" : 10,
                                padding: "14px 16px",
                                fontSize: 14,
                                fontWeight: 600,
                                textAlign: "left",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                              }}
                            >
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <span style={{fontSize:11,color:"#6B7280",transition:"transform 0.2s",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                                <div style={{width:10,height:10,borderRadius:"50%",background:color}} />
                                <div>
                                  <div>{bankName}</div>
                                  <div style={{fontSize:11,color:"#6B7280",fontWeight:500}}>{bankAccounts.length} account{bankAccounts.length > 1 ? "s" : ""}</div>
                                </div>
                              </div>
                              <div style={{fontSize:16,fontFamily:"monospace",fontWeight:700,color:THEME.text}}>{fmt(total, headerCurrency)}</div>
                            </button>
                            
                            {/* Expanded Accounts for this Bank */}
                            {isExpanded && (
                              <div style={{background:THEME.cardBg,borderLeft:`4px solid ${color}`,borderRight:`1px solid ${color}`,borderBottom:`1px solid ${color}`,borderRadius:"0 0 10px 10px",padding:"8px"}}>
                                {bankAccounts.map((acc, j) => {
                                  const origIdx = indices[j];
                                  const typeColor = acc.type === "FD" ? "#3B82F6" : acc.type === "Saving" ? "#10B981" : acc.type === "Credit Card" ? "#EF4444" : acc.type === "Loan" ? "#F59E0B" : "#8B5CF6";
                                  const accCurrency = (acc.currency || 'INR') as Currency;
                                  const isNegative = Number(acc.amount) < 0;
                                  
                                  return (
                                    <div 
                                      key={j}
                                      style={{
                                        background:THEME.cardBgAlt,
                                        borderRadius:10,
                                        padding:"12px",
                                        marginBottom: j < bankAccounts.length - 1 ? 8 : 0,
                                        opacity: acc.done ? 0.6 : 1
                                      }}
                                    >
                                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                                        <div style={{flex:1}}>
                                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                                            <span style={{background:`${typeColor}20`,color:typeColor,padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>{acc.type}</span>
                                            {acc.online === "Yes" && <span style={{fontSize:9,color:"#34D399"}}>🌐</span>}
                                            {acc.done && <span style={{fontSize:9,color:"#34D399"}}>✓</span>}
                                            {acc.hidden && <span style={{background:THEME.border,color:THEME.textLight,padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>Hidden</span>}
                                          </div>
                                          {acc.holders && <div style={{fontSize:11,color:THEME.textLight}}>👤 {acc.holders}</div>}
                                        </div>
                                        <div style={{textAlign:"right"}}>
                                          <div style={{fontSize:18,fontWeight:800,fontFamily:"monospace",color:isNegative ? "#EF4444" : THEME.text}}>{fmt(acc.amount, accCurrency)}</div>
                                          {acc.roi && <div style={{fontSize:10,color:THEME.accent}}>{(Number(acc.roi) * 100).toFixed(2)}%</div>}
                                        </div>
                                      </div>
                                      
                                      {acc.nextAction && !acc.done && (
                                        <div style={{marginTop:8,padding:"6px 8px",background:"#F59E0B15",borderRadius:6,color:"#F59E0B",fontSize:11,fontWeight:600}}>
                                          ⚡ {acc.nextAction}
                                        </div>
                                      )}
                                      
                                      {/* Mobile: Action Buttons */}
                                      <div style={{display:"flex",gap:6,marginTop:10,paddingTop:10,borderTop:`1px solid ${THEME.border}`}}>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); toggleDone("account", origIdx); }} 
                                          style={{flex:1,background:acc.done ? "#dcfce7" : THEME.cardBgAlt,color:acc.done ? "#34D399" : THEME.textLight,border:"none",borderRadius:6,padding:"8px",fontSize:11,fontWeight:600}}
                                        >
                                          {acc.done ? "↩ Undo" : "✓ Done"}
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); openEdit("account", origIdx); }} 
                                          style={{background:"#1D4ED820",color:"#60A5FA",border:"none",borderRadius:6,padding:"8px 12px",fontSize:11}}
                                        >✏️</button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); deleteRow("account", origIdx); }} 
                                          style={{background:"#7F1D1D20",color:"#FCA5A5",border:"none",borderRadius:6,padding:"8px 12px",fontSize:11}}
                                        >🗑</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Aggregated Hidden Accounts Card (when not showing all) */}
                      {!showAllAccounts && hiddenCount > 0 && (
                        <div style={{marginTop:8}}>
                          <button 
                            onClick={() => setShowAllAccounts(true)}
                            style={{
                              width: "100%",
                              background: THEME.cardBgAlt,
                              color: THEME.textMuted,
                              border: `1px dashed ${THEME.border}`,
                              borderRadius: 10,
                              padding: "14px 16px",
                              fontSize: 14,
                              fontWeight: 600,
                              textAlign: "left",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              cursor: "pointer"
                            }}
                          >
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:10,height:10,borderRadius:"50%",background:THEME.border}} />
                              <div>
                                <div>Other Accounts</div>
                                <div style={{fontSize:11,color:THEME.textMuted,fontWeight:500}}>{hiddenCount} hidden account{hiddenCount > 1 ? "s" : ""} · Tap to show</div>
                              </div>
                            </div>
                            <div style={{fontSize:16,fontFamily:"monospace",fontWeight:700,color:THEME.textMuted}}>{fmt(hiddenTotal, targetCurrency)}</div>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                {/* Mobile: Accounts by Bank - pie chart + list at end of Accounts tab */}
                {accountsPieData.length > 0 && (
                  <div style={{background:THEME.cardBg,borderRadius:14,padding:"14px",marginTop:12,border:`1px solid ${THEME.border}`}}>
                    <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:10}}>🏦 Accounts by Bank</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={accountsPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={62}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => (percent != null && percent >= 0.10) ? `${name} ${(percent * 100).toFixed(0)}%` : null}
                          labelLine={({ percent }) => (percent != null && percent >= 0.10)}
                        >
                          {accountsPieData.map((e, i) => <Cell key={i} fill={e.color} stroke="#111827" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,borderRadius:8,fontSize:12}}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0].payload as { name: string; value: number };
                            const total = accountsPieData.reduce((s, e) => s + e.value, 0);
                            const pct = total ? (p.value / total) * 100 : 0;
                            const cur = displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency;
                            return (
                              <div style={{padding:6,minWidth:120}}>
                                <div style={{fontWeight:700,color:THEME.text,fontSize:12}}>{p.name}</div>
                                <div style={{fontSize:12,fontFamily:"monospace"}}>{fmt(p.value, cur)}</div>
                                <div style={{fontSize:10,color:THEME.textLight}}>{(pct).toFixed(1)}%</div>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <button type="button" onClick={() => setShowLegend(prev => prev.has('accounts_pie_mob') ? new Set([...prev].filter(k => k !== 'accounts_pie_mob')) : new Set([...prev, 'accounts_pie_mob']))} style={{marginTop:10,background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,color:THEME.textLight,padding:"6px 12px",borderRadius:8,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,transition:"transform 0.2s",transform:showLegend.has('accounts_pie_mob')?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                      Banks ({accountsPieData.length})
                    </button>
                    {showLegend.has('accounts_pie_mob') && (
                    <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:220,overflowY:"auto",marginTop:10}}>
                      {accountsPieData.map((e, i) => {
                        const total = accountsPieData.reduce((s, x) => s + x.value, 0);
                        const pct = total ? (e.value / total) * 100 : 0;
                        return (
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,background:THEME.cardBgAlt,padding:"8px 10px",borderRadius:8,borderLeft:`4px solid ${e.color}`}}>
                            <div style={{width:10,height:10,borderRadius:"50%",background:e.color,flexShrink:0}} />
                            <span style={{color:THEME.text,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</span>
                            <span style={{color:e.color,fontWeight:600,fontSize:12}}>{fmt(e.value, displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency)} <span style={{fontSize:10,color:THEME.textLight}}>({pct.toFixed(1)}%)</span></span>
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                )}
                </div>
              ) : (
              /* ═══ DESKTOP ACCOUNTS VIEW ═══ */
              <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  {/* View Mode Toggle */}
                  <div style={{display:"flex",gap:1,background:THEME.cardBg,borderRadius:6,padding:2,border:`1px solid ${THEME.border}`}}>
                    <button
                      onClick={() => setAccountsViewMode('cards')}
                      style={{background:accountsViewMode === 'cards' ? '#238636' : 'transparent',color:accountsViewMode === 'cards' ? '#FFF' : '#6B7280',border:'none',padding:'4px 10px',borderRadius:4,fontSize:10,fontWeight:600,cursor:'pointer'}}
                      title="Card view grouped by bank"
                    >
                      ▦ Cards
                    </button>
                    <button
                      onClick={() => setAccountsViewMode('grouped')}
                      style={{background:accountsViewMode === 'grouped' ? '#238636' : 'transparent',color:accountsViewMode === 'grouped' ? '#FFF' : '#6B7280',border:'none',padding:'4px 10px',borderRadius:4,fontSize:10,fontWeight:600,cursor:'pointer'}}
                      title="Grid view grouped by bank"
                    >
                      ▤ By Bank
                    </button>
                    <button
                      onClick={() => setAccountsViewMode('flat')}
                      style={{background:accountsViewMode === 'flat' ? '#238636' : 'transparent',color:accountsViewMode === 'flat' ? '#FFF' : '#6B7280',border:'none',padding:'4px 10px',borderRadius:4,fontSize:10,fontWeight:600,cursor:'pointer'}}
                      title="Flat grid view - all rows"
                    >
                      ≡ All
                    </button>
                  </div>
                  {accountsViewMode === 'cards' && (
                    <button 
                      onClick={() => setExpandedBanks(expandedBanks.size === bankNames.length ? new Set() : new Set(bankNames))}
                      style={{background:THEME.cardBgAlt,color:THEME.textMuted,border:`1px solid ${THEME.border}`,borderRadius:6,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}
                    >
                      {expandedBanks.size === bankNames.length ? "Collapse All" : "Expand All"}
                    </button>
                  )}
                  <div style={{display:"flex",gap:2}}>
                    <button
                      onClick={() => { setDisplayCurrency('ORIGINAL'); persist(deposits, accounts, bills, actions, goals, exchangeRates, 'ORIGINAL'); }}
                      style={{
                        background: displayCurrency === 'ORIGINAL' ? THEME.accent : THEME.cardBgAlt,
                        color: displayCurrency === 'ORIGINAL' ? '#FFFFFF' : '#6B7280',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Mixed
                    </button>
                    {(['INR', 'USD'] as const).map(cur => (
                      <button
                        key={cur}
                        onClick={() => { setDisplayCurrency(cur); persist(deposits, accounts, bills, actions, goals, exchangeRates, cur); }}
                        style={{
                          background: displayCurrency === cur ? THEME.accent : THEME.cardBgAlt,
                          color: displayCurrency === cur ? '#FFFFFF' : '#6B7280',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {CURRENCY_SYMBOLS[cur]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowRatesModal(true)}
                    style={{background:THEME.cardBgAlt,color:"#6B7280",border:`1px solid ${THEME.border}`,borderRadius:4,padding:"3px 8px",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}
                    title="Edit exchange rates"
                  >
                    <span>$1=₹{exchangeRates.USD}</span>
                  </button>
                  {/* Show All / Active Accounts Toggle */}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => setShowAllAccounts(!showAllAccounts)}
                      style={{
                        background: showAllAccounts ? '#0D9488' : THEME.cardBgAlt,
                        color: showAllAccounts ? '#FFF' : THEME.textMuted,
                        border: `1px solid ${THEME.border}`,
                        padding: '4px 12px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      {showAllAccounts ? `👁 All (${accounts.length})` : `👁 Active (${visibleAccounts.length})`}
                      {!showAllAccounts && <span style={{color:"#6B7280"}}>+{hiddenCount}</span>}
                    </button>
                  )}
                </div>
                <button onClick={() => openAdd("account")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Account</button>
              </div>
              {visibleAccounts.length === 0 && hiddenCount === 0 ? (
                <EmptyState icon="🏦" title="No Bank Accounts" description="Add your bank accounts to track balances and pending actions" action="+ Add Account" onAction={() => openAdd("account")} />
              ) : visibleAccounts.length === 0 && !showAllAccounts ? (
                <div style={{textAlign:"center",padding:40,background:THEME.cardBgAlt,borderRadius:12,border:`1px solid ${THEME.border}`}}>
                  <div style={{fontSize:14,color:THEME.textLight,marginBottom:12}}>All {hiddenCount} account{hiddenCount > 1 ? "s are" : " is"} hidden</div>
                  <button onClick={() => setShowAllAccounts(true)} style={{background:"#0D9488",color:"#FFF",border:"none",padding:"8px 20px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"}}>Show All Accounts</button>
                </div>
              ) : (
                <>
                  {/* ═══ GROUPED GRID VIEW - By Bank ═══ */}
                  {accountsViewMode === 'grouped' && (
                    <div style={{background:THEME.cardBgAlt,borderRadius:12,overflow:"hidden",border:`1px solid ${THEME.border}`,marginBottom:16}}>
                      <div style={{overflowX:"auto",scrollbarWidth:"thin",scrollbarColor:`${THEME.border} ${THEME.bg}`}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                          <thead><tr style={{background:THEME.cardBg,borderBottom:`1px solid ${THEME.border}`}}>
                            {["Bank","Type","Holders","Amount","Currency","ROI","A/C Number","IFSC","Branch","Online","Address","Details","Action",""].map(h => (
                              <th key={h} style={{padding:"8px 10px",textAlign:"left",color:THEME.textMuted,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {bankNames.map(bankName => {
                              const { accounts: bankAccounts, indices, total: totalBalance, currencies, dominantCurrency, sortTotal } = grouped[bankName];
                              const color = getBankColor(bankName);
                              const isExpanded = expandedBanks.has(`acc_grid_${bankName}`);
                              const isMixedCurrency = currencies.size > 1;
                              const headerCurrency = displayCurrency === 'ORIGINAL' ? dominantCurrency : displayCurrency;
                              const isSingleRow = bankAccounts.length === 1;
                              const singleAcc = isSingleRow ? bankAccounts[0] : null;
                              const singleAccCurrency = singleAcc ? ((singleAcc.currency || 'INR') as Currency) : 'INR';
                              const singleTypeColor = singleAcc?.type === "FD" ? "#3B82F6" : singleAcc?.type === "Saving" ? "#10B981" : singleAcc?.type === "Credit Card" ? "#EF4444" : singleAcc?.type === "Loan" ? "#F59E0B" : "#8B5CF6";
                              // Find common values across all accounts in this bank
                              const commonType = bankAccounts.every(a => a.type === bankAccounts[0]?.type) ? bankAccounts[0]?.type : null;
                              const commonHolders = bankAccounts.every(a => a.holders === bankAccounts[0]?.holders) ? bankAccounts[0]?.holders : null;
                              
                              const toggleGridBank = () => {
                                setExpandedBanks(prev => {
                                  const next = new Set(prev);
                                  const key = `acc_grid_${bankName}`;
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  return next;
                                });
                              };
                              
                              return (
                                <React.Fragment key={bankName}>
                                  {/* Bank Header Row - Clickable - Shows details if single row or common fields */}
                                  <tr 
                                    onClick={toggleGridBank}
                                    style={{background:`${color}15`,cursor:"pointer",borderBottom:`1px solid ${THEME.border}`}}
                                  >
                                    <td style={{padding:"8px 10px"}}>
                                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                                        <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                                        <div style={{width:10,height:10,borderRadius:"50%",background:color}} />
                                        <span style={{fontWeight:700,color:THEME.text,fontSize:12}}>{bankName || 'Unnamed'}</span>
                                        <span style={{color:"#6B7280",fontSize:10}}>({bankAccounts.length} acc{bankAccounts.length > 1 ? "s" : ""})</span>
                                        {isMixedCurrency && displayCurrency === 'ORIGINAL' && <span style={{fontSize:9,color:"#6B7280"}}>🌐 ({Array.from(currencies).join('+')})</span>}
                                      </div>
                                    </td>
                                    <td style={{padding:"8px 10px"}}>
                                      {isSingleRow ? (
                                        <span style={{background:`${singleTypeColor}20`,color:singleTypeColor,padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:700}}>{singleAcc?.type || "—"}</span>
                                      ) : (commonType ? <span style={{color:THEME.textLight,fontSize:10}}>{commonType}</span> : "—")}
                                    </td>
                                    <td style={{padding:"8px 10px",color:THEME.text,fontSize:10,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}}>{isSingleRow ? (singleAcc?.holders || "—") : (commonHolders || (bankAccounts.length > 1 ? "Various" : "—"))}</td>
                                    <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:700,color:THEME.text,fontSize:11}}>{fmt(totalBalance, isSingleRow ? singleAccCurrency : headerCurrency)}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9}}>{isSingleRow ? singleAccCurrency : (isMixedCurrency ? "Mixed" : headerCurrency)}</td>
                                    <td style={{padding:"8px 10px",fontFamily:"monospace",color:THEME.accent,fontWeight:600,fontSize:10}}>{isSingleRow && singleAcc?.roi ? (Number(singleAcc.roi) * 100).toFixed(2) + "%" : "—"}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,fontFamily:"monospace"}}>{isSingleRow ? (singleAcc?.accountNumber || "—") : "—"}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,fontFamily:"monospace"}}>{isSingleRow ? (singleAcc?.ifscCode || "—") : "—"}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>{isSingleRow ? (singleAcc?.branch || "—") : "—"}</td>
                                    <td style={{padding:"8px 10px"}}>{isSingleRow && singleAcc?.online && <span style={{fontSize:9,color:singleAcc.online === "Yes" ? "#34D399" : "#6B7280",background:singleAcc.online === "Yes" ? "#064E3B30" : "${THEME.border}40",padding:"2px 4px",borderRadius:3}}>{singleAcc.online === "Yes" ? "🌐" : "—"}</span>}</td>
                                    <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>{isSingleRow ? (singleAcc?.address || "—") : "—"}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>{isSingleRow ? (singleAcc?.detail || "—") : "—"}</td>
                                    <td style={{padding:"8px 10px",color:isSingleRow && singleAcc?.nextAction && !singleAcc.done ? "#F59E0B" : "#6B7280",fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",fontWeight:isSingleRow && singleAcc?.nextAction && !singleAcc.done ? 600 : 400}}>{isSingleRow ? (singleAcc?.nextAction ? (singleAcc.done ? "✓ " : "⚡ ") + singleAcc.nextAction : "—") : "—"}</td>
                                    <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                                      {isSingleRow && (
                                        <>
                                          <button onClick={(e) => { e.stopPropagation(); toggleDone("account", indices[0]); }} style={{background:singleAcc?.done ? "#238636" : THEME.cardBgAlt,color:singleAcc?.done ? "#fff" : THEME.textMuted,border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3,fontWeight:600}}>{singleAcc?.done ? "↩" : "✓"}</button>
                                          <button onClick={(e) => { e.stopPropagation(); openEdit("account", indices[0]); }} style={{background:THEME.cardBgAlt,color:"#2563eb",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3}}>✏️</button>
                                          <button onClick={(e) => { e.stopPropagation(); deleteRow("account", indices[0]); }} style={{background:THEME.cardBgAlt,color:"#F85149",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer"}}>🗑</button>
                                        </>
                                      )}
                                    </td>
                                  </tr>
                                  
                                  {/* Account Rows - Show when expanded */}
                                  {isExpanded && bankAccounts.map((acc, j) => {
                                    const origIdx = indices[j];
                                    const typeColor = acc.type === "FD" ? "#3B82F6" : acc.type === "Saving" ? "#10B981" : acc.type === "Credit Card" ? "#EF4444" : acc.type === "Loan" ? "#F59E0B" : "#8B5CF6";
                                    const accCurrency = (acc.currency || 'INR') as Currency;
                                    return (
                                      <tr key={`${bankName}-${j}`} style={{borderBottom:`1px solid ${THEME.border}`,background:acc.done ? "rgba(46,160,67,0.05)" : "transparent",opacity:acc.done ? 0.6 : 1}}>
                                        <td style={{padding:"8px 10px",paddingLeft:32,color:"#6B7280",fontSize:10}}>—</td>
                                        <td style={{padding:"8px 10px"}}>
                                          <span style={{background:`${typeColor}20`,color:typeColor,padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:700}}>{acc.type || "—"}</span>
                                        </td>
                                        <td style={{padding:"8px 10px",color:THEME.text,fontSize:10,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.holders}>{acc.holders || "—"}</td>
                                        <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:600,color:acc.done ? "#6B7280" : THEME.text,fontSize:11}}>{fmt(acc.amount, accCurrency)}</td>
                                        <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9}}>{accCurrency}</td>
                                        <td style={{padding:"8px 10px",fontFamily:"monospace",color:THEME.accent,fontWeight:600,fontSize:10}}>{acc.roi ? (Number(acc.roi) * 100).toFixed(2) + "%" : "—"}</td>
                                        <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,fontFamily:"monospace"}}>{acc.accountNumber || "—"}</td>
                                        <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,fontFamily:"monospace"}}>{acc.ifscCode || "—"}</td>
                                        <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.branch}>{acc.branch || "—"}</td>
                                        <td style={{padding:"8px 10px"}}>
                                          {acc.online && <span style={{fontSize:9,color:acc.online === "Yes" ? "#34D399" : "#6B7280",background:acc.online === "Yes" ? "#064E3B30" : "${THEME.border}40",padding:"2px 4px",borderRadius:3}}>{acc.online === "Yes" ? "🌐" : "—"}</span>}
                                        </td>
                                        <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.address}>{acc.address || "—"}</td>
                                        <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.detail}>{acc.detail || "—"}</td>
                                        <td style={{padding:"8px 10px",color:acc.nextAction && !acc.done ? "#F59E0B" : "#6B7280",fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",fontWeight:acc.nextAction && !acc.done ? 600 : 400}} title={acc.nextAction}>{acc.nextAction ? (acc.done ? "✓ " : "⚡ ") + acc.nextAction : "—"}</td>
                                        <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                                          <button onClick={(e) => { e.stopPropagation(); toggleDone("account", origIdx); }} style={{background:acc.done ? "#238636" : THEME.cardBgAlt,color:acc.done ? "#fff" : THEME.textMuted,border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3,fontWeight:600}}>{acc.done ? "↩" : "✓"}</button>
                                          <button onClick={(e) => { e.stopPropagation(); openEdit("account", origIdx); }} style={{background:THEME.cardBgAlt,color:"#2563eb",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3}}>✏️</button>
                                          <button onClick={(e) => { e.stopPropagation(); deleteRow("account", origIdx); }} style={{background:THEME.cardBgAlt,color:"#F85149",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer"}}>🗑</button>
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
                  )}
                  
                  {/* ═══ FLAT GRID VIEW - All Rows ═══ */}
                  {accountsViewMode === 'flat' && (
                    <div style={{background:THEME.cardBgAlt,borderRadius:12,overflow:"hidden",border:`1px solid ${THEME.border}`,marginBottom:16}}>
                      <div style={{overflowX:"auto",scrollbarWidth:"thin",scrollbarColor:`${THEME.border} ${THEME.bg}`}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                          <thead><tr style={{background:THEME.cardBg,borderBottom:`1px solid ${THEME.border}`}}>
                            {["Bank","Type","Holders","Amount","Currency","ROI","A/C Number","IFSC","Branch","Online","Address","Details","Action",""].map(h => (
                              <th key={h} style={{padding:"8px 10px",textAlign:"left",color:THEME.textMuted,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {visibleAccounts.length === 0 ? (
                              <tr><td colSpan={14} style={{padding:32,textAlign:"center",color:THEME.textMuted}}>No accounts found</td></tr>
                            ) : (
                              <>
                                {visibleAccounts.map((acc) => {
                                  const idx = accounts.indexOf(acc);
                                  const color = getBankColor(acc.bank);
                                  const typeColor = acc.type === "FD" ? "#3B82F6" : acc.type === "Saving" ? "#10B981" : acc.type === "Credit Card" ? "#EF4444" : acc.type === "Loan" ? "#F59E0B" : "#8B5CF6";
                                  const accCurrency = (acc.currency || 'INR') as Currency;
                                  return (
                                    <tr key={idx} style={{borderBottom:`1px solid ${THEME.border}`,background:acc.done ? "rgba(46,160,67,0.05)" : acc.hidden ? "rgba(100,116,139,0.05)" : "transparent",opacity:acc.done ? 0.6 : 1}}>
                                      <td style={{padding:"8px 10px"}}>
                                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                                          <div style={{width:8,height:8,borderRadius:"50%",background:color}} />
                                          <span style={{fontWeight:600,color:THEME.text,fontSize:11}}>{acc.bank}</span>
                                          {acc.hidden && <span style={{background:THEME.border,color:THEME.textLight,padding:"1px 4px",borderRadius:3,fontSize:8,fontWeight:600}}>Hidden</span>}
                                        </div>
                                      </td>
                                      <td style={{padding:"8px 10px"}}>
                                        <span style={{background:`${typeColor}20`,color:typeColor,padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:700}}>{acc.type || "—"}</span>
                                      </td>
                                      <td style={{padding:"8px 10px",color:THEME.text,fontSize:10,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.holders}>{acc.holders || "—"}</td>
                                      <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:600,color:acc.done ? "#6B7280" : THEME.text,fontSize:11}}>{fmt(acc.amount, accCurrency)}</td>
                                      <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9}}>{accCurrency}</td>
                                      <td style={{padding:"8px 10px",fontFamily:"monospace",color:THEME.accent,fontWeight:600,fontSize:10}}>{acc.roi ? (Number(acc.roi) * 100).toFixed(2) + "%" : "—"}</td>
                                      <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,fontFamily:"monospace"}}>{acc.accountNumber || "—"}</td>
                                      <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,fontFamily:"monospace"}}>{acc.ifscCode || "—"}</td>
                                      <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.branch}>{acc.branch || "—"}</td>
                                      <td style={{padding:"8px 10px"}}>
                                        {acc.online && <span style={{fontSize:9,color:acc.online === "Yes" ? "#34D399" : "#6B7280",background:acc.online === "Yes" ? "#064E3B30" : "${THEME.border}40",padding:"2px 4px",borderRadius:3}}>{acc.online === "Yes" ? "🌐" : "—"}</span>}
                                      </td>
                                      <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.address}>{acc.address || "—"}</td>
                                      <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.detail}>{acc.detail || "—"}</td>
                                      <td style={{padding:"8px 10px",color:acc.nextAction && !acc.done ? "#F59E0B" : "#6B7280",fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",fontWeight:acc.nextAction && !acc.done ? 600 : 400}} title={acc.nextAction}>{acc.nextAction ? (acc.done ? "✓ " : "⚡ ") + acc.nextAction : "—"}</td>
                                      <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                                        <button onClick={() => toggleDone("account", idx)} style={{background:acc.done ? "#238636" : THEME.cardBgAlt,color:acc.done ? "#fff" : THEME.textMuted,border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3,fontWeight:600}}>{acc.done ? "↩" : "✓"}</button>
                                        <button onClick={() => openEdit("account", idx)} style={{background:THEME.cardBgAlt,color:"#2563eb",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer",marginRight:3}}>✏️</button>
                                        <button onClick={() => deleteRow("account", idx)} style={{background:THEME.cardBgAlt,color:"#F85149",border:"none",borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer"}}>🗑</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Aggregated Hidden Row */}
                                {!showAllAccounts && hiddenCount > 0 && (
                                  <tr style={{borderBottom:`1px solid ${THEME.border}`,background:THEME.cardBgAlt,cursor:"pointer"}} onClick={() => setShowAllAccounts(true)}>
                                    <td colSpan={3} style={{padding:"12px 10px"}}>
                                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                                        <div style={{width:8,height:8,borderRadius:"50%",background:THEME.border}} />
                                        <span style={{fontWeight:600,color:THEME.textMuted,fontSize:11}}>Other Accounts</span>
                                        <span style={{background:THEME.border,color:THEME.textLight,padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:600}}>{hiddenCount} hidden</span>
                                      </div>
                                    </td>
                                    <td style={{padding:"12px 10px",fontFamily:"monospace",fontWeight:600,color:THEME.textMuted,fontSize:11}}>{fmt(hiddenTotal, targetCurrency)}</td>
                                    <td colSpan={9} style={{padding:"12px 10px",color:THEME.textMuted,fontSize:10}}>Click to show all accounts</td>
                                    <td style={{padding:"12px 10px"}}>
                                      <button style={{background:THEME.accent,color:"#FFF",border:"none",borderRadius:4,padding:"3px 8px",fontSize:9,cursor:"pointer",fontWeight:600}}>Show</button>
                                    </td>
                                  </tr>
                                )}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* ═══ CARDS VIEW - Grouped by Bank ═══ */}
                  {accountsViewMode === 'cards' && (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12,alignItems:"start"}}>
                    {bankNames.map(bankName => {
                      const { accounts: bankAccounts, indices, total: totalBalance, currencies, dominantCurrency } = grouped[bankName];
                      const color = getBankColor(bankName);
                      const hasActions = bankAccounts.some(a => a.nextAction && !a.done);
                      const isExpanded = expandedBanks.has(bankName);
                      const isMixedCurrency = currencies.size > 1;
                      // For header: use dominantCurrency in ORIGINAL mode, otherwise displayCurrency
                      const headerCurrency = displayCurrency === 'ORIGINAL' ? dominantCurrency : displayCurrency;
                      
                      return (
                        <div key={bankName} style={{background:THEME.cardBgAlt,borderRadius:12,borderTop:`1px solid ${color}30`,borderRight:`1px solid ${color}30`,borderBottom:`1px solid ${color}30`,borderLeft:`3px solid ${color}`,overflow:"hidden"}}>
                          {/* Bank Header - Clickable */}
                          <div 
                            onClick={() => toggleBank(bankName)}
                            style={{padding:"12px 14px",background:`${color}10`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                          >
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                              <div>
                                <div style={{fontSize:14,fontWeight:700,color:THEME.text}}>{bankName || 'Unnamed'}</div>
                                <div style={{fontSize:10,color:THEME.textLight}}>{bankAccounts.length} account{bankAccounts.length > 1 ? "s" : ""}{hasActions ? " · ⚡ Actions" : ""}{isMixedCurrency && displayCurrency === 'ORIGINAL' ? " · 🌐 Mixed" : ""}</div>
                              </div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:THEME.text}}>{fmt(totalBalance, headerCurrency)}</div>
                              {isMixedCurrency && displayCurrency === 'ORIGINAL' && <div style={{fontSize:9,color:"#6B7280"}}>({Array.from(currencies).join('+')})</div>}
                            </div>
                          </div>
                          
                          {/* Account Types List - Collapsible - ALL fields */}
                          {isExpanded && (
                            <div style={{borderTop:`1px solid ${color}20`}}>
                              {bankAccounts.map((acc, j) => {
                                const originalIndex = indices[j];
                                const typeColor = acc.type === "FD" ? "#3B82F6" : acc.type === "Saving" ? "#10B981" : acc.type === "Credit Card" ? "#EF4444" : "#8B5CF6";
                                return (
                                  <div key={j} style={{padding:"10px 14px",borderBottom:j < bankAccounts.length - 1 ? `1px solid ${THEME.border}` : "none",opacity:acc.done ? 0.55 : 1}}>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                                      <div style={{flex:1}}>
                                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                          <span style={{background:`${typeColor}20`,color:typeColor,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700}}>{acc.type}</span>
                                          {acc.online && <span style={{fontSize:9,color:acc.online === "Yes" ? "#34D399" : "#6B7280",background:acc.online === "Yes" ? "#064E3B30" : "${THEME.border}40",padding:"2px 6px",borderRadius:4}}>🌐 {acc.online}</span>}
                                          {acc.done && <span style={{fontSize:9,color:"#6B7280"}}>✓ Done</span>}
                                        </div>
                                        {acc.holders && <div style={{fontSize:11,color:THEME.text,marginTop:4}}>👤 {acc.holders}</div>}
                                        <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4,flexWrap:"wrap"}}>
                                          {acc.amount && <span style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:acc.done ? "#6B7280" : "#F9FAFB"}}>{fmt(acc.amount, (acc.currency || 'INR') as Currency)}</span>}
                                          {acc.roi && <span style={{fontSize:11,color:"#34D399",fontFamily:"monospace"}}>{(Number(acc.roi) * 100).toFixed(2)}% pa</span>}
                                        </div>
                                        {acc.balanceHistory?.length > 0 && (() => {
                                          const latest = acc.balanceHistory[acc.balanceHistory.length - 1];
                                          const prev = latest.previousAmount != null ? `${fmt(latest.previousAmount, (acc.currency || 'INR') as Currency)} → ` : '';
                                          return (
                                            <div style={{fontSize:10,color:"#6B7280",marginTop:3}} title={acc.balanceHistory.map(h => `${new Date(h.date).toLocaleString()}: ${h.previousAmount != null ? fmt(h.previousAmount, (acc.currency || 'INR') as Currency) + ' → ' : ''}${fmt(h.amount, (acc.currency || 'INR') as Currency)} ${h.source || ''}`).join('\n')}>
                                              📅 Updated {new Date(latest.date).toLocaleDateString(undefined, { dateStyle: 'short' })} · {prev}{fmt(latest.amount, (acc.currency || 'INR') as Currency)} {latest.source && <span style={{color:"#9CA3AF"}}>({latest.source})</span>}
                                            </div>
                                          );
                                        })()}
                                        {acc.address && <div style={{fontSize:10,color:"#6B7280",marginTop:3}}>📍 {acc.address}</div>}
                                        {acc.detail && <div style={{fontSize:10,color:THEME.textLight,marginTop:2}}>📝 {acc.detail}</div>}
                                        {acc.accountNumber && <div style={{fontSize:9,color:"#484F58",marginTop:2,fontFamily:"monospace"}}>A/C: {acc.accountNumber}</div>}
                                        {acc.ifscCode && <div style={{fontSize:9,color:"#484F58",fontFamily:"monospace"}}>IFSC: {acc.ifscCode}</div>}
                                        {acc.branch && <div style={{fontSize:9,color:"#484F58"}}>Branch: {acc.branch}</div>}
                                        {acc.nextAction && !acc.done && <div style={{fontSize:11,color:"#F59E0B",marginTop:4,fontWeight:600}}>⚡ {acc.nextAction}</div>}
                                      </div>
                                      <div style={{display:"flex",gap:4,flexShrink:0}}>
                                        <button onClick={(e) => { e.stopPropagation(); toggleDone("account", originalIndex); }} style={{background:acc.done ? "#dcfce7" : THEME.cardBgAlt,color:acc.done ? "#34D399" : "#6B7280",border:`1px solid ${acc.done ? "#16a34a" : THEME.border}`,borderRadius:5,padding:"2px 6px",fontSize:10,cursor:"pointer",fontWeight:700}}>{acc.done ? "↩" : "✓"}</button>
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
                  
                  {/* Bank Summary - Collapsible */}
                  <div style={{marginTop:16,background:THEME.cardBg,borderRadius:12,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
                    <button 
                      onClick={() => setExpandedBanks(prev => prev.has('_summary') ? new Set([...prev].filter(k => k !== '_summary')) : new Set([...prev, '_summary']))}
                      style={{width:"100%",padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                    >
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:10,color:"#6B7280",transition:"transform 0.2s",transform:expandedBanks.has('_summary')?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                        <span style={{fontSize:11,fontWeight:700,color:THEME.textLight,textTransform:"uppercase"}}>📊 Bank-wise Summary</span>
                      </div>
                      <div style={{fontSize:12,color:THEME.text,fontFamily:"monospace",fontWeight:700}}>{fmt(sumConverted(accounts), displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency)}</div>
                    </button>
                    {expandedBanks.has('_summary') && (
                      <div style={{borderTop:"1px solid #1F2937",padding:"10px 14px"}}>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {bankNames.map(bankName => {
                            const { total, dominantCurrency, sortTotal } = grouped[bankName];
                            const grandTotal = sumConverted(accounts);
                            const pct = grandTotal > 0 ? (sortTotal / grandTotal * 100) : 0;
                            const summaryCurrency = displayCurrency === 'ORIGINAL' ? dominantCurrency : displayCurrency as Currency;
                            return (
                              <div key={bankName} style={{display:"flex",alignItems:"center",gap:10}}>
                                <div style={{width:10,height:10,borderRadius:"50%",background:getBankColor(bankName),flexShrink:0}} />
                                <span style={{flex:1,fontSize:12,color:THEME.text}}>{bankName}</span>
                                <span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:THEME.text}}>{fmt(total, summaryCurrency)}</span>
                                <span style={{fontSize:10,color:"#6B7280",minWidth:40,textAlign:"right"}}>{pct.toFixed(0)}%</span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{marginTop:10,fontSize:10,color:"#6B7280",fontStyle:"italic",textAlign:"center"}}>
                          {accounts.length} accounts across {bankNames.length} banks
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Investment by Bank Chart - uses accounts (by bank); no overlapping labels, legend always readable */}
                  <div style={{marginTop:16,background:THEME.cardBg,borderRadius:12,border:`1px solid ${THEME.border}`,padding:14}}>
                    <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:10}}>🏦 Accounts by Bank</div>
                    {accountsPieData.length === 0 ? (
                      <div style={{color:THEME.textMuted,padding:20,textAlign:"center"}}>No account data</div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie 
                              data={accountsPieData} 
                              cx="50%" 
                              cy="45%" 
                              innerRadius={52} 
                              outerRadius={78} 
                              paddingAngle={2} 
                              dataKey="value"
                              label={({ name, percent }) => (percent != null && percent >= 0.10) ? `${name} ${(percent * 100).toFixed(0)}%` : null}
                              labelLine={({ percent }) => (percent != null && percent >= 0.10)}
                            >
                              {accountsPieData.map((e, i) => <Cell key={i} fill={e.color} stroke="#111827" strokeWidth={2} />)}
                            </Pie>
                            <Tooltip 
                              contentStyle={{background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,borderRadius:8,fontSize:13}}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const p = payload[0].payload as { name: string; value: number; percent?: number };
                                const total = accountsPieData.reduce((s, e) => s + e.value, 0);
                                const pct = total ? (p.value / total) * 100 : 0;
                                const cur = displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency;
                                return (
                                  <div style={{padding:8,minWidth:140}}>
                                    <div style={{fontWeight:700,color:THEME.text,marginBottom:4}}>{p.name}</div>
                                    <div style={{fontSize:13,fontFamily:"monospace"}}>{fmt(p.value, cur)}</div>
                                    <div style={{fontSize:11,color:THEME.textLight}}>{(pct).toFixed(1)}%</div>
                                  </div>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <button type="button" onClick={() => setShowLegend(prev => prev.has('accounts_pie') ? new Set([...prev].filter(k => k !== 'accounts_pie')) : new Set([...prev, 'accounts_pie']))} style={{marginTop:10,background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,color:THEME.textLight,padding:"4px 12px",borderRadius:6,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:10,transition:"transform 0.2s",transform:showLegend.has('accounts_pie')?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                          Banks ({accountsPieData.length})
                        </button>
                        {showLegend.has('accounts_pie') && (
                          <>
                            <div style={{marginTop:6,fontSize:11,color:THEME.textLight,marginBottom:6}}>Banks · hover slice for details</div>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,maxHeight:220,overflowY:"auto"}}>
                              {accountsPieData.map((e, i) => {
                                const total = accountsPieData.reduce((s, x) => s + x.value, 0);
                                const pct = total ? (e.value / total) * 100 : 0;
                                return (
                                  <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,background:THEME.cardBgAlt,padding:"6px 10px",borderRadius:8,borderLeft:`3px solid ${e.color}`}}>
                                    <div style={{width:10,height:10,borderRadius:"50%",background:e.color,flexShrink:0}} />
                                    <span style={{color:THEME.text,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}} title={e.name}>{e.name}</span>
                                    <span style={{color:e.color,fontWeight:600,fontSize:12,whiteSpace:"nowrap"}}>{fmt(e.value, displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency)} <span style={{fontSize:10,color:THEME.textLight}}>({pct.toFixed(1)}%)</span></span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
              </>
              )}
            </div>
          );
        })()}

        {/* ══ BILLS TAB ══════════════════════════════════════════════ */}
        {tab === "bills" && (
          <div>
            {/* ═══ MOBILE BILLS VIEW ═══ */}
            {isMobile ? (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {/* Mobile: Summary Header */}
                <div style={{background:THEME.headerBg,borderRadius:14,padding:"16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:500}}>PENDING BILLS</div>
                    <div style={{fontSize:28,fontWeight:800,color:"#fff"}}>{bills.filter(b => !b.done).length}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:THEME.textMuted,fontWeight:500}}>TOTAL DUE</div>
                    <div style={{fontSize:20,fontWeight:800,color:"#F59E0B",fontFamily:"monospace"}}>{fmt(bills.filter(b => !b.done).reduce((s, b) => s + (Number(b.amount) || 0), 0))}</div>
                  </div>
                </div>
                
                {/* Mobile: Filter Tabs */}
                <div style={{display:"flex",gap:8}}>
                  <button 
                    onClick={() => setShowDone(false)}
                    style={{flex:1,background:!showDone ? "#F59E0B" : THEME.cardBgAlt,color:!showDone ? "#000" : THEME.textLight,border:"none",borderRadius:10,padding:"10px",fontSize:13,fontWeight:600}}
                  >
                    Pending ({bills.filter(b => !b.done).length})
                  </button>
                  <button 
                    onClick={() => setShowDone(true)}
                    style={{flex:1,background:showDone ? "#10B981" : THEME.cardBgAlt,color:showDone ? "#FFF" : THEME.textLight,border:"none",borderRadius:10,padding:"10px",fontSize:13,fontWeight:600}}
                  >
                    Paid ({bills.filter(b => b.done).length})
                  </button>
                </div>
                
                {/* Mobile: Bills List */}
                {bills.length === 0 ? (
                  <div style={{padding:40,textAlign:"center",color:"#6B7280"}}>No bills tracked yet</div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {bills.filter(b => showDone ? b.done : !b.done).map((bill, i) => {
                      const origIdx = bills.indexOf(bill);
                      return (
                        <div 
                          key={i}
                          style={{
                            background:THEME.cardBgAlt,
                            borderRadius:14,
                            padding:"14px",
                            borderLeft:`4px solid ${bill.done ? "#10B981" : "#F59E0B"}`,
                            opacity: bill.done ? 0.7 : 1
                          }}
                        >
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:15,fontWeight:700,color:bill.done ? "#6B7280" : THEME.text,textDecoration:bill.done ? "line-through" : "none"}}>{bill.name}</div>
                              <div style={{fontSize:12,color:"#6B7280",marginTop:4}}>{bill.freq}</div>
                            </div>
                            {bill.amount && (
                              <div style={{fontSize:18,fontWeight:800,fontFamily:"monospace",color:bill.done ? "#6B7280" : "#F59E0B"}}>{fmt(bill.amount)}</div>
                            )}
                          </div>
                          
                          {bill.due && (
                            <div style={{fontSize:12,color:THEME.textLight,marginBottom:10}}>Due: {bill.due}</div>
                          )}
                          
                          {/* Mobile: Action Buttons */}
                          <div style={{display:"flex",gap:8,paddingTop:10,borderTop:`1px solid ${THEME.border}`}}>
                            <button 
                              onClick={() => toggleDone("bill", origIdx)} 
                              style={{flex:1,background:bill.done ? "#dcfce7" : "#F59E0B20",color:bill.done ? "#34D399" : "#F59E0B",border:"none",borderRadius:8,padding:"10px",fontSize:12,fontWeight:600}}
                            >
                              {bill.done ? "↩ Unpaid" : "✓ Mark Paid"}
                            </button>
                            <button 
                              onClick={() => openEdit("bill", origIdx)} 
                              style={{background:"#1D4ED820",color:"#60A5FA",border:"none",borderRadius:8,padding:"10px 14px",fontSize:12}}
                            >✏️</button>
                            <button 
                              onClick={() => deleteRow("bill", origIdx)} 
                              style={{background:"#7F1D1D20",color:"#FCA5A5",border:"none",borderRadius:8,padding:"10px 14px",fontSize:12}}
                            >🗑</button>
                          </div>
                        </div>
                      );
                    })}
                    {bills.filter(b => showDone ? b.done : !b.done).length === 0 && (
                      <div style={{padding:30,textAlign:"center",color:"#6B7280",fontSize:13}}>
                        {showDone ? "No paid bills yet" : "All bills are paid! 🎉"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
            /* ═══ DESKTOP BILLS VIEW ═══ */
            <>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <button onClick={() => openAdd("bill")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Bill</button>
            </div>
            {bills.length === 0 ? (
              <EmptyState icon="📋" title="No Bills Tracked" description="Add recurring bills and subscriptions to never miss a payment" action="+ Add Bill" onAction={() => openAdd("bill")} />
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                {bills.map((bill, i) => (
                  <div key={i} style={{background:THEME.cardBgAlt,borderRadius:12,padding:16,border:"1px solid ${THEME.border}",opacity:bill.done ? 0.55 : 1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div style={{fontWeight:700,color:bill.done ? "#6B7280" : "#F3F4F6",fontSize:14,textDecoration:bill.done ? "line-through" : "none",flex:1}}>{bill.name}</div>
                      <button onClick={() => toggleDone("bill", i)} style={{background:bill.done ? "#dcfce7" : THEME.cardBgAlt,color:bill.done ? "#34D399" : "#6B7280",border:`1px solid ${bill.done ? "#16a34a" : THEME.border}`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontWeight:700}}>{bill.done ? "↩" : "✓"}</button>
                    </div>
                    {bill.amount && <div style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:THEME.text,marginBottom:4}}>{fmt(bill.amount)}</div>}
                    <div style={{fontSize:11,color:THEME.textLight,marginBottom:6}}>{bill.freq} · Due: {bill.due || "—"}</div>
                    <div style={{display:"flex",gap:6,marginTop:8}}>
                      <button onClick={() => openEdit("bill", i)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
                      <button onClick={() => deleteRow("bill", i)} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button (Mobile) - positioned above bottom bar */}
      {isMobile && !modal && (
        <button
          onClick={() => {
            const typeMap: Record<string, string> = { deposits: "deposit", accounts: "account", bills: "bill", actions: "action" };
            const type = typeMap[tab] || "deposit";
            openAdd(type);
          }}
          style={{
            position: "fixed",
            bottom: 120,
            right: 16,
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
          <div style={{background:THEME.cardBgAlt,borderRadius:20,padding:28,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",border:"1px solid ${THEME.border}"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:22}}>
              <div style={{fontSize:17,fontWeight:800}}>{modal.mode==="add"?"Add":"Edit"} {modal.type}</div>
              <button onClick={()=>setModal(null)} style={{background:THEME.border,color:THEME.textLight,border:"none",borderRadius:8,padding:"3px 12px",cursor:"pointer"}}>✕</button>
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
                {(form as Deposit).balanceHistory?.length > 0 && (
                  <div style={{gridColumn:"span 2",padding:"10px 0",borderTop:`1px solid ${THEME.border}`,marginTop:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:6}}>Amount history</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:120,overflowY:"auto"}}>
                      {(form as Deposit).balanceHistory!.map((h: { date: string; amount: number; previousAmount?: number; source?: string }, i: number) => (
                        <div key={i} style={{fontSize:11,color:THEME.text,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
                          <span>{new Date(h.date).toLocaleDateString(undefined, { dateStyle: 'short' })} {h.source && <span style={{color:THEME.textLight}}>· {h.source}</span>}</span>
                          <span style={{fontFamily:"monospace",fontWeight:600}}>
                            {h.previousAmount != null ? `${fmt(h.previousAmount, (form as Deposit).currency as Currency)} → ` : ''}{fmt(h.amount, (form as Deposit).currency as Currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                <div style={{gridColumn:"span 2",display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:`1px solid ${THEME.border}`,marginTop:6}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:THEME.textLight}}>
                    <input 
                      type="checkbox" 
                      checked={form.hidden || false} 
                      onChange={e => setForm({...form, hidden: e.target.checked})}
                      style={{width:16,height:16,accentColor:"#0D9488"}}
                    />
                    <span>Hide from default view</span>
                  </label>
                  <span style={{fontSize:10,color:"#6B7280"}}>(shown as "Other Accounts" aggregate)</span>
                </div>
                {(form as BankAccount).balanceHistory?.length > 0 && (
                  <div style={{gridColumn:"span 2",padding:"10px 0",borderTop:`1px solid ${THEME.border}`,marginTop:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:6}}>Balance history</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:120,overflowY:"auto"}}>
                      {(form as BankAccount).balanceHistory!.map((h: { date: string; amount: number; previousAmount?: number; source?: string }, i: number) => (
                        <div key={i} style={{fontSize:11,color:THEME.text,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
                          <span>{new Date(h.date).toLocaleDateString(undefined, { dateStyle: 'short' })} {h.source && <span style={{color:THEME.textLight}}>· {h.source}</span>}</span>
                          <span style={{fontFamily:"monospace",fontWeight:600}}>
                            {h.previousAmount != null ? `${fmt(h.previousAmount, (form as BankAccount).currency as Currency)} → ` : ''}{fmt(h.amount, (form as BankAccount).currency as Currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
              <button onClick={()=>setModal(null)} style={{background:THEME.border,color:THEME.textLight,border:"none",borderRadius:10,padding:"9px 18px",cursor:"pointer"}}>Cancel</button>
              <button onClick={saveModal} style={{background:"linear-gradient(135deg,#1D4ED8,#2563EB)",color:"#fff",border:"none",borderRadius:10,padding:"9px 22px",cursor:"pointer"}}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Exchange Rates Modal */}
      {showRatesModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1001,padding:16}}>
          <div style={{background:THEME.cardBgAlt,borderRadius:20,padding:28,width:"100%",maxWidth:400,border:"1px solid ${THEME.border}"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:22}}>
              <div style={{fontSize:17,fontWeight:800,color:THEME.text}}>Exchange Rates (to INR)</div>
              <button onClick={()=>setShowRatesModal(false)} style={{background:THEME.border,color:THEME.textLight,border:"none",borderRadius:8,padding:"3px 12px",cursor:"pointer"}}>✕</button>
            </div>
            <div style={{fontSize:11,color:THEME.textLight,marginBottom:16}}>
              Set exchange rates for currency conversion. These rates define how many INR equals 1 unit of foreign currency.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={{fontSize:11,color:THEME.textLight,display:"block",marginBottom:4}}>1 USD = ₹</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={exchangeRates.USD} 
                  onChange={e => setExchangeRates({...exchangeRates, USD: Number(e.target.value) || 83})}
                  style={{width:"100%",background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"10px 12px",color:THEME.text,fontSize:14}}
                />
              </div>
              <div>
                <label style={{fontSize:11,color:THEME.textLight,display:"block",marginBottom:4}}>1 EUR = ₹</label>
                <input 
                  type="number"
                  step="0.01" 
                  value={exchangeRates.EUR} 
                  onChange={e => setExchangeRates({...exchangeRates, EUR: Number(e.target.value) || 90})}
                  style={{width:"100%",background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"10px 12px",color:THEME.text,fontSize:14}}
                />
              </div>
              <div>
                <label style={{fontSize:11,color:THEME.textLight,display:"block",marginBottom:4}}>1 GBP = ₹</label>
                <input 
                  type="number"
                  step="0.01" 
                  value={exchangeRates.GBP} 
                  onChange={e => setExchangeRates({...exchangeRates, GBP: Number(e.target.value) || 105})}
                  style={{width:"100%",background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,borderRadius:8,padding:"10px 12px",color:THEME.text,fontSize:14}}
                />
              </div>
            </div>
            <div style={{display:"flex",gap:12,marginTop:22,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowRatesModal(false)} style={{background:THEME.border,color:THEME.textLight,border:"none",borderRadius:10,padding:"9px 18px",cursor:"pointer"}}>Cancel</button>
              <button 
                onClick={() => { persist(deposits, accounts, bills, actions, goals, exchangeRates, displayCurrency); setShowRatesModal(false); }}
                style={{background:"linear-gradient(135deg,#1D4ED8,#2563EB)",color:"#fff",border:"none",borderRadius:10,padding:"9px 22px",cursor:"pointer"}}
              >
                Save Rates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MOBILE BOTTOM TAB BAR ═══ */}
      {isMobile && (
        <>
          {/* More Menu Overlay */}
          {showMoreMenu && (
            <div 
              style={{
                position:"fixed",
                inset:0,
                background:"rgba(0,0,0,0.5)",
                zIndex:998
              }}
              onClick={() => setShowMoreMenu(false)}
            />
          )}
          
          {/* More Menu Popup */}
          {showMoreMenu && (
            <div style={{
              position:"fixed",
              bottom:105,
              right:12,
              background:"#fff",
              borderRadius:12,
              border:"1px solid #e5e7eb",
              boxShadow:"0 4px 20px rgba(0,0,0,0.15)",
              zIndex:999,
              overflow:"hidden"
            }}>
              {moreTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setShowMoreMenu(false); }}
                  style={{
                    display:"flex",
                    alignItems:"center",
                    gap:10,
                    width:"100%",
                    padding:"12px 18px",
                    background: tab === t.id ? "#EFF6FF" : "transparent",
                    color: tab === t.id ? "#3B82F6" : THEME.border,
                    border:"none",
                    borderBottom:"1px solid #f3f4f6",
                    fontSize:13,
                    fontWeight: tab === t.id ? 600 : 500,
                    textAlign:"left",
                    cursor:"pointer"
                  }}
                >
                  <span style={{fontSize:16}}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
          
          {/* Bottom Tab Bar - sits directly above main app navigation */}
          <div style={{
            position:"fixed",
            bottom:52,
            left:0,
            right:0,
            background:"#fff",
            borderTop:"1px solid #e5e7eb",
            display:"flex",
            justifyContent:"space-around",
            alignItems:"center",
            padding:"4px 0 6px",
            zIndex:200
          }}>
            {mainTabs.map(t => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setShowMoreMenu(false); }}
                  style={{
                    display:"flex",
                    flexDirection:"column",
                    alignItems:"center",
                    gap:1,
                    background:"transparent",
                    border:"none",
                    padding:"2px 6px",
                    color: isActive ? "#3B82F6" : "#6B7280",
                    minWidth:50,
                    cursor:"pointer"
                  }}
                >
                  <span style={{fontSize:18}}>{t.icon}</span>
                  <span style={{fontSize:9,fontWeight:isActive ? 600 : 400}}>{t.label}</span>
                </button>
              );
            })}
            {/* More Button */}
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              style={{
                display:"flex",
                flexDirection:"column",
                alignItems:"center",
                gap:1,
                background:"transparent",
                border:"none",
                padding:"2px 6px",
                color: moreTabs.some(t => t.id === tab) ? "#3B82F6" : "#6B7280",
                minWidth:50,
                cursor:"pointer"
              }}
            >
              <span style={{fontSize:18}}>•••</span>
              <span style={{fontSize:9,fontWeight: moreTabs.some(t => t.id === tab) ? 600 : 400}}>More</span>
            </button>
          </div>
        </>
      )}

      {/* Pending Financial Imports Modal */}
      <PendingFinancialImportsModal
        show={showPendingImportsModal}
        onClose={() => setShowPendingImportsModal(false)}
        bankData={{ deposits, accounts, bills, actions, goals }}
        onApplyImport={handleApplyFinancialImport}
      />
    </div>
  );
}
