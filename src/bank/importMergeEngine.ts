/**
 * Import Merge Engine — computes diff between existing data and Excel import.
 * Standalone file — extracted from BankDashboard for maintainability.
 */
import type { Deposit, BankAccount, Bill, ActionItem, Currency } from '../types/bankRecords';
import type { BankRecordsExcelParseResult } from '../services/bankRecordsExcel';
import { bankAccountMergeKey, bankAccountMatchesDeleteKey } from '../services/bankRecordsExcel';
import { perfStart } from '../utils/perfLogger';

export type DiffAction = 'add' | 'update' | 'delete' | 'unchanged';

export interface ImportDiffItem {
  type: 'account' | 'deposit' | 'bill' | 'action';
  action: DiffAction;
  name: string;
  bank: string;
  accountType?: string;
  oldAmount?: number;
  newAmount?: number;
  currency?: string;
  details?: string;
}

export interface ImportDiffSummary {
  items: ImportDiffItem[];
  totalAdded: number;
  totalUpdated: number;
  totalDeleted: number;
  totalUnchanged: number;
  totalDeposits: number;
  totalAccounts: number;
  totalBills: number;
  totalActions: number;
  /** Net value impact converted to primary display currency */
  netValueImpact: number;
  addedValue: number;
  updatedValueDelta: number;
  deletedValue: number;
  /** Which currency the net values are expressed in */
  primaryCurrency: string;
  /** Same values but in INR for dual display */
  netValueImpactINR: number;
  addedValueINR: number;
  updatedValueDeltaINR: number;
  deletedValueINR: number;
}

export interface MergeResult {
  mergedDeposits: Deposit[];
  mergedAccounts: BankAccount[];
  mergedBills: Bill[];
  mergedActions: ActionItem[];
  diff: ImportDiffSummary;
}

interface FormatFn {
  (amount: number, currency: Currency): string;
}

type ExchangeRates = { USD: number; EUR: number; GBP: number };

function toINR(amount: number, cur: string, rates: ExchangeRates): number {
  if (cur === 'INR') return amount;
  return amount * (rates[cur as keyof ExchangeRates] || 1);
}

function fromINR(inrAmount: number, toCur: string, rates: ExchangeRates): number {
  if (toCur === 'INR') return inrAmount;
  const rate = rates[toCur as keyof ExchangeRates] || 1;
  return rate > 0 ? inrAmount / rate : inrAmount;
}

function depositsAreSame(existing: Deposit, incoming: Deposit): boolean {
  return (
    (Number(existing.deposit) || 0) === (Number(incoming.deposit) || 0) &&
    (existing.roi || '') === (incoming.roi || '') &&
    (existing.maturityDate || '') === (incoming.maturityDate || '') &&
    (existing.maturityAmt || '') === (incoming.maturityAmt || '')
  );
}

function accountsAreSame(existing: BankAccount, incoming: BankAccount): boolean {
  return (
    (Number(existing.amount) || 0) === (Number(incoming.amount) || 0) &&
    (existing.notes || '') === (incoming.notes || '')
  );
}

function billsAreSame(existing: Bill, incoming: Bill): boolean {
  return (
    (Number(existing.amount) || 0) === (Number(incoming.amount) || 0) &&
    (existing.freq || '') === (incoming.freq || '') &&
    (existing.due || '') === (incoming.due || '')
  );
}

function actionsAreSame(existing: ActionItem, incoming: ActionItem): boolean {
  return (
    existing.done === incoming.done &&
    (existing.date || '') === (incoming.date || '') &&
    (existing.priority || '') === (incoming.priority || '')
  );
}

