/**
 * BankExcelView — Excel-style table view of the Financial data.
 *
 * Mimics the user's Excel workbook layout (Status | Updated On | Source | Amount |
 * Age | Type | Currency | Next Action | ...) so they can see/verify all records
 * in a single grid without clicking into individual cards.
 *
 * Read-only by design — edits are made via the Accounts/Deposits tabs. This is
 * intentionally a "trial" view to validate the shape before investing in
 * editable cells.
 *
 * Kept as a separate file to avoid growing BankDashboard.tsx further.
 */
import React, { useMemo, useState } from 'react';
import type { Deposit, BankAccount, Bill, ActionItem, Currency } from '../../types/bankRecords';
import { perfStart } from '../../utils/perfLogger';

type SortKey = 'date' | 'bank' | 'amount' | 'type' | 'status';
type SortDir = 'asc' | 'desc';

interface BankExcelViewProps {
  deposits: Deposit[];
  accounts: BankAccount[];
  bills: Bill[];
  actions: ActionItem[];
  fmt: (amount: number, currency: Currency) => string;
  theme: {
    text: string;
    textMuted: string;
    textLight: string;
    cardBgAlt: string;
    border: string;
    cardBg: string;
  };
  /**
   * Optional click handler for account rows. When provided, account rows
   * become interactive (cursor + hover) and call back with the original
   * `accounts` array index so the parent can open the detail screen.
   * Other row kinds (deposit/bill/action) are not yet wired through.
   */
  onAccountClick?: (idx: number) => void;
}

type UnifiedRow = {
  kind: 'account' | 'deposit' | 'bill' | 'action';
  status: string;
  date: string;
  source: string;
  amount: number;
  ageDays: number | null;
  type: string;
  currency: string;
  nextAction: string;
  accountOwner: string;
  nominee: string;
  online: string;
  roi: string;
  limits: string;
  extraInfo: string;
  /** For kind==='account', the index of the source account in the parent
   *  `accounts` array. Used to wire row clicks → BankAccountDetail. */
  accountIdx?: number;
  raw: Deposit | BankAccount | Bill | ActionItem;
};

