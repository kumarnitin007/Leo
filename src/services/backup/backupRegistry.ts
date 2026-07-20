/**
 * Unified Backup — domain registry.
 *
 * One descriptor per user-data domain. Each knows how to:
 *   - gather()  read all records (for building a backup)
 *   - diff()    compare a file's records against what's already stored
 *   - restore() write records, skipping duplicates by a stable key
 *
 * Most domains are plain id-keyed row tables handled by `rowDomain()`.
 * Task completions use a composite key. Bank and Trades are single encrypted
 * blobs merged at the sub-record level.
 *
 * Restores preserve each record's original id so re-importing the same backup
 * is detected as a duplicate and skipped (idempotent).
 */

import getSupabaseClient from '../../lib/supabase';
import { encryptData, decryptData } from '../../utils/encryption';
import type { CryptoKey } from '../../utils/encryption';

import { getTasks, getCompletions } from '../../storage/tasks';
import { getEvents } from '../../storage/events';
import { getItems } from '../../storage/items';
import { getJournalEntries } from '../../storage/journal';
import { getRoutines } from '../../storage/routines';
import { getTags } from '../../storage/tags';
import { getSafeEntries, getDocumentVaults, getResolutions } from '../../storage';
import { getTodoGroups, getTodoItems } from '../todoService';
import { loadTrades, saveTrades } from '../trades/tradesStorage';
import { emptyTradesData, TradesData } from '../../types/trades';
import { BankRecordsData } from '../../types/bankRecords';

import {
  BackupContext,
  DomainDiff,
  DomainRestoreResult,
  DuplicatePolicy,
} from './backupTypes';

export interface BackupDomainModule {
  key: string;
  label: string;
  /** Needs the Safe master key to read/write (bank, trades). */
  needsSafeKey?: boolean;
  gather(ctx: BackupContext): Promise<unknown[]>;
  count(records: unknown[]): number;
  diff(records: unknown[], ctx: BackupContext, policy: DuplicatePolicy): Promise<DomainDiff>;
  restore(records: unknown[], ctx: BackupContext, policy: DuplicatePolicy): Promise<DomainRestoreResult>;
}

function getClient() {
  const c = getSupabaseClient();
  if (!c) throw new Error('Supabase is not configured');
  return c;
}

const nowIso = () => new Date().toISOString();
const recUpdatedAt = (rec: any): string | null => rec?.updatedAt || rec?.updated_at || null;

function zeroDiff(key: string, label: string, incoming = 0): DomainDiff {
  return { key, label, incoming, newCount: 0, duplicate: 0, newer: 0 };
}
function zeroResult(key: string, label: string, error?: string): DomainRestoreResult {
  return { key, label, added: 0, skipped: 0, updated: 0, failed: 0, error };
}

/* ─────────────────────────── id-keyed row domains ─────────────────────────── */

interface RowSpec {
  key: string;
  label: string;
  table: string;
  /** Column that holds a last-modified timestamp, enabling "update if newer". */
  updatedAtCol?: string;
  /** Upsert conflict target for inserting new rows. Defaults to 'id'. */
  conflict?: string;
  gather(ctx: BackupContext): Promise<any[]>;
  toRow(rec: any, userId: string): Record<string, unknown>;
}

