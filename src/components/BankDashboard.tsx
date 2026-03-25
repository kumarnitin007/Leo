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
 * - Timeline view
 * - Encrypted storage via Supabase
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Deposit, BankAccount, Bill, ActionItem, BankRecordsData, SavingsGoal, Currency, TotalValueHistoryEntry } from '../types/bankRecords';
import {
  parseBankRecordsWorkbook,
  downloadBankRecordsTemplate,
  readBankRecordsFile,
  bankAccountMergeKey,
  bankAccountMatchesDeleteKey,
} from '../services/bankRecordsExcel';
import { updateFinancialAlertsCache, FinancialAlertsSummary } from './FinancialAlertsWidget';
import { CryptoKey, encryptData, decryptData } from '../utils/encryption';
import { useTheme } from '../contexts/ThemeContext';
import PendingFinancialImportsModal, { AccountUpdate } from './PendingFinancialImportsModal';
import { getPendingImportCount, approveFinancialImport } from '../services/pendingFinancialImports';
import { loadUserSettings } from '../storage';
import type { FinancialPreferences } from '../types';
import {
  CURRENCY_SYMBOLS,
  DEFAULT_RATES,
  emptyDeposit,
  emptyAccount,
  emptyBill,
  emptyAction,
  emptyGoal,
  CATEGORIES,
  CURRENCIES,
} from '../bank/bankDashboardConstants';
import {
  daysUntil,
  daysSinceUpdated,
  accountNotesDetail,
  convertCurrency,
  fmt,
  fmtFull,
  fmtDate,
  getBankColor,
  getDefaultDisplayCurrency,
} from '../bank/bankDashboardFormat';
import { UrgencyBadge, EmptyState, inputSt, labelSt } from './bank/BankDashboardPrimitives';
import { BankTimelineTab } from './bank/BankTimelineTab';
import { BankActionsTab } from './bank/BankActionsTab';
import { BankDepositsTab } from './bank/BankDepositsTab';
import { BankBillsTab } from './bank/BankBillsTab';
import { BankOverviewTab, type Next30DayRow } from './bank/BankOverviewTab';
import { collectLinkedNextActions } from '../bank/bankLinkedActions';
import type { PortfolioHistoryChartPoint } from '../bank/bankDashboardTypes';

interface BankDashboardProps {
  supabase?: SupabaseClient;
  userId?: string;
  encryptionKey?: CryptoKey;
  onOpenGroupChat?: () => void;
}