function ageFromDate(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function latestUpdateDate(r: Pick<BankAccount | Deposit, 'balanceHistory' | 'lastBalanceUpdatedAt'> | any): string {
  if (r?.lastBalanceUpdatedAt) return r.lastBalanceUpdatedAt;
  const hist = r?.balanceHistory;
  if (Array.isArray(hist) && hist.length > 0) return hist[hist.length - 1]?.date || '';
  return '';
}

const BankExcelView: React.FC<BankExcelViewProps> = ({
  deposits, accounts, bills, actions, fmt, theme, onAccountClick,
}) => {
  const [kindFilter, setKindFilter] = useState<'all' | 'account' | 'deposit' | 'bill' | 'action'>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rows = useMemo<UnifiedRow[]>(() => {
    const endPerf = perfStart('BankExcelView', 'build rows');
    const all: UnifiedRow[] = [];

    accounts.forEach((a, idx) => {
      const d = latestUpdateDate(a);
      all.push({
        kind: 'account',
        status: (a as any).hidden ? 'HIDE' : '',
        date: d,
        source: a.bank || '',
        amount: Number(a.amount) || 0,
        ageDays: ageFromDate(d),
        type: a.type || 'Account',
        currency: a.currency || 'INR',
        nextAction: a.nextAction || '',
        accountOwner: a.holders || '',
        nominee: a.nominee || '',
        online: a.online || '',
        roi: a.roi != null ? String(a.roi) : '',
        limits: a.accountNumber || '',
        extraInfo: a.notes || '',
        accountIdx: idx,
        raw: a,
      });
    });

    deposits.forEach(dep => {
      const d = latestUpdateDate(dep) || dep.startDate;
      all.push({
        kind: 'deposit',
        status: dep.done ? 'DONE' : '',
        date: d,
        source: dep.bank || '',
        amount: Number(dep.deposit) || 0,
        ageDays: ageFromDate(d),
        type: dep.type || 'Deposit',
        currency: dep.currency || 'INR',
        nextAction: dep.nextAction || dep.maturityAction || '',
        accountOwner: dep.accountOwner || '',
        nominee: dep.nominee || '',
        online: '',
        roi: String(dep.roi ?? ''),
        limits: dep.depositId || '',
        extraInfo: dep.maturityDate ? `Matures ${dep.maturityDate}` : '',
        raw: dep,
      });
    });

    bills.forEach(b => {
      all.push({
        kind: 'bill',
        status: b.done ? 'DONE' : '',
        date: b.due || '',
        source: b.name || '',
        amount: Number(b.amount) || 0,
        ageDays: ageFromDate(b.due),
        type: 'Bill',
        currency: (b as any).currency || 'INR',
        nextAction: b.freq || '',
        accountOwner: '',
        nominee: '',
        online: '',
        roi: '',
        limits: '',
        extraInfo: b.name || '',
        raw: b,
      });
    });

    actions.forEach(a => {
      all.push({
        kind: 'action',
        status: a.done ? 'DONE' : 'ACTION',
        date: a.date || '',
        source: a.bank || '',
        amount: 0,
        ageDays: ageFromDate(a.date),
        type: 'Action',
        currency: 'INR',
        nextAction: a.title || '',
        accountOwner: '',
        nominee: '',
        online: '',
        roi: '',
        limits: a.priority || '',
        extraInfo: (a as any).notes || '',
        raw: a,
      });
    });

    endPerf();
    return all;
  }, [accounts, deposits, bills, actions]);

  const filtered = useMemo(() => {
    const endPerf = perfStart('BankExcelView', 'filter+sort');
    let arr = rows;
    if (kindFilter !== 'all') arr = arr.filter(r => r.kind === kindFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter(r =>
        r.source.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.nextAction.toLowerCase().includes(q) ||
        r.accountOwner.toLowerCase().includes(q) ||
        r.nominee.toLowerCase().includes(q) ||
        r.extraInfo.toLowerCase().includes(q),
      );
    }

    const sorted = [...arr].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'date') diff = a.date.localeCompare(b.date);
      else if (sortKey === 'bank') diff = a.source.localeCompare(b.source);
      else if (sortKey === 'amount') diff = a.amount - b.amount;
      else if (sortKey === 'type') diff = a.type.localeCompare(b.type);
      else if (sortKey === 'status') diff = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? diff : -diff;
    });
    endPerf();
    return sorted;
  }, [rows, kindFilter, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const kindColor = (kind: UnifiedRow['kind']): string => {
    switch (kind) {
      case 'account': return '#dbeafe';
      case 'deposit': return '#dcfce7';
      case 'bill':    return '#fef9c3';
      case 'action':  return '#fee2e2';
    }
  };

  const ageBadge = (row: UnifiedRow) => {
    if (row.ageDays == null) return null;
    const d = row.ageDays;
    const color = d < 0 ? '#059669' : d > 90 ? '#dc2626' : d > 30 ? '#d97706' : '#6b7280';
    const label = d < 0 ? `in ${-d}d` : d === 0 ? 'today' : `${d}d ago`;
    return <span style={{ fontSize: 10, color }}>{label}</span>;
  };

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Header toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        marginBottom: 10, padding: '8px 12px', background: theme.cardBgAlt,
        borderRadius: 8, border: `1px solid ${theme.border}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>
          📊 Excel View ({filtered.length} rows)
        </span>
        <select
          value={kindFilter}
          onChange={e => setKindFilter(e.target.value as any)}
          style={{
            padding: '4px 8px', borderRadius: 6, border: `1px solid ${theme.border}`,
            fontSize: 11, background: theme.cardBg, color: theme.text,
          }}
        >
          <option value="all">All ({rows.length})</option>
          <option value="account">Accounts ({accounts.length})</option>
          <option value="deposit">Deposits ({deposits.length})</option>
          <option value="bill">Bills ({bills.length})</option>
          <option value="action">Actions ({actions.length})</option>
        </select>
        <input
          placeholder="Search source, type, owner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '4px 8px', borderRadius: 6, border: `1px solid ${theme.border}`,
            fontSize: 11, background: theme.cardBg, color: theme.text, flex: 1, minWidth: 160,
          }}
        />
        <span style={{ fontSize: 10, color: theme.textMuted, fontStyle: 'italic' }}>
          Trial view · read-only · use Accounts/Deposits tabs to edit
        </span>
      </div>

      {/* Grid */}
      <div style={{
        border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'auto',
        maxHeight: '70vh', background: theme.cardBg,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 1100 }}>
          <thead>
            <tr style={{ background: theme.cardBgAlt, position: 'sticky', top: 0, zIndex: 2 }}>
              {[
                { k: 'status' as SortKey, label: 'Status', w: 70 },
                { k: 'date' as SortKey, label: 'Updated On', w: 100 },
                { k: 'bank' as SortKey, label: 'Source', w: 120 },
                { k: 'amount' as SortKey, label: 'Amount', w: 110, right: true },
                { k: null, label: 'Age', w: 70 },
                { k: 'type' as SortKey, label: 'Type', w: 90 },
                { k: null, label: 'Cur', w: 48 },
                { k: null, label: 'Next Action', w: 170 },
                { k: null, label: 'Account', w: 100 },
                { k: null, label: 'Nominee', w: 90 },
                { k: null, label: 'Online', w: 60 },
                { k: null, label: 'ROI %', w: 60 },
                { k: null, label: 'ID / Limits', w: 110 },
                { k: null, label: 'Extra Info', w: 200 },
              ].map(col => (
                <th
                  key={col.label}
                  onClick={() => col.k && toggleSort(col.k as SortKey)}
                  style={{
                    padding: '6px 8px', textAlign: (col as any).right ? 'right' : 'left',
                    borderBottom: `1px solid ${theme.border}`, fontSize: 10, fontWeight: 700,
                    color: theme.textMuted, minWidth: col.w, whiteSpace: 'nowrap',
                    cursor: col.k ? 'pointer' : 'default', userSelect: 'none',
                  }}
                >
                  {col.label}
                  {col.k && sortKey === col.k && (
                    <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const clickable = r.kind === 'account' && onAccountClick && r.accountIdx != null;
              const handleRowClick = () => {
                if (clickable && r.accountIdx != null) onAccountClick!(r.accountIdx);
              };
              return (
              <tr
                key={`${r.kind}-${i}`}
                onClick={clickable ? handleRowClick : undefined}
                onKeyDown={clickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); }
                } : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                title={clickable ? 'View account details' : undefined}
                style={{
                  borderBottom: `1px solid ${theme.border}`,
                  background: i % 2 === 0 ? 'transparent' : theme.cardBgAlt,
                  cursor: clickable ? 'pointer' : 'default',
                }}
                onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = '#eff6ff'; } : undefined}
                onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : theme.cardBgAlt; } : undefined}
              >
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    display: 'inline-block', background: kindColor(r.kind),
                    color: '#111', padding: '2px 6px', borderRadius: 4,
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  }}>{r.status || r.kind.slice(0, 4)}</span>
                </td>
                <td style={{ padding: '6px 8px', color: theme.text, whiteSpace: 'nowrap' }}>
                  {r.date ? new Date(r.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                </td>
                <td style={{ padding: '6px 8px', color: theme.text, fontWeight: 600 }}>{r.source || '—'}</td>
                <td style={{ padding: '6px 8px', color: r.amount < 0 ? '#dc2626' : theme.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {r.amount !== 0 ? fmt(r.amount, r.currency as Currency) : '—'}
                </td>
                <td style={{ padding: '6px 8px' }}>{ageBadge(r)}</td>
                <td style={{ padding: '6px 8px', color: theme.textMuted }}>{r.type}</td>
                <td style={{ padding: '6px 8px', color: theme.textLight, fontSize: 10 }}>{r.currency}</td>
                <td style={{ padding: '6px 8px', color: theme.text, fontSize: 10, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.nextAction}>{r.nextAction || '—'}</td>
                <td style={{ padding: '6px 8px', color: theme.textMuted, fontSize: 10 }}>{r.accountOwner || '—'}</td>
                <td style={{ padding: '6px 8px', color: theme.textMuted, fontSize: 10 }}>{r.nominee || '—'}</td>
                <td style={{ padding: '6px 8px', color: theme.textMuted, fontSize: 10 }}>{r.online || '—'}</td>
                <td style={{ padding: '6px 8px', color: theme.textMuted, fontSize: 10, textAlign: 'right' }}>{r.roi ? `${r.roi}%` : '—'}</td>
                <td style={{ padding: '6px 8px', color: theme.textMuted, fontSize: 10 }}>{r.limits || '—'}</td>
                <td style={{ padding: '6px 8px', color: theme.textLight, fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.extraInfo}>{r.extraInfo || '—'}</td>
              </tr>
            );})}
            {filtered.length === 0 && (
              <tr><td colSpan={14} style={{ padding: 20, textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>No rows match the current filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BankExcelView;