export function buildImportDiff(
  parsed: BankRecordsExcelParseResult,
  existingDeposits: Deposit[],
  existingAccounts: BankAccount[],
  existingBills: Bill[],
  existingActions: ActionItem[],
  fmt: FormatFn,
  exchangeRates: ExchangeRates = { USD: 83, EUR: 90, GBP: 105 },
  displayCurrency: string = 'INR',
): MergeResult {
  const endPerf = perfStart('ImportEngine', 'buildImportDiff');

  const {
    newDeposits, newAccounts, newBills, newActions,
    deleteDeposits, deleteAccounts, deleteBills, deleteActions,
  } = parsed;

  const actionMergeKey = (a: ActionItem) =>
    `${a.title.trim().toLowerCase()}|${a.bank.trim().toLowerCase()}`;

  const diffItems: ImportDiffItem[] = [];
  let addedCount = 0, updatedCount = 0, deletedCount = 0, unchangedCount = 0;
  let depCount = 0, accCount = 0, billCount = 0, actCount = 0;
  let addedValueINR = 0, updatedValueDeltaINR = 0, deletedValueINR = 0;

  const touchedDepositKeys = new Set<string>();
  const touchedAccountKeys = new Set<string>();
  const touchedBillKeys = new Set<string>();
  const touchedActionKeys = new Set<string>();

  // ── Deletions ──
  let mergedDeposits = [...existingDeposits];
  deleteDeposits.forEach(del => {
    const key = del.depositId ? `${del.bank}|${del.depositId}` : `${del.bank}|${del.startDate}`;
    const idx = mergedDeposits.findIndex(d => {
      const ek = d.depositId ? `${d.bank}|${d.depositId}` : `${d.bank}|${d.startDate}`;
      return ek === key;
    });
    if (idx >= 0) {
      const amt = Number(mergedDeposits[idx].deposit) || 0;
      const cur = mergedDeposits[idx].currency || 'INR';
      diffItems.push({ type: 'deposit', action: 'delete', name: mergedDeposits[idx].bank, bank: mergedDeposits[idx].bank, oldAmount: amt, currency: cur });
      deletedValueINR += toINR(amt, cur, exchangeRates);
      mergedDeposits.splice(idx, 1);
      deletedCount++; depCount++;
    }
  });

  let mergedAccounts = [...existingAccounts];
  deleteAccounts.forEach(del => {
    const idx = mergedAccounts.findIndex(a => bankAccountMatchesDeleteKey(a, del));
    if (idx >= 0) {
      const amt = Number(mergedAccounts[idx].amount) || 0;
      const cur = mergedAccounts[idx].currency || 'INR';
      diffItems.push({ type: 'account', action: 'delete', name: mergedAccounts[idx].bank, bank: mergedAccounts[idx].bank, accountType: mergedAccounts[idx].type, oldAmount: amt, currency: cur });
      deletedValueINR += toINR(amt, cur, exchangeRates);
      mergedAccounts.splice(idx, 1);
      deletedCount++; accCount++;
    }
  });

  let mergedBills = [...existingBills];
  deleteBills.forEach(del => {
    const idx = mergedBills.findIndex(b => b.name.toLowerCase() === del.name.toLowerCase());
    if (idx >= 0) {
      diffItems.push({ type: 'bill', action: 'delete', name: mergedBills[idx].name, bank: '' });
      mergedBills.splice(idx, 1);
      deletedCount++; billCount++;
    }
  });

  let mergedActions = [...existingActions];
  deleteActions.forEach(del => {
    const idx = mergedActions.findIndex(a => a.title.trim().toLowerCase() === del.title.trim().toLowerCase() && a.bank.trim().toLowerCase() === del.bank.trim().toLowerCase());
    if (idx >= 0) {
      diffItems.push({ type: 'action', action: 'delete', name: mergedActions[idx].title, bank: mergedActions[idx].bank });
      mergedActions.splice(idx, 1);
      deletedCount++; actCount++;
    }
  });

  // ── Deposits: add / update / unchanged ──
  newDeposits.forEach(newDep => {
    const key = newDep.depositId ? `${newDep.bank}|${newDep.depositId}` : `${newDep.bank}|${newDep.startDate}`;
    touchedDepositKeys.add(key);
    const existingIdx = mergedDeposits.findIndex(d => {
      const ek = d.depositId ? `${d.bank}|${d.depositId}` : `${d.bank}|${d.startDate}`;
      return ek === key;
    });
    if (existingIdx >= 0) {
      const prev = mergedDeposits[existingIdx];
      const prevAmt = Number(prev.deposit) || 0;
      const newAmt = Number(newDep.deposit) || 0;

      if (depositsAreSame(prev, newDep)) {
        diffItems.push({ type: 'deposit', action: 'unchanged', name: newDep.bank, bank: newDep.bank, oldAmount: prevAmt, newAmount: newAmt, currency: newDep.currency || 'INR', details: newDep.depositId || newDep.startDate });
        unchangedCount++; depCount++;
      } else {
        let next: Deposit = { ...prev, ...newDep };
        if (prevAmt !== newAmt) {
          const histDate = newDep.lastBalanceUpdatedAt || new Date().toISOString();
          const depCur = (next.currency || 'INR') as Currency;
          const delta = newAmt - prevAmt;
          const deltaStr = delta >= 0 ? `+${fmt(delta, depCur)}` : fmt(delta, depCur);
          next = { ...next, balanceHistory: [...(prev.balanceHistory || []), { date: histDate, amount: newAmt, previousAmount: prevAmt, source: `Excel import ${deltaStr}` }] };
          updatedValueDeltaINR += toINR(delta, depCur, exchangeRates);
        }
        mergedDeposits[existingIdx] = next;
        diffItems.push({ type: 'deposit', action: 'update', name: newDep.bank, bank: newDep.bank, oldAmount: prevAmt, newAmount: newAmt, currency: newDep.currency || 'INR', details: newDep.depositId || newDep.startDate });
        updatedCount++; depCount++;
      }
    } else {
      const histDate = newDep.lastBalanceUpdatedAt || new Date().toISOString();
      const amt = Number(newDep.deposit) || 0;
      const depCur = newDep.currency || 'INR';
      mergedDeposits.push({ ...newDep, balanceHistory: [{ date: histDate, amount: amt, source: 'Excel import' }] });
      diffItems.push({ type: 'deposit', action: 'add', name: newDep.bank, bank: newDep.bank, newAmount: amt, currency: depCur, details: newDep.depositId || newDep.startDate });
      addedValueINR += toINR(amt, depCur, exchangeRates);
      addedCount++; depCount++;
    }
  });

  // ── Accounts: add / update / unchanged ──
  newAccounts.forEach(newAcc => {
    const key = bankAccountMergeKey(newAcc);
    touchedAccountKeys.add(key);
    const existingIdx = mergedAccounts.findIndex(a => bankAccountMergeKey(a) === key);
    if (existingIdx >= 0) {
      const prev = mergedAccounts[existingIdx];
      const prevAmt = Number(prev.amount) || 0;
      const newAmt = Number(newAcc.amount) || 0;

      if (accountsAreSame(prev, newAcc)) {
        diffItems.push({ type: 'account', action: 'unchanged', name: newAcc.bank, bank: newAcc.bank, accountType: newAcc.type, oldAmount: prevAmt, newAmount: newAmt, currency: newAcc.currency || 'INR' });
        unchangedCount++; accCount++;
      } else {
        let next: BankAccount = { ...prev, ...newAcc };
        const accCur = (next.currency || 'INR') as Currency;
        if (prevAmt !== newAmt) {
          const histDate = newAcc.lastBalanceUpdatedAt || new Date().toISOString();
          const delta = newAmt - prevAmt;
          const deltaStr = delta >= 0 ? `+${fmt(delta, accCur)}` : fmt(delta, accCur);
          next = { ...next, balanceHistory: [...(prev.balanceHistory || []), { date: histDate, amount: newAmt, previousAmount: prevAmt, source: `Excel import ${deltaStr}` }] };
          updatedValueDeltaINR += toINR(delta, accCur, exchangeRates);
        }
        mergedAccounts[existingIdx] = next;
        diffItems.push({ type: 'account', action: 'update', name: newAcc.bank, bank: newAcc.bank, accountType: newAcc.type, oldAmount: prevAmt, newAmount: newAmt, currency: newAcc.currency || 'INR' });
        updatedCount++; accCount++;
      }
    } else {
      const histDate = newAcc.lastBalanceUpdatedAt || new Date().toISOString();
      const amt = Number(newAcc.amount) || 0;
      const accCur = newAcc.currency || 'INR';
      mergedAccounts.push({ ...newAcc, balanceHistory: [{ date: histDate, amount: amt, source: 'Excel import' }] });
      diffItems.push({ type: 'account', action: 'add', name: newAcc.bank, bank: newAcc.bank, accountType: newAcc.type, newAmount: amt, currency: accCur });
      addedValueINR += toINR(amt, accCur, exchangeRates);
      addedCount++; accCount++;
    }
  });

  // ── Bills: add / update / unchanged ──
  newBills.forEach(newBill => {
    touchedBillKeys.add(newBill.name.toLowerCase());
    const existingIdx = mergedBills.findIndex(b => b.name.toLowerCase() === newBill.name.toLowerCase());
    if (existingIdx >= 0) {
      if (billsAreSame(mergedBills[existingIdx], newBill)) {
        diffItems.push({ type: 'bill', action: 'unchanged', name: newBill.name, bank: '', newAmount: Number(newBill.amount) || 0, currency: newBill.currency || 'INR' });
        unchangedCount++; billCount++;
      } else {
        mergedBills[existingIdx] = { ...mergedBills[existingIdx], ...newBill };
        diffItems.push({ type: 'bill', action: 'update', name: newBill.name, bank: '', oldAmount: Number(mergedBills[existingIdx].amount) || 0, newAmount: Number(newBill.amount) || 0, currency: newBill.currency || 'INR' });
        updatedCount++; billCount++;
      }
    } else {
      mergedBills.push(newBill);
      diffItems.push({ type: 'bill', action: 'add', name: newBill.name, bank: '', newAmount: Number(newBill.amount) || 0, currency: newBill.currency || 'INR' });
      addedCount++; billCount++;
    }
  });

  // ── Actions: add / update / unchanged ──
  newActions.forEach(newAct => {
    const key = actionMergeKey(newAct);
    touchedActionKeys.add(key);
    const existingIdx = mergedActions.findIndex(a => actionMergeKey(a) === key);
    if (existingIdx >= 0) {
      if (actionsAreSame(mergedActions[existingIdx], newAct)) {
        diffItems.push({ type: 'action', action: 'unchanged', name: newAct.title, bank: newAct.bank });
        unchangedCount++; actCount++;
      } else {
        mergedActions[existingIdx] = { ...mergedActions[existingIdx], ...newAct };
        diffItems.push({ type: 'action', action: 'update', name: newAct.title, bank: newAct.bank });
        updatedCount++; actCount++;
      }
    } else {
      mergedActions.push(newAct);
      diffItems.push({ type: 'action', action: 'add', name: newAct.title, bank: newAct.bank });
      addedCount++; actCount++;
    }
  });

  const netINR = addedValueINR + updatedValueDeltaINR - deletedValueINR;
  const primaryCur = (displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency) || 'INR';

  const diff: ImportDiffSummary = {
    items: diffItems,
    totalAdded: addedCount,
    totalUpdated: updatedCount,
    totalDeleted: deletedCount,
    totalUnchanged: unchangedCount,
    totalDeposits: depCount,
    totalAccounts: accCount,
    totalBills: billCount,
    totalActions: actCount,
    netValueImpact: fromINR(netINR, primaryCur, exchangeRates),
    addedValue: fromINR(addedValueINR, primaryCur, exchangeRates),
    updatedValueDelta: fromINR(updatedValueDeltaINR, primaryCur, exchangeRates),
    deletedValue: fromINR(deletedValueINR, primaryCur, exchangeRates),
    primaryCurrency: primaryCur,
    netValueImpactINR: netINR,
    addedValueINR,
    updatedValueDeltaINR,
    deletedValueINR,
  };

  endPerf();
  return { mergedDeposits, mergedAccounts, mergedBills, mergedActions, diff };
}
