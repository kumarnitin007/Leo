/**
 * TradesDashboard — Vault → Trades tab.
 *
 * Loads the encrypted trades blob, lets the user import Robinhood exports, and
 * visualizes trading activity/performance (options premium, dividends,
 * interest, per-ticker income, monthly cash flow) plus a filterable
 * transactions table.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { CryptoKey } from '../../utils/encryption';
import { Tag } from '../../types';
import { TradesData, RawTradeTxn, emptyTradesData, TradeKind } from '../../types/trades';
import { getSafeTags } from '../../storage';
import { loadTrades, saveTrades } from '../../services/trades/tradesStorage';
import { computeSummary, formatCurrency } from '../../services/trades/tradesAnalytics';
import TradesImportModal from './TradesImportModal';

interface TradesDashboardProps {
  userId?: string;
  encryptionKey: CryptoKey;
}

const KIND_LABELS: Record<TradeKind, string> = {
  option_premium: 'Option premium',
  option_event: 'Option event',
  equity: 'Stock trade',
  dividend: 'Dividend',
  tax: 'Tax',
  interest: 'Interest',
  lending: 'Stock lending',
  deposit: 'Deposit',
  other: 'Other',
};

const INCOME_COLORS = ['#6366f1', '#10b981', '#0ea5e9', '#f59e0b', '#ef4444'];
const BAR_POSITIVE = '#10b981';
const BAR_NEGATIVE = '#ef4444';

const TradesDashboard: React.FC<TradesDashboardProps> = ({ userId, encryptionKey }) => {
  const [data, setData] = useState<TradesData>(emptyTradesData());
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [tickerFilter, setTickerFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState<'all' | TradeKind>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [loaded, safeTags] = await Promise.all([
        loadTrades(userId, encryptionKey),
        getSafeTags().catch(() => [] as Tag[]),
      ]);
      setData(loaded);
      setTags(safeTags);
      setLoading(false);
    })();
  }, [userId, encryptionKey]);

  const summary = useMemo(() => computeSummary(data.transactions), [data]);

  const tagName = (id: string) => tags.find(t => t.id === id)?.name || id;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.transactions.filter(t => {
      if (tickerFilter !== 'all' && t.instrument !== tickerFilter) return false;
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
      if (q && !(`${t.instrument} ${t.description} ${t.transCode}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data.transactions, search, tickerFilter, kindFilter]);

  const topTickers = useMemo(() => summary.byTicker.slice(0, 12), [summary]);

  const incomePie = useMemo(() => {
    const i = summary.income;
    return [
      { name: 'Premiums', value: i.optionsPremium },
      { name: 'Dividends', value: i.dividends },
      { name: 'Interest', value: i.interest },
      { name: 'Lending', value: i.lending },
      { name: 'Tax', value: i.tax },
    ].filter(d => Math.abs(d.value) > 0.005);
  }, [summary]);

  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm('Remove this import and all its transactions?')) return;
    const next: TradesData = {
      ...data,
      transactions: data.transactions.filter(t => t.importBatchId !== batchId),
      imports: data.imports.filter(b => b.id !== batchId),
    };
    setData(next);
    await saveTrades(userId, encryptionKey, next);
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading trades…</div>;
  }

  const hasData = data.transactions.length > 0;

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>📈 Trades</h2>
          {summary.dateRange && (
            <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
              {summary.dateRange.start} → {summary.dateRange.end} · {summary.totalTransactions} transactions · {summary.tickersTraded} tickers
            </p>
          )}
        </div>
        <button onClick={() => setShowImport(true)} className="ck-btn ck-btn-primary">
          📥 Import trades
        </button>
      </div>

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#f9fafb', borderRadius: 14, border: '1px dashed #d1d5db' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📊</div>
          <h3 style={{ margin: '0 0 0.5rem' }}>No trades yet</h3>
          <p style={{ color: '#6b7280', maxWidth: 420, margin: '0 auto 1.25rem', lineHeight: 1.6 }}>
            Import a Robinhood CSV or Excel export to build your trading dashboard. Duplicates are detected automatically, so you can safely import overlapping statements.
          </p>
          <button onClick={() => setShowImport(true)} className="ck-btn ck-btn-primary">📥 Import your first file</button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <SummaryCard label="Options premium" value={summary.income.optionsPremium} accent="#6366f1" />
            <SummaryCard label="Dividends" value={summary.income.dividends} accent="#10b981" />
            <SummaryCard label="Interest" value={summary.income.interest} accent="#0ea5e9" />
            <SummaryCard label="Stock lending" value={summary.income.lending} accent="#8b5cf6" />
            <SummaryCard label="Total income" value={summary.income.total} accent="#111827" emphasize />
            <SummaryCard label="Deposits" value={summary.deposits} accent="#64748b" />
          </div>

          {/* Charts row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <ChartCard title="Income breakdown">
              {incomePie.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={incomePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {incomePie.map((_, i) => <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Monthly income (premiums + dividends + interest)">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={summary.monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tradesNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="net" name="Net income" stroke="#6366f1" fill="url(#tradesNet)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Top tickers */}
          <ChartCard title="Income by ticker (options premium + dividends + lending)">
            <ResponsiveContainer width="100%" height={Math.max(240, topTickers.length * 34)}>
              <BarChart data={topTickers} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v, { compact: true })} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="ticker" width={64} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="income" name="Income" radius={[0, 4, 4, 0]}>
                  {topTickers.map((t, i) => <Cell key={i} fill={t.income >= 0 ? BAR_POSITIVE : BAR_NEGATIVE} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Options activity */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', margin: '1rem 0 1.5rem' }}>
            <Pill label="Opened" value={summary.optionActivity.opened} />
            <Pill label="Closed" value={summary.optionActivity.closed} />
            <Pill label="Expired" value={summary.optionActivity.expired} />
            <Pill label="Assigned" value={summary.optionActivity.assigned} />
            <Pill label="Exercised" value={summary.optionActivity.exercised} />
          </div>

          {/* Imports list */}
          {data.imports.length > 0 && (
            <ChartCard title={`Imports (${data.imports.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {data.imports.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.25rem', borderBottom: '1px solid #f1f1f1', fontSize: '0.85rem' }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📄 {b.fileName}
                    </span>
                    {b.tags.map(id => (
                      <span key={id} style={{ background: '#ede9fe', color: '#6b21a8', borderRadius: 6, padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 600 }}>{tagName(id)}</span>
                    ))}
                    <span style={{ color: '#6b7280' }}>+{b.added} · {b.duplicates} dup</span>
                    <button onClick={() => handleDeleteBatch(b.id)} className="ck-btn ck-btn-sm" title="Remove import">🗑️</button>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* Transactions table */}
          <ChartCard title={`Transactions (${filtered.length})`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search ticker / description…"
                style={{ flex: 1, minWidth: 160, padding: '0.45rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}
              />
              <select value={tickerFilter} onChange={e => setTickerFilter(e.target.value)} style={selectStyle}>
                <option value="all">All tickers</option>
                {summary.byTicker.map(t => <option key={t.ticker} value={t.ticker}>{t.ticker}</option>)}
              </select>
              <select value={kindFilter} onChange={e => setKindFilter(e.target.value as any)} style={selectStyle}>
                <option value="all">All types</option>
                {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto', border: '1px solid #eef0f2', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                    <Th>Date</Th><Th>Ticker</Th><Th>Description</Th><Th>Code</Th>
                    <Th align="right">Qty</Th><Th align="right">Price</Th><Th align="right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 300).map((t: RawTradeTxn) => (
                    <tr key={t.id} style={{ borderTop: '1px solid #f1f1f1' }}>
                      <Td>{t.activityDate}</Td>
                      <Td><strong>{t.instrument || '—'}</strong></Td>
                      <Td title={t.description} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</Td>
                      <Td><span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: 5, padding: '0.05rem 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>{t.transCode}</span></Td>
                      <Td align="right">{t.quantityRaw ?? ''}</Td>
                      <Td align="right">{t.price != null ? formatCurrency(t.price) : ''}</Td>
                      <Td align="right" style={{ color: (t.amount ?? 0) < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                        {t.amount != null ? formatCurrency(t.amount) : ''}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 300 && (
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>Showing first 300 of {filtered.length}. Use filters to narrow down.</p>
            )}
          </ChartCard>
        </>
      )}

      {showImport && (
        <TradesImportModal
          existingData={data}
          userId={userId}
          encryptionKey={encryptionKey}
          onClose={() => setShowImport(false)}
          onImported={setData}
        />
      )}
    </div>
  );
};

const selectStyle: React.CSSProperties = { padding: '0.45rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem', background: '#fff' };

const SummaryCard: React.FC<{ label: string; value: number; accent: string; emphasize?: boolean }> = ({ label, value, accent, emphasize }) => (
  <div style={{
    background: emphasize ? accent : '#fff', color: emphasize ? '#fff' : '#111827',
    border: emphasize ? 'none' : '1px solid #eef0f2', borderRadius: 12, padding: '0.9rem 1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  }}>
    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, color: emphasize ? 'rgba(255,255,255,0.85)' : '#9ca3af' }}>{label}</div>
    <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.2rem', color: emphasize ? '#fff' : (value < 0 ? '#dc2626' : accent) }}>
      {formatCurrency(value)}
    </div>
  </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: '#fff', border: '1px solid #eef0f2', borderRadius: 14, padding: '1rem 1.1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    <h3 style={{ margin: '0 0 0.85rem', fontSize: '0.98rem', color: '#374151' }}>{title}</h3>
    {children}
  </div>
);

const Pill: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{ background: '#fff', border: '1px solid #eef0f2', borderRadius: 10, padding: '0.6rem 0.9rem', minWidth: 92, textAlign: 'center' }}>
    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4338ca' }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>{label}</div>
  </div>
);

const Empty: React.FC = () => <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No data</div>;

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align = 'left' }) => (
  <th style={{ textAlign: align, padding: '0.5rem 0.6rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</th>
);

const Td: React.FC<{ children: React.ReactNode; align?: 'left' | 'right'; title?: string; style?: React.CSSProperties }> = ({ children, align = 'left', title, style }) => (
  <td title={title} style={{ textAlign: align, padding: '0.45rem 0.6rem', color: '#374151', ...style }}>{children}</td>
);

export default TradesDashboard;