// Helpers / constants / small UI: `src/bank/*`, `src/components/bank/BankDashboardPrimitives.tsx`

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
  const [displayCurrency, setDisplayCurrency] = useState<'ORIGINAL' | 'INR' | 'USD' | 'EUR' | 'GBP'>(() =>
    getDefaultDisplayCurrency()
  );
  const [exchangeRates, setExchangeRates] = useState<{ USD: number; EUR: number; GBP: number }>(() => ({
    ...DEFAULT_RATES,
  }));
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [accountsViewMode, setAccountsViewMode] = useState<'cards' | 'grouped' | 'flat'>('cards');
  const [depositsViewMode, setDepositsViewMode] = useState<'cards' | 'grouped' | 'flat'>('grouped');
  const [billsViewMode, setBillsViewMode] = useState<'cards' | 'grouped'>('cards');
  const [actionsViewMode, setActionsViewMode] = useState<'cards' | 'grouped'>('cards');
  const [showAllAccounts, setShowAllAccounts] = useState(false); // false = hide accounts marked as hidden
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(false);
  const [show30Days, setShow30Days] = useState(false);
  const [showPortfolioHistory, setShowPortfolioHistory] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [totalValueHistory, setTotalValueHistory] = useState<TotalValueHistoryEntry[]>([]);
  const MAX_TOTAL_VALUE_HISTORY = 500;
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  const [showLegend, setShowLegend] = useState<Set<string>>(new Set());
  /** Accounts tab — "by bank" visualization: donut (merged slices) vs horizontal bars (all banks, readable labels) */
  const [accountsBankViz, setAccountsBankViz] = useState<'donut' | 'bars'>('donut');
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
        case '2': setTab('timeline'); break;
        case '3': setTab('actions'); break;
        case '4': setTab('deposits'); break;
        case '5': setTab('accounts'); break;
        case '6': setTab('bills'); break;
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

    const mapExtractedTypeToBankAccountType = (accountType?: string): string => {
      if (!accountType) return 'Investment';
      const t = accountType.toLowerCase();
      if (t === 'checking' || t === 'savings') return 'Saving';
      if (t === 'loan') return 'Loan';
      return 'Investment';
    };

    updates.forEach(update => {
      if (update.action === 'skip') return;

      const isLoan = (update.accountType || '').toLowerCase() === 'loan';
      const effectiveBalance = isLoan ? -Math.abs(Number(update.newBalance) || 0) : (Number(update.newBalance) || 0);

      if (update.action === 'create') {
        if (update.type === 'account') {
          newAccounts.push({
            bank: update.accountName,
            type: mapExtractedTypeToBankAccountType(update.accountType),
            holders: '',
            amount: effectiveBalance,
            roi: 0,
            online: 'Yes',
            address: '',
            detail: 'Imported from screenshot',
            nextAction: '',
            done: false,
            currency: update.currency as Currency || 'USD',
            lastBalanceUpdatedAt: now,
            balanceHistory: [{ date: now, amount: effectiveBalance, source: 'Imported from screenshot' }],
          });
        }
      } else if (update.action === 'update' && update.existingIndex !== undefined) {
        if (update.type === 'account') {
          const prev = newAccounts[update.existingIndex];
          const prevAmount = Number(prev.amount) || 0;
          newAccounts[update.existingIndex] = {
            ...prev,
            type: mapExtractedTypeToBankAccountType(update.accountType) || prev.type,
            amount: effectiveBalance,
            lastBalanceUpdatedAt: now,
            balanceHistory: [
              ...(prev.balanceHistory || []),
              { date: now, amount: effectiveBalance, previousAmount: prevAmount, source: 'Financial import' },
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

    approveFinancialImport(importId);
    setPendingImportsCount(getPendingImportCount());
    save(newDeposits, newAccounts, bills, actions, goals, { recordTotalValue: true, totalValueSource: 'Financial import' });
    alert('✅ Financial import applied successfully!');
  };

  async function loadData() {
    let profileFin: FinancialPreferences | undefined;
    try {
      const us = await loadUserSettings();
      profileFin = us.financialPreferences;
    } catch {
      /* not signed in or offline */
    }

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
            setTotalValueHistory(parsed.totalValueHistory || []);
            if (parsed.exchangeRates) setExchangeRates(parsed.exchangeRates);
            else if (profileFin?.exchangeRates) {
              setExchangeRates({ ...DEFAULT_RATES, ...profileFin.exchangeRates });
            }
            if (parsed.displayCurrency) setDisplayCurrency(parsed.displayCurrency);
            else if (profileFin?.preferredDisplayCurrency) setDisplayCurrency(profileFin.preferredDisplayCurrency);
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
          if (profileFin?.exchangeRates) setExchangeRates({ ...DEFAULT_RATES, ...profileFin.exchangeRates });
          if (profileFin?.preferredDisplayCurrency) setDisplayCurrency(profileFin.preferredDisplayCurrency);
          else setDisplayCurrency(getDefaultDisplayCurrency());
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
    
    // Portfolio / invested / maturity: accounts only (Deposits tab is detail/tracking; avoid double-count)
    const accountBalance = accounts.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const fdTotalAccounts = accounts.filter(a => a.type === "FD").reduce((s,a)=>s+(Number(a.amount)||0),0);
    const fdMaturityEstAccounts = accounts.filter(a => a.type === "FD").reduce((s,a) => {
      const principal = Number(a.amount) || 0;
      const roi = Number(a.roi) || 0.07;
      return s + principal * (1 + roi);
    }, 0);
    const totalInvested = fdTotalAccounts;
    const totalMaturity = fdMaturityEstAccounts;
    
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
        const fdDetail = [d.type, d.duration, d.depositId].filter(Boolean).join(' · ');
        const bank = (d.bank || '').trim() || (d.depositId || '').trim() || 'FD';
        alertsList.push({
          title: `${bank} · ${(d.type || 'FD').trim()} maturing`,
          description: fmt(Number(d.maturityAmt) || Number(d.deposit), d.currency),
          bankName: d.bank || '',
          billName: undefined,
          fdDetail: fdDetail || undefined,
          kindLabel: 'Deposit',
          dueDateLabel: d.maturityDate ? fmtDate(d.maturityDate) : undefined,
          amountLabel: fmt(Number(d.maturityAmt) || Number(d.deposit), d.currency),
          daysUntil: days,
          severity,
          type: 'maturity'
        });
      }
    });
    
    // Linked next-actions (accounts / deposits / bills) — same rows as Actions tab; use resolved date for days left
    const linkedAlerts = collectLinkedNextActions(accounts, deposits, bills);
    linkedAlerts.forEach((row) => {
      const days = row.date && String(row.date).trim() ? daysUntil(row.date) : null;
      const hasDate = days !== null;
      let severity: 'urgent' | 'warning' | 'info' = 'info';
      if (hasDate && days !== null) {
        if (days < 0 || days <= 7) severity = 'urgent';
        else if (days <= 14) severity = 'warning';
      }
      if (severity === 'urgent') urgentCount++;
      if (severity === 'warning') warningCount++;
      const description =
        row.source === 'bill'
          ? row.note
          : [row.bank, row.note].filter(Boolean).join(' · ') || row.title;
      const billName =
        row.source === 'bill' ? row.note.replace(/^Bill:\s*/, '').trim() : undefined;
      const kindLabel =
        row.source === 'account' ? 'Account' : row.source === 'deposit' ? 'Deposit' : 'Bill';
      alertsList.push({
        title: row.title,
        description,
        bankName: row.bank || '',
        billName: billName || undefined,
        fdDetail: row.note || undefined,
        kindLabel,
        dueDateLabel: row.date ? fmtDate(row.date) : undefined,
        amountLabel: undefined,
        daysUntil: hasDate ? days! : -1,
        severity,
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
          description: [a.bank, a.note].filter(Boolean).join(' · '),
          bankName: a.bank || '',
          billName: undefined,
          fdDetail: undefined,
          kindLabel: 'Account',
          dueDateLabel: a.date ? fmtDate(a.date) : undefined,
          amountLabel: undefined,
          daysUntil: days,
          severity,
          type: 'action'
        });
      } else if (!a.date) {
        alertsList.push({
          title: a.title,
          description: [a.bank, a.note].filter(Boolean).join(' · '),
          bankName: a.bank || '',
          billName: undefined,
          fdDetail: undefined,
          kindLabel: 'Account',
          dueDateLabel: undefined,
          amountLabel: undefined,
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
        description: [b.freq, b.due, b.amount ? fmt(Number(b.amount), b.currency) : ''].filter(Boolean).join(' · '),
        bankName: '',
        billName: b.name,
        fdDetail: undefined,
        kindLabel: 'Bill',
        dueDateLabel: b.due ? fmtDate(b.due) : undefined,
        amountLabel: b.amount != null && b.amount !== '' ? fmt(Number(b.amount), b.currency) : undefined,
        daysUntil: -1,
        severity: b.priority === 'High' || b.priority === 'Urgent' ? 'warning' : 'info',
        type: 'bill'
      });
      if (b.priority === 'High' || b.priority === 'Urgent') warningCount++;
    });
    
    // Sort: soonest due / fewest days first; undated last; tie-break by severity
    const sevOrder = { urgent: 0, warning: 1, info: 2 };
    alertsList.sort((a, b) => {
      const undated = (x: number) => x === -1;
      if (undated(a.daysUntil) && undated(b.daysUntil)) {
        return sevOrder[a.severity] - sevOrder[b.severity];
      }
      if (undated(a.daysUntil)) return 1;
      if (undated(b.daysUntil)) return -1;
      const byDays = a.daysUntil - b.daysUntil;
      if (byDays !== 0) return byDays;
      return sevOrder[a.severity] - sevOrder[b.severity];
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

  function computeTotalValues(deps: Deposit[], accs: BankAccount[], rates: {USD: number; EUR: number; GBP: number}, dispCur: 'ORIGINAL' | 'INR' | 'USD' | 'EUR' | 'GBP'): { totalAccountValue: number; totalDepositValue: number } {
    const toCur = dispCur === 'ORIGINAL' ? 'INR' : dispCur;
    const totalAccountValue = accs.reduce((s, a) => s + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, toCur, rates), 0);
    const totalDepositValue = deps.reduce((s, d) => s + convertCurrency(Number(d.deposit) || 0, (d.currency || 'INR') as Currency, toCur, rates), 0);
    return { totalAccountValue, totalDepositValue };
  }

  async function persist(deps: Deposit[], accs: BankAccount[], bls: Bill[], acts: ActionItem[], gls?: SavingsGoal[], rates?: {USD: number; EUR: number; GBP: number}, dispCur?: 'ORIGINAL' | 'INR' | 'USD' | 'EUR' | 'GBP', totalValueHist?: TotalValueHistoryEntry[]) {
    const payload: BankRecordsData = { deposits: deps, accounts: accs, bills: bls, actions: acts, goals: gls || goals, exchangeRates: rates || exchangeRates, displayCurrency: dispCur || displayCurrency, totalValueHistory: totalValueHist ?? totalValueHistory, updatedAt: new Date().toISOString(), version: 1 };
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

  function save(deps: Deposit[], accs: BankAccount[], bls: Bill[], acts: ActionItem[], gls?: SavingsGoal[], options?: { recordTotalValue?: boolean; totalValueSource?: string }) {
    setDeposits(deps); setAccounts(accs); setBills(bls); setActions(acts);
    if (gls !== undefined) setGoals(gls);
    let hist = totalValueHistory;
    if (options?.recordTotalValue) {
      const { totalAccountValue, totalDepositValue } = computeTotalValues(deps, accs, exchangeRates, displayCurrency);
      const entry: TotalValueHistoryEntry = { date: new Date().toISOString(), totalAccountValue, totalDepositValue, source: options.totalValueSource || 'Balance change' };
      hist = [...totalValueHistory, entry].slice(-MAX_TOTAL_VALUE_HISTORY);
      setTotalValueHistory(hist);
    }
    persist(deps, accs, bls, acts, gls, undefined, undefined, hist);
  }

  // ── Excel Import (Smart Merge by ID) ────────────────────────────────────
  async function handleExcel(file: File) {
    try {
      const wb = await readBankRecordsFile(file);

      const {
        newDeposits,
        newAccounts,
        newBills,
        newActions,
        deleteDeposits,
        deleteAccounts,
        deleteBills,
        deleteActions,
      } = parseBankRecordsWorkbook(wb, CATEGORIES);

      const actionMergeKey = (a: ActionItem) =>
        `${a.title.trim().toLowerCase()}|${a.bank.trim().toLowerCase()}`;

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
        const idx = mergedAccounts.findIndex(a => bankAccountMatchesDeleteKey(a, del));
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

      let mergedActions = [...actions];
      deleteActions.forEach(del => {
        const idx = mergedActions.findIndex(
          a =>
            a.title.trim().toLowerCase() === del.title.trim().toLowerCase() &&
            a.bank.trim().toLowerCase() === del.bank.trim().toLowerCase()
        );
        if (idx >= 0) {
          mergedActions.splice(idx, 1);
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
          const prev = mergedDeposits[existingIdx];
          const prevAmt = Number(prev.deposit) || 0;
          const newAmt = Number(newDep.deposit) || 0;
          let next: Deposit = { ...prev, ...newDep };
          if (prevAmt !== newAmt) {
            const histDate = newDep.lastBalanceUpdatedAt || new Date().toISOString();
            const cur = (next.currency || "INR") as Currency;
            const delta = newAmt - prevAmt;
            const deltaStr = delta >= 0 ? `+${fmt(delta, cur)}` : fmt(delta, cur);
            next = {
              ...next,
              balanceHistory: [
                ...(prev.balanceHistory || []),
                { date: histDate, amount: newAmt, previousAmount: prevAmt, source: `Excel import ${deltaStr}` },
              ],
            };
          }
          mergedDeposits[existingIdx] = next;
          updatedCount++;
        } else {
          const histDate = newDep.lastBalanceUpdatedAt || new Date().toISOString();
          mergedDeposits.push({
            ...newDep,
            balanceHistory: [{ date: histDate, amount: Number(newDep.deposit) || 0, source: "Excel import" }],
          });
          addedCount++;
        }
      });
      
      // Merge Accounts (by bank + type + holders to allow multiple accounts of same type)
      newAccounts.forEach(newAcc => {
        const key = bankAccountMergeKey(newAcc);
        const existingIdx = mergedAccounts.findIndex(a => bankAccountMergeKey(a) === key);
        
        if (existingIdx >= 0) {
          const prev = mergedAccounts[existingIdx];
          const prevAmt = Number(prev.amount) || 0;
          const newAmt = Number(newAcc.amount) || 0;
          let next: BankAccount = { ...prev, ...newAcc };
          if (prevAmt !== newAmt) {
            const histDate = newAcc.lastBalanceUpdatedAt || new Date().toISOString();
            const cur = (next.currency || "INR") as Currency;
            const delta = newAmt - prevAmt;
            const deltaStr = delta >= 0 ? `+${fmt(delta, cur)}` : fmt(delta, cur);
            next = {
              ...next,
              balanceHistory: [
                ...(prev.balanceHistory || []),
                { date: histDate, amount: newAmt, previousAmount: prevAmt, source: `Excel import ${deltaStr}` },
              ],
            };
          }
          mergedAccounts[existingIdx] = next;
          updatedCount++;
        } else {
          const histDate = newAcc.lastBalanceUpdatedAt || new Date().toISOString();
          mergedAccounts.push({
            ...newAcc,
            balanceHistory: [{ date: histDate, amount: Number(newAcc.amount) || 0, source: "Excel import" }],
          });
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

      newActions.forEach(newAct => {
        const key = actionMergeKey(newAct);
        const existingIdx = mergedActions.findIndex(a => actionMergeKey(a) === key);
        if (existingIdx >= 0) {
          mergedActions[existingIdx] = { ...mergedActions[existingIdx], ...newAct };
          updatedCount++;
        } else {
          mergedActions.push(newAct);
          addedCount++;
        }
      });
      
      // Save merged data
      save(mergedDeposits, mergedAccounts, mergedBills, mergedActions, undefined, { recordTotalValue: true, totalValueSource: 'Excel import' });
      
      alert(`✅ Excel imported!\n📊 ${addedCount} new records added\n✏️ ${updatedCount} records updated\n🗑️ ${deletedCount} records deleted\n📁 Total: ${mergedDeposits.length} deposits, ${mergedAccounts.length} accounts, ${mergedBills.length} bills, ${mergedActions.length} actions`);
      
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
    const recordOpt = { recordTotalValue: true as const };
    if(type==="deposit") save(deposits.filter((_,i)=>i!==idx),accounts,bills,actions, undefined, { ...recordOpt, totalValueSource: 'Deleted deposit' });
    else if(type==="account") save(deposits,accounts.filter((_,i)=>i!==idx),bills,actions, undefined, { ...recordOpt, totalValueSource: 'Deleted account' });
    else if(type==="bill") save(deposits,accounts,bills.filter((_,i)=>i!==idx),actions);
    else save(deposits,accounts,bills,actions.filter((_,i)=>i!==idx));
  }

  async function handleClearAll() {
    const summary = `🗑 Clear ALL financial data?\n\nThis will delete:\n• ${deposits.length} deposits\n• ${accounts.length} accounts\n• ${bills.length} bills\n• ${actions.length} actions\n• ${goals.length} goals\n• Portfolio value history (${totalValueHistory.length} snapshots)\n\nThis cannot be undone!`;
    if (!confirm(summary)) return;
    
    try {
      // Clear local state (including chart history and goals)
      setDeposits([]);
      setAccounts([]);
      setBills([]);
      setActions([]);
      setGoals([]);
      setTotalValueHistory([]);
      // Persist empty state so DB and chart stay in sync
      await persist([], [], [], [], [], undefined, undefined, []);
      console.log('[BankDashboard] ✅ All data cleared (including portfolio history)');
      alert('✅ All data cleared! You can now import fresh data.');
    } catch (e) {
      console.error('[BankDashboard] Clear failed:', e);
      alert('❌ Failed to clear data');
    }
  }

  function clearPortfolioHistory() {
    if (!confirm('Clear all portfolio value history? The chart will start fresh from your next balance change.')) return;
    setTotalValueHistory([]);
    persist(deposits, accounts, bills, actions, goals, undefined, undefined, []);
  }

  function deletePortfolioHistoryEntry(dateIso: string) {
    const next = totalValueHistory.filter(e => e.date !== dateIso);
    setTotalValueHistory(next);
    persist(deposits, accounts, bills, actions, goals, undefined, undefined, next);
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
          <thead><tr><th>Bank</th><th>Type</th><th>Owner</th><th>Nominee</th><th>Invested</th><th>ROI</th><th>Maturity</th><th>Matures</th><th>Days to mature</th></tr></thead>
          <tbody>
            ${deposits.map(d => {
              const days = daysUntil(d.maturityDate);
              return `<tr>
                <td><strong>${d.bank}</strong><br><small style="color:#9ca3af">${d.depositId||''}</small></td>
                <td>${d.type}</td>
                <td>${d.accountOwner || '—'}</td>
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
          <thead><tr><th>Bank</th><th>Type</th><th>Holders</th><th>Nominee</th><th>Balance</th><th>ROI</th><th>Next Action</th><th>Notes</th></tr></thead>
          <tbody>
            ${accounts.map(a => `<tr>
              <td><strong>${a.bank}</strong></td>
              <td>${a.type}</td>
              <td>${a.holders}</td>
              <td>${a.nominee || '—'}</td>
              <td>${fmt(a.amount)}</td>
              <td>${a.roi ? (Number(a.roi)*100).toFixed(2)+'%' : '—'}</td>
              <td>${a.nextAction||'—'}</td>
              <td>${accountNotesDetail(a).replace(/</g,'&lt;') || '—'}</td>
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
              <td>${fmt(b.amount, (b.currency || 'INR') as Currency)}</td>
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
    await downloadBankRecordsTemplate();
  }

  function saveModal() {
    const now = new Date().toISOString();
    const {type,mode,idx}=modal!;
    if(type==="deposit"){
      const d=[...deposits];
      const depForm = form as Deposit;
      const cur = (depForm.currency || 'INR') as Currency;
      const label = [depForm.bank, depForm.type].filter(Boolean).join(' ') || 'Deposit';
      if(mode==="add"){
        const withHistory = { ...form, lastBalanceUpdatedAt: now, balanceHistory: [{ date: now, amount: Number(form.deposit)||0, source: `${label} (created)` }] };
        d.push(withHistory);
        save(d,accounts,bills,actions, undefined, { recordTotalValue: true, totalValueSource: `${label} (created)` });
      } else {
        const prev = deposits[idx!];
        const prevAmt = Number(prev.deposit)||0;
        const newAmt = Number(form.deposit)||0;
        const delta = newAmt - prevAmt;
        const deltaStr = delta >= 0 ? `+${fmt(delta, cur)}` : fmt(delta, cur);
        const sourceLabel = prevAmt !== newAmt ? `${label} ${deltaStr}` : 'Manual edit';
        const withHistory = prevAmt !== newAmt
          ? { ...form, lastBalanceUpdatedAt: now, balanceHistory: [...(prev.balanceHistory||[]), { date: now, amount: newAmt, previousAmount: prevAmt, source: sourceLabel }] }
          : form;
        d[idx!]=withHistory;
        save(d,accounts,bills,actions, undefined, { recordTotalValue: true, totalValueSource: sourceLabel });
      }
    }
    else if(type==="account"){
      const a=[...accounts];
      const accForm = form as BankAccount;
      const cur = (accForm.currency || 'INR') as Currency;
      const label = [accForm.bank, accForm.type].filter(Boolean).join(' ') || 'Account';
      if(mode==="add"){
        const withHistory = { ...form, lastBalanceUpdatedAt: now, balanceHistory: [{ date: now, amount: Number(form.amount)||0, source: `${label} (created)` }] };
        a.push(withHistory);
        save(deposits,a,bills,actions, undefined, { recordTotalValue: true, totalValueSource: `${label} (created)` });
      } else {
        const prev = accounts[idx!];
        const prevAmt = Number(prev.amount)||0;
        const newAmt = Number(form.amount)||0;
        const delta = newAmt - prevAmt;
        const deltaStr = delta >= 0 ? `+${fmt(delta, cur)}` : fmt(delta, cur);
        const sourceLabel = prevAmt !== newAmt ? `${label} ${deltaStr}` : 'Manual edit';
        const withHistory = prevAmt !== newAmt
          ? { ...form, lastBalanceUpdatedAt: now, balanceHistory: [...(prev.balanceHistory||[]), { date: now, amount: newAmt, previousAmount: prevAmt, source: sourceLabel }] }
          : form;
        a[idx!]=withHistory;
        save(deposits,a,bills,actions, undefined, { recordTotalValue: true, totalValueSource: sourceLabel });
      }
    }
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
  
  // FD invested / est. maturity (overview): accounts with type FD only — same basis as net worth / portfolio bar
  const accountsFdInvested = accounts.filter(a => a.type === "FD").reduce((s,a) => 
    s + convertCurrency(Number(a.amount) || 0, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates), 0);
  const accountsFdMaturity = accounts.filter(a => a.type === "FD").reduce((s,a) => {
    const principal = Number(a.amount) || 0;
    const roi = Number(a.roi) || 0.07;
    const maturityVal = principal * (1 + roi);
    return s + convertCurrency(maturityVal, (a.currency || 'INR') as Currency, targetCurrency, exchangeRates);
  }, 0);
  const totalInvested = accountsFdInvested;
  const totalMaturity = accountsFdMaturity;
  
  /** Sum of all account balances (portfolio / net worth); Deposits tab not added here */
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

  const linkedFromRecords = useMemo(
    () => collectLinkedNextActions(accounts, deposits, bills),
    [accounts, deposits, bills]
  );

  /** Deposits tab principal (all rows), converted — matches Overview mobile “Deposits” tile; not the same as FD-only account balances */
  const depositsTablePrincipalConverted = useMemo(
    () =>
      deposits.reduce(
        (s, d) =>
          s +
          convertCurrency(
            Number(d.deposit) || 0,
            (d.currency || "INR") as Currency,
            targetCurrency,
            exchangeRates
          ),
        0
      ),
    [deposits, targetCurrency, exchangeRates]
  );

  /** Same items as Actions tab default view: pending manual + linked “Next action” rows */
  const overviewActionsCount = useMemo(
    () => actions.filter((a) => !a.done).length + linkedFromRecords.length,
    [actions, linkedFromRecords]
  );

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
      .map(([name, value]) => ({ name, value, color: getBankColor(name) }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [accounts, displayCurrency, exchangeRates]);

  /** Donut: merge tail into "Other" so the chart stays legible; major banks remain as their own slices */
  const ACCOUNTS_PIE_TOP_N = 6;
  const accountsPieMerged = useMemo(() => {
    type Slice = {
      name: string;
      value: number;
      color: string;
      otherDetails?: { name: string; value: number }[];
    };
    const sorted = [...accountsPieData].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    if (sorted.length <= ACCOUNTS_PIE_TOP_N) return sorted as Slice[];
    const top = sorted.slice(0, ACCOUNTS_PIE_TOP_N);
    const rest = sorted.slice(ACCOUNTS_PIE_TOP_N);
    const otherValue = rest.reduce((s, x) => s + x.value, 0);
    const merged: Slice[] = [
      ...top,
      {
        name: `Other (${rest.length} banks)`,
        value: otherValue,
        color: '#64748B',
        otherDetails: rest.map((r) => ({ name: r.name, value: r.value })),
      },
    ];
    return merged;
  }, [accountsPieData]);

  /** Horizontal bar chart: same data, largest at top — every bank name visible on the axis */
  const accountsBarChartData = useMemo(
    () => [...accountsPieData].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    [accountsPieData]
  );

  const accountsBankTotalConverted = useMemo(
    () => accountsPieData.reduce((s, e) => s + e.value, 0),
    [accountsPieData]
  );

  const accountsBankCur = displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency;

  const accountsBankPieTooltip = useCallback(
    (props: { active?: boolean; payload?: ReadonlyArray<{ payload: { name: string; value: number; otherDetails?: { name: string; value: number }[] } }> }) => {
      const { active, payload } = props;
      if (!active || !payload?.length) return null;
      const p = payload[0].payload;
      const total = accountsBankTotalConverted || 1;
      const pct = (p.value / total) * 100;
      return (
        <div style={{ padding: 8, minWidth: 160, maxWidth: 280 }}>
          <div style={{ fontWeight: 700, color: THEME.text, marginBottom: 4 }}>{p.name}</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{fmt(p.value, accountsBankCur)}</div>
          <div style={{ fontSize: 11, color: THEME.textLight }}>{pct.toFixed(1)}% of portfolio (this chart)</div>
          {p.otherDetails && p.otherDetails.length > 0 && (
            <div
              style={{
                marginTop: 8,
                fontSize: 10,
                borderTop: `1px solid ${THEME.border}`,
                paddingTop: 6,
                maxHeight: 140,
                overflowY: 'auto',
              }}
            >
              {p.otherDetails.map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: THEME.textLight, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                  <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmt(row.value, accountsBankCur)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    },
    [THEME.text, THEME.textLight, THEME.border, accountsBankTotalConverted, accountsBankCur]
  );

  const accountsBankBarTooltip = useCallback(
    (props: { active?: boolean; payload?: ReadonlyArray<{ payload: { name: string; value: number } }> }) => {
      const { active, payload } = props;
      if (!active || !payload?.length) return null;
      const p = payload[0].payload;
      const total = accountsBankTotalConverted || 1;
      const pct = (p.value / total) * 100;
      return (
        <div style={{ padding: 8, minWidth: 140 }}>
          <div style={{ fontWeight: 700, color: THEME.text }}>{p.name}</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{fmt(p.value, accountsBankCur)}</div>
          <div style={{ fontSize: 11, color: THEME.textLight }}>{pct.toFixed(1)}%</div>
        </div>
      );
    },
    [THEME.text, THEME.textLight, accountsBankTotalConverted, accountsBankCur]
  );
  
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

  // Portfolio value over time (from totalValueHistory) — sorted by date; timestamp for time-scaled X-axis (min–max), dateLabel for tooltips
  const portfolioHistoryChartData = useMemo(() => {
    if (!totalValueHistory?.length) return [];
    const sorted = [...totalValueHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const dayCounts = sorted.reduce((m, e) => { const k = new Date(e.date).toDateString(); m.set(k, (m.get(k) || 0) + 1); return m; }, new Map<string, number>());
    const points: PortfolioHistoryChartPoint[] = sorted.map(e => {
      const d = new Date(e.date);
      const dayKey = d.toDateString();
      const sameDayCount = dayCounts.get(dayKey) ?? 1;
      const dateLabel = sameDayCount > 1
        ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : (sorted.length > 12 ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }));
      return {
        timestamp: d.getTime(),
        dateLabel,
        fullDate: e.date,
        totalAccountValue: Number(e.totalAccountValue) || 0,
        totalDepositValue: Number(e.totalDepositValue) || 0,
        source: e.source,
      };
    });
    // Extend timeline to end of today: same values as last snapshot so the line runs flat to “today” on the X axis
    const last = points[points.length - 1];
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endTs = endOfToday.getTime();
    if (last && last.timestamp < endTs) {
      points.push({
        ...last,
        timestamp: endTs,
        dateLabel: 'Today',
        fullDate: endOfToday.toISOString(),
        source: 'Carried forward (no new snapshot)',
        isProjected: true,
      });
    }
    return points;
  }, [totalValueHistory]);

  const portfolioHistorySnapshotCount = useMemo(
    () => portfolioHistoryChartData.filter(p => !p.isProjected).length,
    [portfolioHistoryChartData]
  );

  // X-axis domain: min snapshot → at least end of today so the axis doesn’t stop at the last save date
  const portfolioHistoryXDomain = useMemo((): [number, number] | undefined => {
    if (!portfolioHistoryChartData.length) return undefined;
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endTs = endOfToday.getTime();
    const ts = portfolioHistoryChartData.map(p => p.timestamp);
    const minTs = Math.min(...ts);
    const maxTs = Math.max(Math.max(...ts), endTs);
    const span = maxTs - minTs || 1;
    const pad = Math.max(span * 0.02, 60 * 1000); // 2% or 1 min padding
    return [minTs - pad, maxTs + pad];
  }, [portfolioHistoryChartData]);

  // Y-axis domain: stacked chart total = accounts + deposits per snapshot (top of stack)
  const portfolioHistoryYDomain = useMemo((): [number, number] | undefined => {
    if (!portfolioHistoryChartData.length) return undefined;
    const totals = portfolioHistoryChartData.map(
      p => (Number(p.totalAccountValue) || 0) + (Number(p.totalDepositValue) || 0)
    );
    const dataMin = Math.min(0, ...totals);
    const dataMax = Math.max(...totals, 1);
    const range = dataMax - dataMin || 1;
    const padding = range > 0 ? Math.max(range * 0.08, 1) : Math.max(Math.abs(dataMin) * 0.05, 1);
    return [dataMin - padding, dataMax + padding];
  }, [portfolioHistoryChartData]);

  const mainTabs = [
    {id:"overview",  icon:"📊", label:"Overview", key:"1"},
    {id:"accounts",  icon:"🏦", label:"Accounts", key:"2"},
    {id:"deposits",  icon:"💰", label:"Deposits", key:"3"},
    {id:"bills",     icon:"📋", label:"Bills", key:"4"},
  ];
  const moreTabs = [
    {id:"timeline",  icon:"📅", label:"Timeline", key:"5"},
    {id:"actions",   icon:"⚡", label:"Actions", key:"6"},
  ];
  const allTabs = [...mainTabs, ...moreTabs];
  
  const banks = Array.from(new Set(deposits.map(d => d.bank).filter(Boolean)));
  const filtered = deposits.filter(d => {
    if (filterBank && filterBank !== "All" && d.bank !== filterBank) return false;
    if (
      search &&
      !`${d.bank} ${d.nominee} ${d.depositId} ${d.accountOwner || ""} ${d.nextAction || ""}`.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  // ── Next 30 days: FD maturities + manual actions (due) + linked Next action rows (resolved date) ──
  const next30DaysUnified = useMemo(() => {
    const rows: Next30DayRow[] = [];
    deposits.forEach((d) => {
      if (d.done) return;
      const days = daysUntil(d.maturityDate);
      if (days !== null && days >= 0 && days <= 30) {
        rows.push({
          kind: 'maturity',
          title: `${d.type || 'FD'} matures`,
          bank: d.bank || d.depositId || d.type || 'Unnamed',
          date: d.maturityDate,
          days,
          amount: String(d.maturityAmt),
          currency: d.currency || 'INR',
          sourceField: 'Maturity date',
        });
      }
    });
    actions.forEach((a) => {
      if (a.done) return;
      const days = daysUntil(a.date);
      if (days !== null && days <= 30) {
        rows.push({
          kind: 'manual',
          title: a.title,
          bank: a.bank || '',
          date: a.date,
          days,
          sourceField: 'Due date',
        });
      }
    });
    linkedFromRecords.forEach((row) => {
      if (!row.date || !String(row.date).trim()) return;
      const days = daysUntil(row.date);
      if (days === null || days > 30) return;
      const sourceField =
        row.source === 'account'
          ? 'Account · Next action'
          : row.source === 'deposit'
            ? 'Deposit · Next action'
            : 'Bill · Next action';
      rows.push({
        kind: 'linked',
        title: row.title,
        bank: row.bank,
        date: row.date,
        days,
        sourceField,
        linkedSource: row.source,
      });
    });
    rows.sort((x, y) => x.days - y.days);
    return rows;
  }, [deposits, actions, linkedFromRecords]);

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
                📊 {pendingImportsCount}{!isMobile && " Pending"}
              </button>
            )}
            <button onClick={handleExportTemplate} style={{background:"rgba(255,255,255,0.15)",color:"white",border:"1px solid rgba(255,255,255,0.2)",borderRadius:6,padding:isMobile?"5px 8px":"6px 10px",fontSize:isMobile?10:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}} title="Download Excel template">📥{!isMobile && " Template"}</button>
            <button onClick={()=>fileRef.current?.click()} style={{background:"white",color:THEME.accent,border:"none",borderRadius:6,padding:isMobile?"5px 8px":"6px 10px",fontSize:isMobile?10:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}} title="Import Excel">📂{!isMobile && " Import"}</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleExcel(e.target.files[0]);e.target.value="";}} />
            <button onClick={handleClearAll} style={{background:"rgba(255,255,255,0.15)",color:"#fecaca",border:"1px solid rgba(255,255,255,0.2)",borderRadius:6,padding:isMobile?"5px 8px":"6px 10px",fontSize:isMobile?10:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}} title="Clear all financial data">🗑{!isMobile && " Clear"}</button>
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
          <BankOverviewTab
            theme={THEME}
            isMobile={isMobile}
            deposits={deposits}
            accounts={accounts}
            bills={bills}
            actions={actions}
            goals={goals}
            displayCurrency={displayCurrency}
            setDisplayCurrency={setDisplayCurrency}
            exchangeRates={exchangeRates}
            targetCurrency={targetCurrency}
            netWorthConverted={netWorthConverted}
            sumConverted={sumConverted}
            totalInvested={totalInvested}
            totalMaturity={totalMaturity}
            depositsPrincipalConverted={depositsTablePrincipalConverted}
            next30DaysUnified={next30DaysUnified}
            overviewActionsCount={overviewActionsCount}
            portfolioHistoryChartData={portfolioHistoryChartData}
            portfolioHistoryXDomain={portfolioHistoryXDomain}
            portfolioHistoryYDomain={portfolioHistoryYDomain}
            portfolioHistorySnapshotCount={portfolioHistorySnapshotCount}
            showPortfolioHistory={showPortfolioHistory}
            setShowPortfolioHistory={setShowPortfolioHistory}
            clearPortfolioHistory={clearPortfolioHistory}
            deletePortfolioHistoryEntry={deletePortfolioHistoryEntry}
            setShowRatesModal={setShowRatesModal}
            show30Days={show30Days}
            setShow30Days={setShow30Days}
            expandedBanks={expandedBanks}
            setExpandedBanks={setExpandedBanks}
            setTab={setTab}
            persist={persist}
            totalValueHistory={totalValueHistory}
            toggleDone={toggleDone}
            getBankColor={getBankColor}
          />
        )}

        {/* ══ TIMELINE TAB ═══════════════════════════════════════════ */}
        {tab === "timeline" && (
          <BankTimelineTab
            theme={THEME}
            sortedDeps={sortedDeps}
            deposits={deposits}
            showDone={showDone}
            setShowDone={setShowDone}
            onToggleDepositDone={(idx) => toggleDone("deposit", idx)}
            onEditDeposit={(idx) => openEdit("deposit", idx)}
          />
        )}

        {/* ══ ACTIONS TAB ════════════════════════════════════════════ */}
        {tab === "actions" && (
          <BankActionsTab
            theme={THEME}
            actions={actions}
            linkedFromRecords={linkedFromRecords}
            showDone={showDone}
            setShowDone={setShowDone}
            isMobile={isMobile}
            actionsViewMode={actionsViewMode}
            setActionsViewMode={setActionsViewMode}
            onToggleActionDone={(idx) => toggleDone("action", idx)}
            onEditAction={(idx) => openEdit("action", idx)}
            onDeleteAction={(idx) => deleteRow("action", idx)}
            onAddAction={() => openAdd("action")}
            onEditLinked={(source, idx) => {
              const t = source === "account" ? "account" : source === "deposit" ? "deposit" : "bill";
              openEdit(t, idx);
            }}
          />
        )}

        {/* ══ DEPOSITS TAB - Table with Collapsible Bank Groups ═══════════ */}
                {tab === "deposits" && (
          <BankDepositsTab
            theme={THEME}
            deposits={deposits}
            filtered={filtered}
            banks={banks}
            isMobile={isMobile}
            search={search}
            setSearch={setSearch}
            filterBank={filterBank}
            setFilterBank={setFilterBank}
            depositsViewMode={depositsViewMode}
            setDepositsViewMode={setDepositsViewMode}
            expandedBanks={expandedBanks}
            setExpandedBanks={setExpandedBanks}
            showLegend={showLegend}
            setShowLegend={setShowLegend}
            typePieData={typePieData}
            openAdd={openAdd}
            openEdit={openEdit}
            deleteRow={deleteRow}
            toggleDone={toggleDone}
          />
        )}

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
          
          // Sort accounts within each bank (label order), then rebuild indices for edit/delete
          Object.values(grouped).forEach((g) => {
            g.accounts.sort((a, b) => {
              const ka = [a.type || '', a.holders || '', a.bank || ''].join('\0');
              const kb = [b.type || '', b.holders || '', b.bank || ''].join('\0');
              return ka.localeCompare(kb, undefined, { sensitivity: 'base' });
            });
            g.indices = g.accounts.map((acc) => accounts.indexOf(acc));
          });

          // Bank sections A–Z (matches “Banks” list under the pie chart)
          const bankNames = Object.keys(grouped).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
          );
          
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
                            onClick={() => { setDisplayCurrency(cur); persist(deposits, accounts, bills, actions, goals, exchangeRates, cur, totalValueHistory); }}
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
                                          {acc.nominee && <div style={{fontSize:10,color:"#6B7280"}}>Nominee: {acc.nominee}</div>}
                                          {accountNotesDetail(acc) ? (
                                            <div style={{fontSize:10,color:THEME.textMuted,marginTop:4,whiteSpace:"pre-wrap",maxHeight:56,overflow:"hidden"}}>{accountNotesDetail(acc)}</div>
                                          ) : null}
                                          {(() => {
                                            const stale = daysSinceUpdated(acc.lastBalanceUpdatedAt);
                                            return stale != null && stale >= 0 ? (
                                              <div style={{fontSize:9,color: stale > 90 ? "#F59E0B" : "#6B7280",marginTop:4}}>
                                                Sheet updated {stale === 0 ? "today" : `${stale}d ago`}
                                              </div>
                                            ) : null;
                                          })()}
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
                {/* Mobile: Accounts by Bank — donut (merged) or bar chart; full bank list in legend */}
                {accountsPieData.length > 0 && (
                  <div style={{background:THEME.cardBg,borderRadius:14,padding:"14px",marginTop:12,border:`1px solid ${THEME.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:THEME.textLight}}>🏦 Accounts by Bank</div>
                        <div style={{fontSize:10,color:THEME.textMuted,marginTop:2}}>{accountsPieData.length} banks · converted</div>
                      </div>
                      <div style={{display:"flex",gap:2,background:THEME.cardBgAlt,borderRadius:8,padding:2,border:`1px solid ${THEME.border}`}}>
                        <button type="button" onClick={() => setAccountsBankViz("donut")} style={{border:"none",borderRadius:6,padding:"5px 10px",fontSize:10,fontWeight:700,cursor:"pointer",background:accountsBankViz==="donut"?"#238636":"transparent",color:accountsBankViz==="donut"?"#fff":THEME.textMuted}} title="Merged donut — major banks + Other">Donut</button>
                        <button type="button" onClick={() => setAccountsBankViz("bars")} style={{border:"none",borderRadius:6,padding:"5px 10px",fontSize:10,fontWeight:700,cursor:"pointer",background:accountsBankViz==="bars"?"#238636":"transparent",color:accountsBankViz==="bars"?"#fff":THEME.textMuted}} title="Every bank name on the axis">Bars</button>
                      </div>
                    </div>
                    {accountsBankViz === "donut" ? (
                      <div style={{position:"relative",width:"100%",minHeight:200}}>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={accountsPieMerged}
                              cx="50%"
                              cy="48%"
                              innerRadius={44}
                              outerRadius={68}
                              paddingAngle={2}
                              dataKey="value"
                              label={false}
                              labelLine={false}
                              stroke="#111827"
                              strokeWidth={1.5}
                            >
                              {accountsPieMerged.map((e, i) => (
                                <Cell key={i} fill={e.color} />
                              ))}
                            </Pie>
                            <Tooltip content={accountsBankPieTooltip} wrapperStyle={{ outline: "none" }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{position:"absolute",left:"50%",top:"44%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none",maxWidth:120}}>
                          <div style={{fontSize:9,color:THEME.textMuted,textTransform:"uppercase",letterSpacing:0.6}}>Total</div>
                          <div style={{fontSize:14,fontWeight:800,fontFamily:"monospace",color:THEME.text,lineHeight:1.2}}>{fmt(accountsBankTotalConverted, accountsBankCur)}</div>
                        </div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.min(420, Math.max(180, accountsBarChartData.length * 30))}>
                        <BarChart data={accountsBarChartData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }} barSize={16}>
                          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 9, fill: THEME.textMuted }} tickFormatter={(v) => fmt(Number(v), accountsBankCur)} />
                          <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 9, fill: THEME.text }} interval={0} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 12)}…` : v)} />
                          <Tooltip content={accountsBankBarTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                            {accountsBarChartData.map((e, i) => (
                              <Cell key={i} fill={e.color} stroke="#111827" strokeWidth={1} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    <p style={{fontSize:9,color:THEME.textMuted,marginTop:8,lineHeight:1.45,marginBottom:0}}>
                      {accountsBankViz === "donut"
                        ? `Donut uses top ${ACCOUNTS_PIE_TOP_N} banks by balance; smaller banks roll into “Other”. Hover a slice — or open the list below.`
                        : "Bar chart lists every bank on the left — best for reading names on mobile."}
                    </p>
                    <button type="button" onClick={() => setShowLegend(prev => prev.has('accounts_pie_mob') ? new Set([...prev].filter(k => k !== 'accounts_pie_mob')) : new Set([...prev, 'accounts_pie_mob']))} style={{marginTop:10,background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,color:THEME.textLight,padding:"6px 12px",borderRadius:8,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,transition:"transform 0.2s",transform:showLegend.has('accounts_pie_mob')?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                      All banks ({accountsPieData.length})
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
                      onClick={() => { setDisplayCurrency('ORIGINAL'); persist(deposits, accounts, bills, actions, goals, exchangeRates, 'ORIGINAL', totalValueHistory); }}
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
                        onClick={() => { setDisplayCurrency(cur); persist(deposits, accounts, bills, actions, goals, exchangeRates, cur, totalValueHistory); }}
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
                            {["Bank","Type","Holders","Nominee","Amount","Currency","ROI","A/C Number","IFSC","Branch","Online","Address","Notes","Action",""].map(h => (
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
                              const commonNominee = bankAccounts.every(a => (a.nominee || "") === (bankAccounts[0]?.nominee || "")) ? bankAccounts[0]?.nominee : null;
                              
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
                                    <td style={{padding:"8px 10px",color:THEME.text,fontSize:10,maxWidth:88,overflow:"hidden",textOverflow:"ellipsis"}} title={isSingleRow ? singleAcc?.nominee || "" : ""}>{isSingleRow ? (singleAcc?.nominee || "—") : (commonNominee || (bankAccounts.length > 1 ? "Various" : "—"))}</td>
                                    <td style={{padding:"8px 10px",fontFamily:"monospace",fontWeight:700,color:THEME.text,fontSize:11}}>{fmt(totalBalance, isSingleRow ? singleAccCurrency : headerCurrency)}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9}}>{isSingleRow ? singleAccCurrency : (isMixedCurrency ? "Mixed" : headerCurrency)}</td>
                                    <td style={{padding:"8px 10px",fontFamily:"monospace",color:THEME.accent,fontWeight:600,fontSize:10}}>{isSingleRow && singleAcc?.roi ? (Number(singleAcc.roi) * 100).toFixed(2) + "%" : "—"}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,fontFamily:"monospace"}}>{isSingleRow ? (singleAcc?.accountNumber || "—") : "—"}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,fontFamily:"monospace"}}>{isSingleRow ? (singleAcc?.ifscCode || "—") : "—"}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>{isSingleRow ? (singleAcc?.branch || "—") : "—"}</td>
                                    <td style={{padding:"8px 10px"}}>{isSingleRow && singleAcc?.online && <span style={{fontSize:9,color:singleAcc.online === "Yes" ? "#34D399" : "#6B7280",background:singleAcc.online === "Yes" ? "#064E3B30" : "${THEME.border}40",padding:"2px 4px",borderRadius:3}}>{singleAcc.online === "Yes" ? "🌐" : "—"}</span>}</td>
                                    <td style={{padding:"8px 10px",color:"#6B7280",fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>{isSingleRow ? (singleAcc?.address || "—") : "—"}</td>
                                    <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}} title={isSingleRow && singleAcc ? accountNotesDetail(singleAcc) : ""}>{isSingleRow && singleAcc ? (accountNotesDetail(singleAcc) || "—") : "—"}</td>
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
                                        <td style={{padding:"8px 10px",color:THEME.text,fontSize:10,maxWidth:88,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.nominee || ""}>{acc.nominee || "—"}</td>
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
                                        <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}} title={accountNotesDetail(acc)}>{accountNotesDetail(acc) || "—"}</td>
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
                            {["Bank","Type","Holders","Nominee","Amount","Currency","ROI","A/C Number","IFSC","Branch","Online","Address","Notes","Action",""].map(h => (
                              <th key={h} style={{padding:"8px 10px",textAlign:"left",color:THEME.textMuted,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {visibleAccounts.length === 0 ? (
                              <tr><td colSpan={15} style={{padding:32,textAlign:"center",color:THEME.textMuted}}>No accounts found</td></tr>
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
                                      <td style={{padding:"8px 10px",color:THEME.text,fontSize:10,maxWidth:88,overflow:"hidden",textOverflow:"ellipsis"}} title={acc.nominee || ""}>{acc.nominee || "—"}</td>
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
                                      <td style={{padding:"8px 10px",color:THEME.textLight,fontSize:9,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}} title={accountNotesDetail(acc)}>{accountNotesDetail(acc) || "—"}</td>
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
                                    <td colSpan={10} style={{padding:"12px 10px",color:THEME.textMuted,fontSize:10}}>Click to show all accounts</td>
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
                                        {acc.nominee && <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>Nominee: {acc.nominee}</div>}
                                        <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4,flexWrap:"wrap"}}>
                                          {acc.amount && <span style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:acc.done ? "#6B7280" : "#F9FAFB"}}>{fmt(acc.amount, (acc.currency || 'INR') as Currency)}</span>}
                                          {acc.roi && <span style={{fontSize:11,color:"#34D399",fontFamily:"monospace"}}>{(Number(acc.roi) * 100).toFixed(2)}% pa</span>}
                                        </div>
                                        {(() => {
                                          const stale = daysSinceUpdated(acc.lastBalanceUpdatedAt);
                                          return stale != null && stale >= 0 ? (
                                            <div style={{fontSize:9,color: stale > 90 ? "#F59E0B" : "#6B7280",marginTop:3}}>
                                              Balance row · {stale === 0 ? "updated today" : `${stale}d since update`}
                                            </div>
                                          ) : null;
                                        })()}
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
                                        {accountNotesDetail(acc) ? (
                                          <div style={{fontSize:10,color:THEME.textLight,marginTop:2,whiteSpace:"pre-wrap",maxHeight:72,overflow:"hidden"}}>📝 {accountNotesDetail(acc)}</div>
                                        ) : null}
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
                  
                  {/* Accounts by Bank — donut (merged slices + center total) or horizontal bars (every label) */}
                  <div style={{marginTop:16,background:THEME.cardBg,borderRadius:12,border:`1px solid ${THEME.border}`,padding:14}}>
                    {accountsPieData.length === 0 ? (
                      <div style={{color:THEME.textMuted,padding:20,textAlign:"center"}}>No account data</div>
                    ) : (
                      <>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:12}}>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:THEME.textLight}}>🏦 Accounts by Bank</div>
                            <div style={{fontSize:11,color:THEME.textMuted,marginTop:4,maxWidth:420}}>
                              Compare share of portfolio by bank (converted). <strong style={{color:THEME.text}}>Donut</strong> highlights majors + groups the rest; <strong style={{color:THEME.text}}>Bars</strong> shows every bank name clearly.
                            </div>
                          </div>
                          <div style={{display:"flex",gap:2,background:THEME.cardBgAlt,borderRadius:8,padding:3,border:`1px solid ${THEME.border}`}}>
                            <button type="button" onClick={() => setAccountsBankViz("donut")} style={{border:"none",borderRadius:6,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",background:accountsBankViz==="donut"?"#238636":"transparent",color:accountsBankViz==="donut"?"#fff":THEME.textMuted}}>Donut</button>
                            <button type="button" onClick={() => setAccountsBankViz("bars")} style={{border:"none",borderRadius:6,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",background:accountsBankViz==="bars"?"#238636":"transparent",color:accountsBankViz==="bars"?"#fff":THEME.textMuted}}>Bar chart</button>
                          </div>
                        </div>
                        {accountsBankViz === "donut" ? (
                          <div style={{position:"relative",width:"100%",minHeight:260}}>
                            <ResponsiveContainer width="100%" height={260}>
                              <PieChart>
                                <Pie
                                  data={accountsPieMerged}
                                  cx="50%"
                                  cy="48%"
                                  innerRadius={58}
                                  outerRadius={92}
                                  paddingAngle={2}
                                  dataKey="value"
                                  label={false}
                                  labelLine={false}
                                  stroke="#111827"
                                  strokeWidth={1.5}
                                >
                                  {accountsPieMerged.map((e, i) => (
                                    <Cell key={i} fill={e.color} />
                                  ))}
                                </Pie>
                                <Tooltip content={accountsBankPieTooltip} wrapperStyle={{ outline: "none" }} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div style={{position:"absolute",left:"50%",top:"44%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none",maxWidth:160}}>
                              <div style={{fontSize:10,color:THEME.textMuted,textTransform:"uppercase",letterSpacing:0.8}}>Total (converted)</div>
                              <div style={{fontSize:18,fontWeight:800,fontFamily:"monospace",color:THEME.text,lineHeight:1.2}}>{fmt(accountsBankTotalConverted, accountsBankCur)}</div>
                              <div style={{fontSize:10,color:THEME.textMuted,marginTop:2}}>{accountsPieData.length} banks</div>
                            </div>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={Math.min(520, Math.max(240, accountsBarChartData.length * 34))}>
                            <BarChart data={accountsBarChartData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }} barSize={20}>
                              <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 11, fill: THEME.textMuted }} tickFormatter={(v) => fmt(Number(v), accountsBankCur)} />
                              <YAxis type="category" dataKey="name" width={132} tick={{ fontSize: 11, fill: THEME.text }} interval={0} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 20)}…` : v)} />
                              <Tooltip content={accountsBankBarTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                {accountsBarChartData.map((e, i) => (
                                  <Cell key={i} fill={e.color} stroke="#111827" strokeWidth={1} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                        <p style={{fontSize:10,color:THEME.textMuted,marginTop:10,lineHeight:1.5,marginBottom:0}}>
                          {accountsBankViz === "donut"
                            ? `Slices are sorted by size. Only the top ${ACCOUNTS_PIE_TOP_N} banks get their own slice; the rest are combined into “Other” (hover to expand). Names are not drawn on the ring — use the legend or switch to Bar chart.`
                            : "Bars are sorted largest at the top. Each row is one bank with full name on the axis."}
                        </p>
                        <button type="button" onClick={() => setShowLegend(prev => prev.has('accounts_pie') ? new Set([...prev].filter(k => k !== 'accounts_pie')) : new Set([...prev, 'accounts_pie']))} style={{marginTop:12,background:THEME.cardBgAlt,border:`1px solid ${THEME.border}`,color:THEME.textLight,padding:"6px 12px",borderRadius:6,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:10,transition:"transform 0.2s",transform:showLegend.has('accounts_pie')?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                          Full bank list ({accountsPieData.length})
                        </button>
                        {showLegend.has('accounts_pie') && (
                          <>
                            <div style={{marginTop:8,fontSize:11,color:THEME.textLight,marginBottom:6}}>All banks · same order as account cards (by balance)</div>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,maxHeight:240,overflowY:"auto"}}>
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
          <BankBillsTab
            theme={THEME}
            bills={bills}
            isMobile={isMobile}
            showDone={showDone}
            setShowDone={setShowDone}
            billsViewMode={billsViewMode}
            setBillsViewMode={setBillsViewMode}
            targetCurrency={targetCurrency}
            exchangeRates={exchangeRates}
            openAdd={openAdd}
            openEdit={openEdit}
            deleteRow={deleteRow}
            toggleDone={toggleDone}
          />
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
                <div><label style={labelSt}>Account Owner</label><input style={inputSt} value={(form as Deposit).accountOwner||""} onChange={e=>setForm({...form,accountOwner:e.target.value})} placeholder="Owner(s), one field" /></div>
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
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Next Action</label><input style={inputSt} value={(form as Deposit).nextAction||""} onChange={e=>setForm({...form,nextAction:e.target.value})} placeholder="Follow-up task (also on Actions tab)" /></div>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Notes</label><textarea style={{...inputSt,minHeight:60,resize:"vertical"}} value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
                {(form as Deposit).balanceHistory?.length > 0 && (() => {
                  const hist = (form as Deposit).balanceHistory!;
                  const amounts = hist.map((h: { amount: number }) => Number(h.amount) || 0);
                  const minAmt = Math.min(...amounts, 0);
                  const maxAmt = Math.max(...amounts, 1);
                  const range = maxAmt - minAmt || 1;
                  const w = 280; const h = 56;
                  const barW = Math.max(4, (w - (hist.length - 1) * 4) / hist.length);
                  return (
                  <div style={{gridColumn:"span 2",padding:"12px 0",borderTop:`1px solid ${THEME.border}`,marginTop:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:THEME.text,marginBottom:6}}>📈 Amount history</div>
                    <div style={{fontSize:10,color:THEME.textLight,marginBottom:8}}>Updates from imports and edits.</div>
                    <div style={{marginBottom:10}}>
                      <svg width={w} height={h} style={{display:"block",maxWidth:"100%"}}>
                        {amounts.map((amt, i) => {
                          const norm = range ? (amt - minAmt) / range : 0;
                          const barH = Math.max(2, norm * (h - 8));
                          const y = h - 4 - barH;
                          const x = i * (barW + 4);
                          return (
                            <rect key={i} x={x} y={y} width={barW} height={barH} rx={2} fill="rgba(16,185,129,0.7)" />
                          );
                        })}
                      </svg>
                      <div style={{fontSize:9,color:THEME.textLight,display:"flex",justifyContent:"space-between",marginTop:2}}>
                        <span>{hist.length > 0 ? new Date(hist[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : ''}</span>
                        <span>{hist.length > 0 ? new Date(hist[hist.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:140,overflowY:"auto"}}>
                      {hist.map((h: { date: string; amount: number; previousAmount?: number; source?: string }, i: number) => (
                        <div key={i} style={{fontSize:11,color:THEME.text,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
                          <span>{new Date(h.date).toLocaleDateString(undefined, { dateStyle: 'short' })} {h.source && <span style={{color:THEME.textLight}}>· {h.source}</span>}</span>
                          <span style={{fontFamily:"monospace",fontWeight:600}}>
                            {h.previousAmount != null ? `${fmt(h.previousAmount, (form as Deposit).currency as Currency)} → ` : ''}{fmt(h.amount, (form as Deposit).currency as Currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })()}
              </div>
            )}

            {/* Account Form */}
            {modal.type === "account" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Bank</label><input style={inputSt} value={form.bank||""} onChange={e=>setForm({...form,bank:e.target.value})} placeholder="e.g. SBI, Axis" /></div>
                <div><label style={labelSt}>Type</label><input style={inputSt} value={form.type||""} onChange={e=>setForm({...form,type:e.target.value})} placeholder="Saving, Current, Checking" /></div>
                <div><label style={labelSt}>Currency</label><select style={inputSt} value={(form as BankAccount).currency||"INR"} onChange={e=>setForm({...form,currency:e.target.value})}>{CURRENCIES.map(c=><option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}</select></div>
                <div><label style={labelSt}>Holders</label><input style={inputSt} value={form.holders||""} onChange={e=>setForm({...form,holders:e.target.value})} placeholder="Account holders" /></div>
                <div><label style={labelSt}>Nominee</label><input style={inputSt} value={(form as BankAccount).nominee||""} onChange={e=>setForm({...form,nominee:e.target.value})} /></div>
                <div><label style={labelSt}>Balance ({CURRENCY_SYMBOLS[((form as BankAccount).currency as Currency) || 'INR']})</label><input style={inputSt} type="number" value={form.amount||""} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
                <div><label style={labelSt}>ROI (decimal)</label><input style={inputSt} type="number" step="0.001" value={form.roi||""} onChange={e=>setForm({...form,roi:e.target.value})} /></div>
                <div><label style={labelSt}>Online Banking</label><input style={inputSt} value={form.online||""} onChange={e=>setForm({...form,online:e.target.value})} placeholder="Yes/No" /></div>
                <div><label style={labelSt}>Address</label><input style={inputSt} value={form.address||""} onChange={e=>setForm({...form,address:e.target.value})} /></div>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Details</label><input style={inputSt} value={form.detail||""} onChange={e=>setForm({...form,detail:e.target.value})} placeholder="Short detail (legacy)" /></div>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Notes</label><textarea style={{...inputSt,minHeight:72,resize:"vertical"}} value={(form as BankAccount).notes||""} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Limits, Extra Info, Info 1/2 (combined from Excel)" /></div>
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
                {(form as BankAccount).balanceHistory?.length > 0 && (() => {
                  const hist = (form as BankAccount).balanceHistory!;
                  const amounts = hist.map((h: { amount: number }) => Number(h.amount) || 0);
                  const minAmt = Math.min(...amounts, 0);
                  const maxAmt = Math.max(...amounts, 1);
                  const range = maxAmt - minAmt || 1;
                  const w = 280; const h = 56;
                  const barW = Math.max(4, (w - (hist.length - 1) * 4) / hist.length);
                  return (
                  <div style={{gridColumn:"span 2",padding:"12px 0",borderTop:`1px solid ${THEME.border}`,marginTop:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:THEME.text,marginBottom:6}}>📈 Balance history</div>
                    <div style={{fontSize:10,color:THEME.textLight,marginBottom:8}}>Updates from imports and edits. View when editing this account.</div>
                    {/* Simple bar chart */}
                    <div style={{marginBottom:10}}>
                      <svg width={w} height={h} style={{display:"block",maxWidth:"100%"}}>
                        {amounts.map((amt, i) => {
                          const norm = range ? (amt - minAmt) / range : 0;
                          const barH = Math.max(2, norm * (h - 8));
                          const y = h - 4 - barH;
                          const x = i * (barW + 4);
                          return (
                            <rect key={i} x={x} y={y} width={barW} height={barH} rx={2} fill={amt >= 0 ? "rgba(16,185,129,0.7)" : "rgba(239,68,68,0.7)"} />
                          );
                        })}
                      </svg>
                      <div style={{fontSize:9,color:THEME.textLight,display:"flex",justifyContent:"space-between",marginTop:2}}>
                        <span>{hist.length > 0 ? new Date(hist[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : ''}</span>
                        <span>{hist.length > 0 ? new Date(hist[hist.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:140,overflowY:"auto"}}>
                      {hist.map((h: { date: string; amount: number; previousAmount?: number; source?: string }, i: number) => (
                        <div key={i} style={{fontSize:11,color:THEME.text,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
                          <span>{new Date(h.date).toLocaleDateString(undefined, { dateStyle: 'short' })} {h.source && <span style={{color:THEME.textLight}}>· {h.source}</span>}</span>
                          <span style={{fontFamily:"monospace",fontWeight:600}}>
                            {h.previousAmount != null ? `${fmt(h.previousAmount, (form as BankAccount).currency as Currency)} → ` : ''}{fmt(h.amount, (form as BankAccount).currency as Currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })()}
              </div>
            )}

            {/* Bill Form */}
            {modal.type === "bill" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Bill Name</label><input style={inputSt} value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Electricity, Internet" /></div>
                <div><label style={labelSt}>Frequency</label><input style={inputSt} value={form.freq||""} onChange={e=>setForm({...form,freq:e.target.value})} placeholder="Monthly, Quarterly" /></div>
                <div><label style={labelSt}>Amount ({CURRENCY_SYMBOLS[(form as Bill).currency as Currency] || '₹'})</label><input style={inputSt} type="number" value={form.amount||""} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
                <div><label style={labelSt}>Due Day</label><input style={inputSt} value={form.due||""} onChange={e=>setForm({...form,due:e.target.value})} placeholder="15th" /></div>
                <div><label style={labelSt}>Priority</label><input style={inputSt} value={form.priority||""} onChange={e=>setForm({...form,priority:e.target.value})} placeholder="Normal, High" /></div>
                <div><label style={labelSt}>Phone</label><input style={inputSt} value={form.phone||""} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
                <div><label style={labelSt}>Email</label><input style={inputSt} value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})} /></div>
                <div style={{gridColumn:"span 2"}}><label style={labelSt}>Next Action</label><input style={inputSt} value={(form as Bill).nextAction||""} onChange={e=>setForm({...form,nextAction:e.target.value})} placeholder="Follow-up task (also on Actions tab)" /></div>
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
                onClick={() => { persist(deposits, accounts, bills, actions, goals, exchangeRates, displayCurrency, totalValueHistory); setShowRatesModal(false); }}
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