function rowDomain(spec: RowSpec): BackupDomainModule {
  const loadExisting = async (userId: string) => {
    const client = getClient();
    const cols = spec.updatedAtCol ? `id, ${spec.updatedAtCol}` : 'id';
    const { data, error } = await client.from(spec.table).select(cols).eq('user_id', userId);
    if (error) throw new Error(error.message);
    const map = new Map<string, string | null>();
    (data || []).forEach((r: any) => map.set(r.id, spec.updatedAtCol ? r[spec.updatedAtCol] : null));
    return map;
  };

  return {
    key: spec.key,
    label: spec.label,
    gather: (ctx) => spec.gather(ctx),
    count: (recs) => recs.length,
    diff: async (records, ctx, policy) => {
      const existing = await loadExisting(ctx.userId);
      let newCount = 0, duplicate = 0, newer = 0;
      for (const rec of records as any[]) {
        if (!existing.has(rec.id)) { newCount++; continue; }
        duplicate++;
        if (policy === 'update-if-newer' && spec.updatedAtCol) {
          const inc = recUpdatedAt(rec); const cur = existing.get(rec.id);
          if (inc && cur && inc > cur) newer++;
        }
      }
      return { key: spec.key, label: spec.label, incoming: records.length, newCount, duplicate, newer };
    },
    restore: async (records, ctx, policy) => {
      const client = getClient();
      const existing = await loadExisting(ctx.userId);
      let added = 0, skipped = 0, updated = 0, failed = 0;
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      for (const rec of records as any[]) {
        if (!existing.has(rec.id)) { toInsert.push(spec.toRow(rec, ctx.userId)); continue; }
        if (policy === 'update-if-newer' && spec.updatedAtCol) {
          const inc = recUpdatedAt(rec); const cur = existing.get(rec.id);
          if (inc && cur && inc > cur) { toUpdate.push(spec.toRow(rec, ctx.userId)); continue; }
        }
        skipped++;
      }
      if (toInsert.length) {
        const { error } = await client
          .from(spec.table)
          .upsert(toInsert, { onConflict: spec.conflict || 'id', ignoreDuplicates: true });
        if (error) { failed += toInsert.length; return { key: spec.key, label: spec.label, added, skipped, updated, failed, error: error.message }; }
        added += toInsert.length;
      }
      if (toUpdate.length) {
        const { error } = await client.from(spec.table).upsert(toUpdate, { onConflict: spec.conflict || 'id' });
        if (error) failed += toUpdate.length; else updated += toUpdate.length;
      }
      return { key: spec.key, label: spec.label, added, skipped, updated, failed };
    },
  };
}

/* ─────────────────────────── task completions (composite key) ─────────────── */

const completionsDomain: BackupDomainModule = {
  key: 'taskCompletions',
  label: 'Task completions',
  gather: async () => getCompletions(),
  count: (r) => r.length,
  diff: async (records, ctx) => {
    const client = getClient();
    const { data } = await client.from('myday_task_completions').select('task_id, completion_date').eq('user_id', ctx.userId);
    const existing = new Set((data || []).map((r: any) => `${r.task_id}|${r.completion_date}`));
    let newCount = 0, duplicate = 0;
    for (const c of records as any[]) (existing.has(`${c.taskId}|${c.date}`) ? duplicate++ : newCount++);
    return { key: 'taskCompletions', label: 'Task completions', incoming: records.length, newCount, duplicate, newer: 0 };
  },
  restore: async (records, ctx) => {
    const client = getClient();
    const { data } = await client.from('myday_task_completions').select('task_id, completion_date').eq('user_id', ctx.userId);
    const existing = new Set((data || []).map((r: any) => `${r.task_id}|${r.completion_date}`));
    let added = 0, skipped = 0, failed = 0;
    const rows: any[] = [];
    for (const c of records as any[]) {
      if (existing.has(`${c.taskId}|${c.date}`)) { skipped++; continue; }
      rows.push({
        user_id: ctx.userId, task_id: c.taskId, completion_date: c.date,
        duration_minutes: c.durationMinutes ?? null, started_at: c.startedAt ?? null, completed_at: c.completedAt ?? null,
      });
    }
    if (rows.length) {
      const { error } = await client.from('myday_task_completions').upsert(rows, { onConflict: 'user_id,task_id,completion_date', ignoreDuplicates: true });
      if (error) failed = rows.length; else added = rows.length;
    }
    return { key: 'taskCompletions', label: 'Task completions', added, skipped, updated: 0, failed };
  },
};

/* ─────────────────────────── bank (encrypted blob) ────────────────────────── */

