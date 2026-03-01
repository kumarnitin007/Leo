/**
 * Financial Alerts Service
 * 
 * Generates alerts from encrypted bank records for display on home page.
 * Works with the Safe encryption system.
 */

import { BankRecordsData, FinancialAlert, Currency } from '../types/bankRecords';
import { CryptoKey, decryptData } from '../utils/encryption';
import getSupabaseClient from '../lib/supabase';

const CURRENCY_SYMBOLS: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatAmount(n: number, currency: Currency = 'INR'): string {
  const sym = CURRENCY_SYMBOLS[currency];
  if (currency === 'INR') {
    if (n >= 10000000) return sym + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return sym + (n / 100000).toFixed(2) + ' L';
  } else {
    if (n >= 1000000) return sym + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return sym + (n / 1000).toFixed(1) + 'K';
  }
  return sym + n.toLocaleString();
}

/**
 * Load and decrypt bank records for a user
 */
export async function loadBankRecords(
  userId: string,
  encryptionKey: CryptoKey
): Promise<BankRecordsData | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('myday_bank_records')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data?.data) return null;

    // Parse the stored JSON containing encrypted data and IV
    const { encrypted, iv } = JSON.parse(data.data);
    const decrypted = await decryptData(encrypted, iv, encryptionKey);
    return JSON.parse(decrypted) as BankRecordsData;
  } catch (e) {
    console.error('[FinancialAlerts] Failed to load records:', e);
    return null;
  }
}

/**
 * Generate financial alerts from bank records
 * @param data Bank records data
 * @param daysAhead Number of days ahead to look for alerts (default 30)
 */
export function generateAlerts(
  data: BankRecordsData,
  daysAhead: number = 30
): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];
  const now = new Date().toISOString();

  // Deposit maturity alerts
  data.deposits.forEach((d, i) => {
    if (d.done) return;
    const days = daysUntil(d.maturityDate);
    if (days !== null && days >= 0 && days <= daysAhead) {
      const severity = days <= 7 ? 'urgent' : days <= 14 ? 'warning' : 'info';
      alerts.push({
        id: `maturity-${i}`,
        type: 'maturity',
        title: `${d.bank} FD Maturing`,
        description: d.maturityAction || `${d.type} worth ${formatAmount(Number(d.maturityAmt) || Number(d.deposit), d.currency)} matures`,
        date: d.maturityDate,
        daysUntil: days,
        severity,
        relatedId: d.depositId,
        currency: d.currency,
        amount: Number(d.maturityAmt) || Number(d.deposit),
      });
    }
  });

  // Bill due alerts
  data.bills.forEach((b, i) => {
    if (b.done) return;
    // Bills don't have specific dates, so we include all non-done bills as reminders
    alerts.push({
      id: `bill-${i}`,
      type: 'bill_due',
      title: `Pay ${b.name}`,
      description: `${b.freq} bill${b.amount ? ': ' + formatAmount(Number(b.amount), b.currency) : ''}`,
      date: b.due || '',
      daysUntil: -1, // No specific date
      severity: b.priority === 'High' || b.priority === 'Urgent' ? 'warning' : 'info',
      currency: b.currency,
      amount: Number(b.amount) || undefined,
    });
  });

  // Action item alerts
  data.actions.forEach((a, i) => {
    if (a.done) return;
    const days = daysUntil(a.date);
    if (days !== null && days >= 0 && days <= daysAhead) {
      const severity = days <= 3 ? 'urgent' : days <= 7 ? 'warning' : 'info';
      alerts.push({
        id: `action-${i}`,
        type: 'action',
        title: a.title,
        description: a.bank ? `Related to ${a.bank}` : a.note || 'Financial action',
        date: a.date,
        daysUntil: days,
        severity,
      });
    } else if (!a.date) {
      // Actions without dates
      alerts.push({
        id: `action-${i}`,
        type: 'action',
        title: a.title,
        description: a.bank ? `Related to ${a.bank}` : a.note || 'Financial action',
        date: '',
        daysUntil: -1,
        severity: a.priority === 'Urgent' ? 'urgent' : a.priority === 'High' ? 'warning' : 'info',
      });
    }
  });

  // Goal milestone alerts (if close to deadline without enough progress)
  if (data.goals) {
    data.goals.forEach((g, i) => {
      if (g.done) return;
      const days = daysUntil(g.deadline);
      const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
      
      // Alert if deadline approaching and not enough progress
      if (days !== null && days >= 0 && days <= daysAhead && progress < 80) {
        alerts.push({
          id: `goal-${i}`,
          type: 'goal_milestone',
          title: `Goal: ${g.name}`,
          description: `${progress.toFixed(0)}% complete, ${days} days remaining`,
          date: g.deadline || '',
          daysUntil: days,
          severity: days <= 7 && progress < 50 ? 'urgent' : 'warning',
          currency: g.currency,
          amount: g.targetAmount - g.currentAmount,
        });
      }
    });
  }

  // Sort by severity and days until
  const severityOrder = { urgent: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    if (a.daysUntil === -1 && b.daysUntil === -1) return 0;
    if (a.daysUntil === -1) return 1;
    if (b.daysUntil === -1) return -1;
    return a.daysUntil - b.daysUntil;
  });

  return alerts;
}

/**
 * Get financial alerts for home page display
 * This is the main entry point for the home page
 */
export async function getFinancialAlerts(
  userId: string,
  encryptionKey: CryptoKey,
  daysAhead: number = 30
): Promise<FinancialAlert[]> {
  const data = await loadBankRecords(userId, encryptionKey);
  if (!data) return [];
  return generateAlerts(data, daysAhead);
}

/**
 * Get summary stats for home page widget
 */
export function getSummaryStats(data: BankRecordsData) {
  const totalInvested = data.deposits.reduce((s, d) => s + (Number(d.deposit) || 0), 0);
  const totalMaturity = data.deposits.reduce((s, d) => s + (Number(d.maturityAmt) || Number(d.deposit) || 0), 0);
  const accountBalance = data.accounts.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const pendingBills = data.bills.filter(b => !b.done).length;
  const pendingActions = data.actions.filter(a => !a.done).length;
  
  // Upcoming maturities (30 days)
  const upcomingMaturities = data.deposits.filter(d => {
    if (d.done) return false;
    const days = daysUntil(d.maturityDate);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  return {
    totalInvested,
    totalMaturity,
    expectedGain: totalMaturity - totalInvested,
    gainPercent: totalInvested > 0 ? ((totalMaturity - totalInvested) / totalInvested) * 100 : 0,
    accountBalance,
    netWorth: totalInvested + accountBalance,
    depositCount: data.deposits.length,
    accountCount: data.accounts.length,
    pendingBills,
    pendingActions,
    upcomingMaturities,
  };
}