async function loadBankBlob(userId: string, key: CryptoKey): Promise<BankRecordsData | null> {
  const client = getClient();
  const { data, error } = await client.from('myday_bank_records').select('data').eq('user_id', userId).maybeSingle();
  if (error || !data?.data) return null;
  try {
    const { encrypted, iv } = JSON.parse(data.data as string);
    const json = await decryptData(encrypted, iv, key);
    return JSON.parse(json) as BankRecordsData;
  } catch (e) {
    console.error('[backup] bank decrypt failed:', e);
    return null;
  }
}

async function saveBankBlob(userId: string, key: CryptoKey, data: BankRecordsData): Promise<void> {
  const client = getClient();
  const payload: BankRecordsData = { ...data, updatedAt: nowIso(), version: data.version ?? 1 };
  const { encrypted, iv } = await encryptData(JSON.stringify(payload), key);
  const { error } = await client.from('myday_bank_records').upsert(
    { user_id: userId, data: JSON.stringify({ encrypted, iv }), updated_at: payload.updatedAt },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
}

const emptyBank = (): BankRecordsData => ({ deposits: [], accounts: [], bills: [], actions: [], goals: [], totalValueHistory: [], version: 1 });
const bankCount = (d: BankRecordsData) =>
  (d.deposits?.length || 0) + (d.accounts?.length || 0) + (d.bills?.length || 0) + (d.actions?.length || 0) + (d.goals?.length || 0);

const bankKeys = {
  deposits: (x: any) => String(x.depositId ?? ''),
  accounts: (x: any) => `${x.bank}|${x.type}|${x.holders}`,
  bills: (x: any) => String(x.name ?? ''),
  actions: (x: any) => `${x.title}|${x.bank}|${x.date}`,
  goals: (x: any) => String(x.id ?? ''),
  totalValueHistory: (x: any) => String(x.date ?? ''),
} as const;

function bankMerge(existing: BankRecordsData, incoming: BankRecordsData) {
  const merged: BankRecordsData = { ...existing };
  let added = 0, skipped = 0;
  (Object.keys(bankKeys) as (keyof typeof bankKeys)[]).forEach((field) => {
    const keyOf = bankKeys[field];
    const cur: any[] = (existing as any)[field] || [];
    const inc: any[] = (incoming as any)[field] || [];
    const seen = new Set(cur.map(keyOf));
    const out = [...cur];
    for (const item of inc) {
      const k = keyOf(item);
      if (seen.has(k)) { skipped++; continue; }
      seen.add(k); out.push(item); added++;
    }
    (merged as any)[field] = out;
  });
  if (incoming.exchangeRates && !existing.exchangeRates) merged.exchangeRates = incoming.exchangeRates;
  if (incoming.displayCurrency && !existing.displayCurrency) merged.displayCurrency = incoming.displayCurrency;
  return { merged, added, skipped };
}

const bankDomain: BackupDomainModule = {
  key: 'bank',
  label: 'Bank / financial',
  needsSafeKey: true,
  gather: async (ctx) => {
    if (!ctx.safeKey) return [];
    const d = await loadBankBlob(ctx.userId, ctx.safeKey);
    return d && bankCount(d) > 0 ? [d] : [];
  },
  count: (recs) => (recs.length ? bankCount(recs[0] as BankRecordsData) : 0),
  diff: async (records, ctx) => {
    const inc = records[0] as BankRecordsData | undefined;
    if (!inc) return zeroDiff('bank', 'Bank / financial');
    const existing = ctx.safeKey ? await loadBankBlob(ctx.userId, ctx.safeKey) : null;
    const { added, skipped } = bankMerge(existing || emptyBank(), inc);
    return { key: 'bank', label: 'Bank / financial', incoming: bankCount(inc), newCount: added, duplicate: skipped, newer: 0 };
  },
  restore: async (records, ctx) => {
    const inc = records[0] as BankRecordsData | undefined;
    if (!inc) return zeroResult('bank', 'Bank / financial');
    if (!ctx.safeKey) return zeroResult('bank', 'Bank / financial', 'Master password required');
    const existing = (await loadBankBlob(ctx.userId, ctx.safeKey)) || emptyBank();
    const { merged, added, skipped } = bankMerge(existing, inc);
    if (added > 0) await saveBankBlob(ctx.userId, ctx.safeKey, merged);
    return { key: 'bank', label: 'Bank / financial', added, skipped, updated: 0, failed: 0 };
  },
};

/* ─────────────────────────── trades (encrypted blob) ──────────────────────── */

const tradesDomain: BackupDomainModule = {
  key: 'trades',
  label: 'Trades',
  needsSafeKey: true,
  gather: async (ctx) => {
    if (!ctx.safeKey) return [];
    const d = await loadTrades(ctx.userId, ctx.safeKey);
    return d.transactions.length || d.accounts.length || d.imports.length ? [d] : [];
  },
  count: (recs) => (recs.length ? (recs[0] as TradesData).transactions.length : 0),
  diff: async (records, ctx) => {
    const inc = records[0] as TradesData | undefined;
    if (!inc) return zeroDiff('trades', 'Trades');
    const existing = ctx.safeKey ? await loadTrades(ctx.userId, ctx.safeKey) : emptyTradesData();
    const ids = new Set(existing.transactions.map((t) => t.id));
    let newCount = 0, duplicate = 0;
    for (const t of inc.transactions) (ids.has(t.id) ? duplicate++ : newCount++);
    return { key: 'trades', label: 'Trades', incoming: inc.transactions.length, newCount, duplicate, newer: 0 };
  },
  restore: async (records, ctx) => {
    const inc = records[0] as TradesData | undefined;
    if (!inc) return zeroResult('trades', 'Trades');
    if (!ctx.safeKey) return zeroResult('trades', 'Trades', 'Master password required');
    const existing = await loadTrades(ctx.userId, ctx.safeKey);
    const ids = new Set(existing.transactions.map((t) => t.id));
    let added = 0, skipped = 0;
    const merged = [...existing.transactions];
    for (const t of inc.transactions) {
      if (ids.has(t.id)) { skipped++; continue; }
      ids.add(t.id); merged.push(t); added++;
    }
    merged.sort((a, b) => (a.activityDate < b.activityDate ? 1 : a.activityDate > b.activityDate ? -1 : 0));
    const accounts = Array.from(new Set([...(existing.accounts || []), ...(inc.accounts || [])]));
    const importIds = new Set(existing.imports.map((i) => i.id));
    const imports = [...existing.imports];
    for (const im of inc.imports || []) if (!importIds.has(im.id)) { importIds.add(im.id); imports.push(im); }
    if (added > 0 || accounts.length !== (existing.accounts || []).length) {
      await saveTrades(ctx.userId, ctx.safeKey, { version: existing.version || 1, accounts, transactions: merged, imports, updatedAt: nowIso() });
    }
    return { key: 'trades', label: 'Trades', added, skipped, updated: 0, failed: 0 };
  },
};

/* ─────────────────────────── registry ─────────────────────────────────────── */

export const ALL_DOMAINS: BackupDomainModule[] = [
  rowDomain({
    key: 'tasks', label: 'Tasks', table: 'myday_tasks', gather: () => getTasks(),
    toRow: (t, userId) => ({
      id: t.id, user_id: userId, name: t.name, description: t.description ?? null, category: t.category ?? null,
      color: t.color ?? null, custom_background_color: t.customBackgroundColor ?? null, weightage: t.weightage ?? null,
      frequency: t.frequency ?? null, days_of_week: t.daysOfWeek ?? null, day_of_month: t.dayOfMonth ?? null,
      custom_frequency: t.customFrequency ?? null, frequency_count: t.frequencyCount ?? null, frequency_period: t.frequencyPeriod ?? null,
      interval_value: t.intervalValue ?? null, interval_unit: t.intervalUnit ?? null, interval_start_date: t.intervalStartDate ?? null,
      start_date: t.startDate ?? null, end_date: t.endDate ?? null, specific_date: t.specificDate ?? null, end_time: t.endTime ?? null,
      dependent_task_ids: t.dependentTaskIds ?? [], on_hold: t.onHold ?? false, hold_start_date: t.holdStartDate ?? null,
      hold_end_date: t.holdEndDate ?? null, hold_reason: t.holdReason ?? null, tags: t.tags ?? [],
      tracked_metric: t.trackedMetric ?? null, created_at: t.createdAt ?? nowIso(),
    }),
  }),
  completionsDomain,
  rowDomain({
    key: 'events', label: 'Events', table: 'myday_events', gather: () => getEvents(),
    toRow: (e, userId) => ({
      id: e.id, user_id: userId, name: e.name, description: e.description ?? null, category: e.category ?? null,
      tags: e.tags ?? [], event_date: e.date, date_text: e.date, notify_days_before: e.notifyDaysBefore ?? 0,
      color: e.color ?? null, priority: e.priority ?? 5, hide_from_dashboard: e.hideFromDashboard ?? false,
      frequency: e.frequency ?? 'yearly', custom_frequency: e.customFrequency ?? null, year: e.year ?? null,
      created_at: e.createdAt ?? nowIso(),
    }),
  }),
  rowDomain({
    key: 'items', label: 'Items', table: 'myday_items', updatedAtCol: 'updated_at', gather: () => getItems(),
    toRow: (i, userId) => ({
      id: i.id, user_id: userId, name: i.name, description: i.description ?? null, category: i.category ?? 'Note',
      tags: i.tags ?? [], priority: i.priority ?? 5, color: i.color ?? null, is_closed: i.isClosed ?? false,
      created_at: i.createdAt ?? nowIso(), updated_at: i.updatedAt ?? i.createdAt ?? nowIso(),
      expiration_date: i.expirationDate ?? null, notify_days_before: i.notifyDaysBefore ?? 0,
      value: i.value ?? null, currency: i.currency ?? null, merchant: i.merchant ?? null,
      account_number: i.accountNumber ?? null, auto_renew: i.autoRenew ?? false,
    }),
  }),
  rowDomain({
    key: 'journal', label: 'Journal', table: 'myday_journal_entries', updatedAtCol: 'updated_at', gather: () => getJournalEntries(),
    toRow: (j, userId) => ({
      id: j.id, user_id: userId, entry_date: j.date, content: j.content ?? '', mood: j.mood ?? null,
      energy_level: j.energyLevel ?? null, weather: j.weather ?? null, activity: (j.activity && j.activity.length) ? j.activity : null,
      location: j.location ?? null, word_count: j.wordCount ?? null, entry_time: j.entryTime ?? null, tags: j.tags ?? [],
      is_favorite: j.isFavorite ?? false, created_via_voice: j.createdViaVoice ?? false,
      voice_command_id: j.voiceCommandId ?? null, voice_confidence: j.voiceConfidence ?? null,
      created_at: j.createdAt ?? nowIso(), updated_at: j.updatedAt ?? nowIso(),
    }),
  }),
  rowDomain({
    key: 'resolutions', label: 'Resolutions', table: 'myday_resolutions', updatedAtCol: 'updated_at', gather: () => getResolutions(),
    toRow: (r, userId) => ({
      id: r.id, user_id: userId, title: r.title, description: r.description ?? null, category: r.category ?? null,
      tags: r.tags ?? [], target_year: r.targetYear ?? null, start_date: r.startDate ?? null, end_date: r.endDate ?? null,
      progress_metric: r.progressMetric ?? null, target_value: r.targetValue ?? null, current_value: r.currentValue ?? 0,
      milestones: r.milestones ?? [], linked_task_ids: r.linkedTaskIds ?? [], priority: r.priority ?? 5,
      color: r.color ?? null, status: r.status ?? 'active', created_at: r.createdAt ?? nowIso(), updated_at: r.updatedAt ?? nowIso(),
    }),
  }),
  rowDomain({
    key: 'routines', label: 'Routines', table: 'myday_routines', gather: () => getRoutines(),
    toRow: (r, userId) => ({
      id: r.id, user_id: userId, name: r.name, description: r.description ?? null, task_ids: r.taskIds ?? [],
      time_of_day: r.timeOfDay ?? null, is_predefined: r.isPreDefined ?? false, is_active: r.isActive !== false,
      created_at: r.createdAt ?? nowIso(),
    }),
  }),
  rowDomain({
    key: 'tags', label: 'Tags', table: 'myday_tags', conflict: 'user_id,name', gather: () => getTags(),
    toRow: (t, userId) => ({
      id: t.id, user_id: userId, name: t.name, color: t.color ?? null, trackable: t.trackable ?? false,
      description: t.description ?? null, allowed_sections: t.allowedSections ?? null, is_safe_only: t.isSafeOnly ?? false,
      is_system_category: t.isSystemCategory ?? false, parent_id: t.parentId ?? null, created_at: t.createdAt ?? nowIso(),
    }),
  }),
  rowDomain({
    key: 'todoGroups', label: 'To-do lists', table: 'myday_todo_groups', updatedAtCol: 'updated_at', gather: () => getTodoGroups(),
    toRow: (g, userId) => ({
      id: g.id, user_id: userId, name: g.name, color: g.color ?? null, icon: g.icon ?? null,
      order_num: g.order ?? 0, is_expanded: g.isExpanded ?? true, created_at: g.createdAt ?? nowIso(), updated_at: g.updatedAt ?? nowIso(),
    }),
  }),
  rowDomain({
    key: 'todoItems', label: 'To-do items', table: 'myday_todo_items', updatedAtCol: 'updated_at', gather: () => getTodoItems('all'),
    toRow: (i, userId) => ({
      id: i.id, user_id: userId, text: i.text ?? '', group_id: i.groupId ?? null, is_completed: i.isCompleted ?? false,
      completed_at: i.completedAt ?? null, priority: i.priority ?? 'medium', due_date: i.dueDate ?? null, notes: i.notes ?? null,
      tags: i.tags ?? null, show_on_dashboard: i.showOnDashboard ?? false, assigned_to: i.assignedTo ?? null,
      assigned_at: i.assignedAt ?? null, assigned_by: i.assignedBy ?? null, order_num: i.order ?? 0,
      created_at: i.createdAt ?? nowIso(), updated_at: i.updatedAt ?? nowIso(),
    }),
  }),
  rowDomain({
    key: 'safeEntries', label: 'Passwords (Safe)', table: 'myday_encrypted_entries', updatedAtCol: 'updated_at', gather: () => getSafeEntries(),
    toRow: (e, userId) => ({
      id: e.id, user_id: userId, title: e.title, url: e.url ?? null, category_tag_id: e.categoryTagId ?? null,
      tags: e.tags ?? [], is_favorite: e.isFavorite ?? false, expires_at: e.expiresAt ?? null,
      encrypted_data: e.encryptedData, encrypted_data_iv: e.encryptedDataIv,
      created_at: e.createdAt ?? nowIso(), updated_at: e.updatedAt ?? nowIso(), last_accessed_at: e.lastAccessedAt ?? null,
    }),
  }),
  rowDomain({
    key: 'documents', label: 'Documents (Safe)', table: 'myday_document_vaults', updatedAtCol: 'updated_at', gather: () => getDocumentVaults(),
    toRow: (d, userId) => ({
      id: d.id, user_id: userId, title: d.title, provider: d.provider ?? null, document_type: d.documentType ?? null,
      tags: d.tags ?? [], issue_date: d.issueDate ?? null, expiry_date: d.expiryDate ?? null, is_favorite: d.isFavorite ?? false,
      encrypted_data: d.encryptedData, encrypted_data_iv: d.encryptedDataIv, created_at: d.createdAt ?? nowIso(), updated_at: d.updatedAt ?? nowIso(),
    }),
  }),
  bankDomain,
  tradesDomain,
];

export function getDomain(key: string): BackupDomainModule | undefined {
  return ALL_DOMAINS.find((d) => d.key === key);
}
