/**
 * TradesDashboard — Vault → Trades tab.
 *
 * Loads the encrypted trades blob, lets the user import Robinhood exports, and
 * visualizes trading activity/performance (options premium, dividends,
 * interest, per-ticker income, monthly cash flow) plus a filterable
 * transactions table. Tickers and option-activity counts are clickable and
 * open a right-side detail panel.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { CryptoKey } from '../../utils/encryption';
import { Tag } from '../../types';
import { TradesData, RawTradeTxn, emptyTradesData, TradeKind, TRADE_ACCOUNTS, DEFAULT_ACCOUNT_BUCKET } from '../../types/trades';
import { getSafeTags } from '../../storage';
import { loadTrades, saveTrades } from '../../services/trades/tradesStorage';
import { computeSummary, computeOpenOptions, formatCurrency, TickerStats, OpenOption } from '../../services/trades/tradesAnalytics';
import { fetchQuotes, fetchOptionQuotes, optionLegKey, Quote, OptionMark } from '../../services/trades/quotes';
import {
  loadWatchlist, addWatch, removeWatch, loadCachedQuotes, saveCachedQuotes, saveManualQuote,
  loadCachedOptionMarks, saveCachedOptionMarks, WatchItem, CachedQuote,
} from '../../services/trades/tickerData';
import { updateOpenOptionsCache } from '../../services/notificationService';
import { buildPortfolioDigest } from '../../services/trades/tradesInsightsData';
import { fetchTickerEvents, loadCachedTickerEvents, saveCachedTickerEvents, TickerEvents } from '../../services/trades/tickerEvents';
import { fetchTickerNews, peekCachedNews, newsRelativeTime, NewsItem } from '../../services/trades/tickerNews';
import TradesImportModal from './TradesImportModal';
import TradesInsightsPanel from './TradesInsightsPanel';
import SlideOverPanel from '../SlideOverPanel';
import FormCollapsible from '../FormCollapsible';

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

const ACTIVITY_GROUPS: { key: 'opened' | 'closed' | 'expired' | 'assigned' | 'exercised'; label: string; codes: string[] }[] = [
  { key: 'opened', label: 'Opened', codes: ['STO', 'BTO'] },
  { key: 'closed', label: 'Closed', codes: ['STC', 'BTC'] },
  { key: 'expired', label: 'Expired', codes: ['OEXP'] },
  { key: 'assigned', label: 'Assigned', codes: ['OASGN'] },
  { key: 'exercised', label: 'Exercised', codes: ['OEXCS'] },
];

interface PanelState {
  title: string;
  ticker?: string;
  txns: RawTradeTxn[];
}

const hiddenAccountsKey = (uid?: string) => `myday_trades_hidden_accounts_${uid || 'anon'}`;
function readHiddenAccounts(uid?: string): string[] {
  try {
    const raw = localStorage.getItem(hiddenAccountsKey(uid));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

const TradesDashboard: React.FC<TradesDashboardProps> = ({ userId, encryptionKey }) => {
  const [data, setData] = useState<TradesData>(emptyTradesData());
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  // View toggles
  const [incomeView, setIncomeView] = useState<'chart' | 'numbers'>('chart');
  const [tickerScope, setTickerScope] = useState<'held' | 'closed' | 'options'>('held');
  // Accounts hidden from view (persisted per user). Empty = show all. Using a
  // "hidden" list (rather than "selected") keeps newly-imported accounts visible
  // by default and lets us persist the user's last choice.
  const [hiddenAccounts, setHiddenAccounts] = useState<string[]>(() => readHiddenAccounts(userId));
  const [datePreset, setDatePreset] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [panel, setPanel] = useState<PanelState | null>(null);

  // Table filters
  const [search, setSearch] = useState('');
  const [tickerFilter, setTickerFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState<'all' | TradeKind>('all');
  const [favInput, setFavInput] = useState('');

  // Live prices — cached in DB (paint from cache; refresh hits the market API).
  const [quotes, setQuotes] = useState<Record<string, CachedQuote>>({});
  const [optionQuotes, setOptionQuotes] = useState<Record<string, OptionMark>>({});
  const [tickerEvents, setTickerEvents] = useState<Record<string, TickerEvents>>({});
  const [quotesAt, setQuotesAt] = useState<string | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState(false);
  const [quotesFromCache, setQuotesFromCache] = useState(false);
  // Human-readable failures from the last refresh (shown in the UI, not hidden).
  const [refreshErrors, setRefreshErrors] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);

  // Inline manual price entry (for symbols the market API can't price).
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [loaded, safeTags, cached, watch, optCache, evCache] = await Promise.all([
        loadTrades(userId, encryptionKey),
        getSafeTags().catch(() => [] as Tag[]),
        loadCachedQuotes(userId).catch(() => ({} as Record<string, CachedQuote>)),
        loadWatchlist(userId).catch(() => [] as WatchItem[]),
        loadCachedOptionMarks(userId).catch(() => ({ marks: {} as Record<string, OptionMark>, asOf: undefined as string | undefined })),
        loadCachedTickerEvents(userId).catch(() => ({} as Record<string, TickerEvents>)),
      ]);
      setData(loaded);
      setTags(safeTags);
      setWatchlist(watch);
      if (Object.keys(evCache).length) setTickerEvents(evCache);
      // Paint from cached prices (no market API call on load).
      if (Object.keys(cached).length) {
        setQuotes(cached);
        setQuotesFromCache(true);
        const latest = Object.values(cached).map(q => q.asOf).filter(Boolean).sort();
        setQuotesAt(latest.length ? (latest[latest.length - 1] as string) : null);
      }
      // Paint cached option marks so Mark / Market value aren't blank on load.
      if (Object.keys(optCache.marks).length) {
        setOptionQuotes(optCache.marks);
        if (optCache.asOf) setQuotesAt(prev => (!prev || optCache.asOf! > prev ? optCache.asOf! : prev));
      }
      setLoading(false);
    })();
  }, [userId, encryptionKey]);

  // Filter list = managed sources ∪ sources seen on transactions (+ Unassigned).
  const accounts = useMemo(() => {
    const set = new Set<string>(data.accounts || []);
    let hasUnassigned = false;
    data.transactions.forEach(t => { if (t.account) set.add(t.account); else hasUnassigned = true; });
    const arr = Array.from(set).sort();
    if (hasUnassigned) arr.push(DEFAULT_ACCOUNT_BUCKET);
    return arr;
  }, [data.transactions, data.accounts]);

  // Assignable sources for the manager / import re-assignment (seed fallback).
  const assignableAccounts = useMemo(() => {
    const set = new Set<string>(data.accounts || []);
    data.transactions.forEach(t => { if (t.account) set.add(t.account); });
    const arr = Array.from(set).sort();
    return arr.length ? arr : [...TRADE_ACCOUNTS];
  }, [data.accounts, data.transactions]);

  const accountCounts = useMemo(() => {
    const m = new Map<string, number>();
    data.transactions.forEach(t => {
      const k = t.account || DEFAULT_ACCOUNT_BUCKET;
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [data.transactions]);

  const [showAccounts, setShowAccounts] = useState(false);

  // Persist the account visibility choice per user.
  useEffect(() => {
    try { localStorage.setItem(hiddenAccountsKey(userId), JSON.stringify(hiddenAccounts)); } catch { /* ignore */ }
  }, [hiddenAccounts, userId]);

  // Account-scoped full history — used for share holdings & data recency.
  // hiddenAccounts empty = show all; otherwise exclude the hidden ones.
  const accountTxns = useMemo(() => {
    if (!hiddenAccounts.length) return data.transactions;
    const hidden = new Set(hiddenAccounts);
    return data.transactions.filter(t => !hidden.has(t.account || DEFAULT_ACCOUNT_BUCKET));
  }, [data.transactions, hiddenAccounts]);

  const visibleAccountCount = useMemo(
    () => accounts.filter(a => !hiddenAccounts.includes(a)).length,
    [accounts, hiddenAccounts]
  );
  const accountFilterActive = hiddenAccounts.length > 0 && visibleAccountCount < accounts.length;

  const { fromDate, toDate } = useMemo(() => computeDateBounds(datePreset, customFrom, customTo), [datePreset, customFrom, customTo]);
  const inRange = (d: string) => {
    if (!d) return true;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };
  const dateFilterActive = !!(fromDate || toDate);

  // Date-scoped transactions — used for income, charts, activity, table view.
  const dateTxns = useMemo(
    () => dateFilterActive ? accountTxns.filter(t => inRange(t.activityDate)) : accountTxns,
    [accountTxns, fromDate, toDate, dateFilterActive]
  );

  // Holdings & names from full history; income from the date-scoped set.
  const summaryFull = useMemo(() => computeSummary(accountTxns), [accountTxns]);
  const summary = useMemo(() => computeSummary(dateTxns), [dateTxns]);

  const fullByTicker = useMemo(() => new Map(summaryFull.byTicker.map(t => [t.ticker, t])), [summaryFull]);
  const dateByTicker = useMemo(() => new Map(summary.byTicker.map(t => [t.ticker, t])), [summary]);

  const tagName = (id: string) => tags.find(t => t.id === id)?.name || id;

  // Transactions table: account-scoped (not date-scoped) so ignored rows can be
  // shown greyed out; date inclusion is flagged per row.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accountTxns.filter(t => {
      if (tickerFilter !== 'all' && t.instrument !== tickerFilter) return false;
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
      if (q && !(`${t.instrument} ${t.description} ${t.transCode}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [accountTxns, search, tickerFilter, kindFilter]);
  const includedCount = useMemo(() => filtered.filter(t => inRange(t.activityDate)).length, [filtered, fromDate, toDate]);

  // Sorted by absolute income so the biggest gains AND losses both surface.
  // Bars all extend in the same direction (absIncome); losses are colored red.
  const topTickers = useMemo(
    () => [...summary.byTicker]
      .sort((a, b) => Math.abs(b.income) - Math.abs(a.income))
      .slice(0, 12)
      .map(t => ({ ...t, name: t.name || fullByTicker.get(t.ticker)?.name, absIncome: Math.abs(t.income) })),
    [summary, fullByTicker]
  );

  // "Currently held" = positive net shares only (from full history).
  const heldTickers = useMemo(() => summaryFull.byTicker.filter(t => t.sharesHeld > 0.0001), [summaryFull]);

  // "Closed / sold" = any ticker with realized sell activity (from full
  // history). A stock can appear here AND in "Currently held" if it was partly
  // sold — this surfaces past closed trades regardless of the current position.
  const closedTickers = useMemo(() => summaryFull.byTicker.filter(t => t.sharesSold > 0.0001), [summaryFull]);

  // All currently-open option legs (across tickers), from full account history.
  const openOptions = useMemo(() => computeOpenOptions(accountTxns), [accountTxns]);

  // Publish a NON-sensitive snapshot of open legs so the notification service
  // can remind about upcoming expiries / assignment risk without the Safe key.
  useEffect(() => {
    updateOpenOptionsCache(openOptions.map(o => {
      const px = quotes[o.ticker]?.price;
      const itm = px != null && o.strike != null
        ? (o.optionType === 'CALL' ? px >= o.strike : px <= o.strike)
        : undefined;
      return {
        ticker: o.ticker,
        optionType: o.optionType,
        strike: o.strike,
        expiration: o.expiration,
        side: o.side,
        contracts: Math.abs(o.netContracts),
        itm,
      };
    }));
  }, [openOptions, quotes]);

  // Symbols to price = held positions ∪ watchlist favorites.
  const priceSymbolsKey = useMemo(
    () => Array.from(new Set([...heldTickers.map(t => t.ticker), ...watchlist.map(w => w.ticker)])).sort().join(','),
    [heldTickers, watchlist]
  );
  const optionLegsKey = useMemo(
    () => openOptions.map(o => optionLegKey(o.ticker, o.optionType, o.strike ?? 0, o.expiration ?? '')).sort().join(';'),
    [openOptions]
  );
  // Explicit refresh only (never auto-called on paint): hits the market API,
  // updates state, and writes the result back to the DB cache.
  const loadQuotes = React.useCallback(async () => {
    const symbols = priceSymbolsKey ? priceSymbolsKey.split(',') : [];
    if (symbols.length === 0 && openOptions.length === 0) return;
    console.log(`[Trades] 🔄 Refresh prices — ${symbols.length} stock symbol(s), ${openOptions.length} open option leg(s)`);
    setQuotesLoading(true);
    setQuotesError(false);
    setRefreshErrors([]);
    // Each source is fetched independently so a failure in one never discards
    // the others' results. Failures are collected and surfaced in the UI.
    const errs: string[] = [];
    const errMsg = (e: any) => (e?.message || String(e || 'unknown error'));
    const [stockRes, optRes, evRes] = await Promise.all([
      symbols.length
        ? fetchQuotes(symbols).catch(e => { const m = errMsg(e); console.error('[Trades] ✗ stock quotes failed:', m); errs.push(`Prices — ${m}`); return { quotes: {} as Record<string, Quote>, asOf: undefined }; })
        : Promise.resolve({ quotes: {} as Record<string, Quote>, asOf: undefined }),
      openOptions.length
        ? fetchOptionQuotes(openOptions.map(o => ({ symbol: o.ticker, expiration: o.expiration || '', optionType: o.optionType, strike: o.strike ?? 0 })))
            .catch(e => { const m = errMsg(e); console.error('[Trades] ✗ option marks failed:', m); errs.push(`Option marks — ${m}`); return {} as Record<string, OptionMark>; })
        : Promise.resolve({} as Record<string, OptionMark>),
      symbols.length
        ? fetchTickerEvents(symbols).catch(e => { const m = errMsg(e); console.error('[Trades] ✗ upcoming dates failed:', m); errs.push(`Upcoming dates — ${m}`); return { events: {} as Record<string, TickerEvents>, asOf: undefined }; })
        : Promise.resolve({ events: {} as Record<string, TickerEvents>, asOf: undefined }),
    ]);

    const asOf = stockRes.asOf || new Date().toISOString();
    const stockCount = Object.keys(stockRes.quotes).length;
    const optCount = Object.keys(optRes).length;

    if (stockCount > 0) {
      const cached: Record<string, CachedQuote> = {};
      for (const [k, q] of Object.entries(stockRes.quotes)) cached[k] = { ...q, asOf };
      // Merge over existing cache so tickers the API missed keep old prices.
      setQuotes(prev => ({ ...prev, ...cached }));
      setQuotesAt(asOf);
      setQuotesFromCache(false);
      saveCachedQuotes(userId, stockRes.quotes, asOf).catch(() => {});
    }
    // Merge option marks so a partial/empty result doesn't blow away prior marks.
    if (optCount > 0) {
      setOptionQuotes(prev => ({ ...prev, ...optRes }));
      saveCachedOptionMarks(userId, optRes, asOf).catch(() => {});
    }
    // Merge upcoming event dates (earnings / ex-div) and cache them.
    const evCount = Object.keys(evRes.events).length;
    if (evCount > 0) {
      setTickerEvents(prev => ({ ...prev, ...evRes.events }));
      saveCachedTickerEvents(userId, evRes.events, evRes.asOf || asOf).catch(() => {});
    }

    // Only flag an error when nothing at all came back for what we asked for.
    const stockFailed = symbols.length > 0 && stockCount === 0;
    const optFailed = openOptions.length > 0 && optCount === 0;
    if (stockFailed && (openOptions.length === 0 || optFailed)) setQuotesError(true);
    if (optFailed) console.warn('[Trades] ⚠️ No option marks returned — check the [Quotes] logs above (dev servers may not run /api routes; options need Vercel/prod).');
    console.log(`[Trades] ✅ Refresh done — stocks ${stockCount}/${symbols.length}, option marks ${optCount}/${openOptions.length}, dated tickers ${evCount}`);

    setRefreshErrors(errs);
    setQuotesLoading(false);
    // openOptions referenced via optionLegsKey for stable deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceSymbolsKey, optionLegsKey, userId]);

  const holdingsMarketValue = useMemo(
    () => heldTickers.reduce((sum, t) => sum + (quotes[t.ticker]?.price ?? 0) * t.sharesHeld, 0),
    [heldTickers, quotes]
  );

  // Held tickers with no price yet — the market API couldn't price them (e.g.
  // 529-plan portfolio codes) or prices haven't been fetched. These can be
  // filled in manually from the holdings table.
  const missingPriced = useMemo(
    () => heldTickers.filter(t => !quotes[t.ticker]).map(t => t.ticker),
    [heldTickers, quotes]
  );

  const startEditPrice = (ticker: string, current?: number) => {
    setEditingPrice(ticker);
    setPriceDraft(current != null ? String(current) : '');
  };
  const cancelEditPrice = () => { setEditingPrice(null); setPriceDraft(''); };

  const saveManualPrice = async (ticker: string) => {
    const price = parseFloat(priceDraft);
    if (!isFinite(price) || price <= 0) { cancelEditPrice(); return; }
    const asOf = new Date().toISOString();
    setQuotes(prev => ({ ...prev, [ticker]: { symbol: ticker, price, currency: 'USD', asOf, source: 'manual' } }));
    cancelEditPrice();
    await saveManualQuote(userId, ticker, price).catch(() => {});
  };

  // Current liquidation value of an option leg (+asset for longs, −liability for
  // shorts). netContracts already carries the sign; contract multiplier = 100.
  const legMarketValue = React.useCallback((o: OpenOption): number | null => {
    const m = optionQuotes[optionLegKey(o.ticker, o.optionType, o.strike ?? 0, o.expiration ?? '')];
    if (!m || m.mark == null) return null;
    return o.netContracts * m.mark * 100;
  }, [optionQuotes]);

  // Per-ticker sum of open-option liquidation values (only legs with a mark).
  const optionValueByTicker = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of openOptions) {
      const v = legMarketValue(o);
      if (v == null) continue;
      map.set(o.ticker, (map.get(o.ticker) ?? 0) + v);
    }
    return map;
  }, [openOptions, legMarketValue]);

  // Compact, token-optimized snapshot for the AI insights panel (built from
  // derived data only — never raw transactions).
  const portfolioDigest = useMemo(
    () => buildPortfolioDigest({
      summaryFull,
      heldTickers,
      closedTickers,
      openOptions,
      quotes,
      optionMarks: optionQuotes,
    }),
    [summaryFull, heldTickers, closedTickers, openOptions, quotes, optionQuotes]
  );

  // Upcoming factual event dates (earnings / ex-div / dividend) for held +
  // watchlist tickers, within the next 90 days, sorted soonest first.
  const upcomingDates = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(); horizon.setDate(horizon.getDate() + 90);
    const horizonStr = horizon.toISOString().slice(0, 10);
    const relevant = new Set([...heldTickers.map(t => t.ticker), ...watchlist.map(w => w.ticker)]);
    const items: { ticker: string; kind: 'Earnings' | 'Ex-dividend' | 'Dividend pay'; date: string; estimated?: boolean }[] = [];
    for (const e of Object.values(tickerEvents)) {
      if (!relevant.has(e.ticker)) continue;
      if (e.nextEarnings && e.nextEarnings >= today && e.nextEarnings <= horizonStr) items.push({ ticker: e.ticker, kind: 'Earnings', date: e.nextEarnings, estimated: e.earningsEstimated });
      if (e.exDividend && e.exDividend >= today && e.exDividend <= horizonStr) items.push({ ticker: e.ticker, kind: 'Ex-dividend', date: e.exDividend });
      if (e.dividendDate && e.dividendDate >= today && e.dividendDate <= horizonStr) items.push({ ticker: e.ticker, kind: 'Dividend pay', date: e.dividendDate });
    }
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [tickerEvents, heldTickers, watchlist]);

  // Total P/L across held stocks that have a live price (net cash + market value).
  const holdingsPL = useMemo(() => {
    let total = 0; let any = false;
    for (const t of heldTickers) {
      const q = quotes[t.ticker];
      if (!q) continue;
      any = true;
      total += t.netCash + q.price * t.sharesHeld + (optionValueByTicker.get(t.ticker) ?? 0);
    }
    return any ? total : null;
  }, [heldTickers, quotes, optionValueByTicker]);

  // Accounts each ticker appears in (within the current filter) — for display.
  const accountsByTicker = useMemo(() => {
    const m = new Map<string, Set<string>>();
    accountTxns.forEach(t => {
      if (!t.instrument) return;
      if (!m.has(t.instrument)) m.set(t.instrument, new Set());
      m.get(t.instrument)!.add(t.account || DEFAULT_ACCOUNT_BUCKET);
    });
    return m;
  }, [accountTxns]);
  const tickerAccounts = (ticker: string) => Array.from(accountsByTicker.get(ticker) || []).sort();

  interface TickerRow { ticker: string; name?: string; sharesHeld: number; income: number; optionsPremium: number; dividends: number; netCash: number; fullNetCash: number; }
  const tickerRows: TickerRow[] = useMemo(() => {
    if (tickerScope === 'held') {
      return heldTickers.map(full => {
        const d = dateByTicker.get(full.ticker);
        return {
          ticker: full.ticker, name: full.name, sharesHeld: full.sharesHeld,
          income: d?.income ?? 0, optionsPremium: d?.optionsPremium ?? 0,
          dividends: d?.dividends ?? 0, netCash: d?.netCash ?? 0, fullNetCash: full.netCash,
        };
      }).sort((a, b) => b.income - a.income);
    }
    // 'closed' — tickers with realized sell activity (full history).
    return closedTickers.map(full => {
      const d = dateByTicker.get(full.ticker);
      return {
        ticker: full.ticker, name: full.name, sharesHeld: full.sharesHeld,
        income: d?.income ?? 0, optionsPremium: d?.optionsPremium ?? 0,
        dividends: d?.dividends ?? 0, netCash: d?.netCash ?? 0, fullNetCash: full.netCash,
      };
    }).sort((a, b) => b.fullNetCash - a.fullNetCash);
  }, [tickerScope, heldTickers, closedTickers, dateByTicker]);

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
  const incomeTotalAbs = useMemo(() => incomePie.reduce((a, d) => a + Math.abs(d.value), 0), [incomePie]);

  const openTicker = (ticker: string) => {
    if (!ticker) return;
    const name = fullByTicker.get(ticker)?.name;
    // Ticker detail shows full history (incl. original buys) for the account.
    setPanel({ title: `📊 ${ticker}${name ? ` — ${name}` : ''}`, ticker, txns: accountTxns.filter(t => t.instrument === ticker) });
  };

  const openActivity = (label: string, codes: string[]) => {
    setPanel({ title: `⚙️ Options ${label}`, txns: dateTxns.filter(t => codes.includes(t.transCode)) });
  };

  const openKind = (label: string, kinds: TradeKind[]) => {
    setPanel({ title: `💰 ${label}`, txns: dateTxns.filter(t => kinds.includes(t.kind)) });
  };

  const persist = async (next: TradesData) => {
    setData(next);
    await saveTrades(userId, encryptionKey, next);
  };

  const addAccount = async (nameRaw: string) => {
    const name = nameRaw.trim();
    if (!name || (data.accounts || []).includes(name)) return;
    await persist({ ...data, accounts: [...(data.accounts || []), name] });
  };

  const renameAccount = async (oldName: string, nextRaw: string) => {
    const nextName = nextRaw.trim();
    if (!nextName || nextName === oldName) return;
    await persist({
      ...data,
      accounts: Array.from(new Set((data.accounts || []).map(a => (a === oldName ? nextName : a)))),
      transactions: data.transactions.map(t => (t.account === oldName ? { ...t, account: nextName } : t)),
      imports: data.imports.map(b => (b.account === oldName ? { ...b, account: nextName } : b)),
    });
    setHiddenAccounts(prev => prev.map(a => (a === oldName ? nextName : a)));
  };

  const deleteAccount = async (name: string) => {
    if (!window.confirm(`Delete source "${name}"? Its transactions move to ${DEFAULT_ACCOUNT_BUCKET} (no data is lost).`)) return;
    await persist({
      ...data,
      accounts: (data.accounts || []).filter(a => a !== name),
      transactions: data.transactions.map(t => (t.account === name ? { ...t, account: undefined } : t)),
      imports: data.imports.map(b => (b.account === name ? { ...b, account: undefined } : b)),
    });
    setHiddenAccounts(prev => prev.filter(a => a !== name));
  };

  const toggleAccountVisible = (name: string) => {
    setHiddenAccounts(prev => prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]);
  };
  const showAllAccounts = () => setHiddenAccounts([]);
  const hideAllAccounts = () => setHiddenAccounts([...accounts]);

  const addFavorite = async (tickerRaw: string) => {
    const ticker = tickerRaw.trim().toUpperCase();
    if (!ticker || watchlist.some(w => w.ticker === ticker)) return;
    const name = fullByTicker.get(ticker)?.name;
    setWatchlist(prev => [...prev, { ticker, name }]);
    await addWatch(userId, ticker, name);
  };

  const removeFavorite = async (ticker: string) => {
    setWatchlist(prev => prev.filter(w => w.ticker !== ticker));
    await removeWatch(userId, ticker);
  };

  const setBatchAccount = async (batchId: string, acct: string) => {
    const account = acct || undefined;
    const next: TradesData = {
      ...data,
      transactions: data.transactions.map(t => t.importBatchId === batchId ? { ...t, account } : t),
      imports: data.imports.map(b => b.id === batchId ? { ...b, account } : b),
    };
    setData(next);
    await saveTrades(userId, encryptionKey, next);
  };

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
  const range = summary.dateRange;
  const fullRange = summaryFull.dateRange;
  const monthlyTitle = range ? `Monthly income (${range.start} – ${range.end})` : 'Monthly income';
  const dataAgeDays = fullRange ? Math.max(0, Math.floor((Date.now() - new Date(fullRange.end + 'T00:00:00').getTime()) / 86400000)) : null;
  const lastImportAt = data.imports[0]?.importedAt ? new Date(data.imports[0].importedAt).toLocaleDateString() : null;

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>📈 Trades</h2>
          {range && (
            <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
              {range.start} → {range.end} · {summary.totalTransactions} transactions · {summary.tickersTraded} tickers
              {dateFilterActive && <span style={{ color: '#4338ca', fontWeight: 600 }}> · filtered</span>}
            </p>
          )}
          {fullRange && (
            <p style={{ margin: '0.15rem 0 0', color: dataAgeDays != null && dataAgeDays > 7 ? '#d97706' : '#9ca3af', fontSize: '0.78rem' }}>
              Data current through {fullRange.end}
              {dataAgeDays != null && ` (${dataAgeDays === 0 ? 'today' : `${dataAgeDays} day${dataAgeDays === 1 ? '' : 's'} ago`})`}
              {lastImportAt && ` · last import ${lastImportAt}`}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {hasData && (
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value)}
              title="Date range"
              style={{ ...selectStyle, fontWeight: 600 }}
            >
              <option value="all">All time</option>
              <option value="ytd">Year to date</option>
              <option value="12m">Last 12 months</option>
              <option value="2025">2025 → today</option>
              <option value="2024">2024 → today</option>
              <option value="custom">Custom…</option>
            </select>
          )}
          {hasData && datePreset === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} title="From" style={selectStyle} />
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} title="To" style={selectStyle} />
            </>
          )}
          {hasData && (heldTickers.length > 0 || watchlist.length > 0) && (
            <button onClick={loadQuotes} disabled={quotesLoading} className="ck-btn" title="Fetch current prices from the market API and cache them">
              {quotesLoading ? '⏳ Prices…' : '🔄 Refresh prices'}
            </button>
          )}
          <button onClick={() => setShowAccounts(true)} className="ck-btn" title="Choose which accounts to show & manage sources">
            ⚙️ Accounts{accountFilterActive ? ` (${visibleAccountCount}/${accounts.length})` : ''}
          </button>
          <button onClick={() => setShowImport(true)} className="ck-btn ck-btn-primary">
            📥 Import trades
          </button>
        </div>
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
          {/* Refresh errors — surfaced, never hidden */}
          {refreshErrors.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
              borderRadius: 10, padding: '0.7rem 0.85rem', marginBottom: '1.25rem', fontSize: '0.85rem',
            }}>
              <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Last refresh had problems (showing any cached data):</div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {refreshErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
                <div style={{ marginTop: '0.35rem', fontSize: '0.76rem', color: '#9b1c1c' }}>
                  Market data comes from the <code>/api</code> routes — these need Vercel/prod (a plain dev server won't serve them). Check the browser console for details.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={loadQuotes} disabled={quotesLoading} className="ck-btn">Retry</button>
                <button onClick={() => setRefreshErrors([])} className="ck-btn" title="Dismiss">✕</button>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <SummaryCard label="Options premium" value={summary.income.optionsPremium} accent="#6366f1" onClick={() => openKind('Options premium', ['option_premium'])} />
            <SummaryCard label="Dividends" value={summary.income.dividends} accent="#10b981" onClick={() => openKind('Dividends', ['dividend'])} />
            <SummaryCard label="Interest" value={summary.income.interest} accent="#0ea5e9" onClick={() => openKind('Interest', ['interest'])} />
            <SummaryCard label="Stock lending" value={summary.income.lending} accent="#8b5cf6" onClick={() => openKind('Stock lending', ['lending'])} />
            <SummaryCard label="Total income" value={summary.income.total} accent="#111827" emphasize onClick={() => openKind('Total income', ['option_premium', 'dividend', 'interest', 'lending', 'tax'])} />
            <SummaryCard
              label="If sold now"
              value={holdingsPL ?? 0}
              valueOverride={holdingsPL == null ? '— refresh' : undefined}
              accent={holdingsPL != null && holdingsPL < 0 ? '#dc2626' : '#059669'}
              hint="Total profit/loss if you liquidated every current holding right now — realized cash (premiums, dividends, sales) plus the market value of shares & open options. Needs live prices (hit Refresh prices)."
            />
            <SummaryCard label="Deposits" value={summary.deposits} accent="#64748b" onClick={() => openKind('Deposits', ['deposit'])} />
          </div>

          {/* AI Portfolio Insights (opt-in — no tokens spent until generated) */}
          {userId && <TradesInsightsPanel userId={userId} digest={portfolioDigest} />}

          {/* Upcoming factual dates — earnings & dividends (not predictions) */}
          {upcomingDates.length > 0 && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: '0.7rem 0.9rem', marginBottom: '1.5rem', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>📅 Upcoming dates</span>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>earnings &amp; dividends for your holdings &amp; watchlist · next 90 days</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                {upcomingDates.map((u, i) => (
                  <EventChip key={`${u.ticker}-${u.kind}-${i}`} ticker={u.ticker} label={u.kind} date={u.date} estimated={u.estimated} />
                ))}
              </div>
            </div>
          )}

          {/* Charts row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <ChartCard
              title="Income breakdown"
              action={
                <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
                  <ToggleBtn active={incomeView === 'chart'} onClick={() => setIncomeView('chart')}>Chart</ToggleBtn>
                  <ToggleBtn active={incomeView === 'numbers'} onClick={() => setIncomeView('numbers')}>Numbers</ToggleBtn>
                </div>
              }
            >
              {incomePie.length === 0 ? <Empty /> : incomeView === 'chart' ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={incomePie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      labelLine={false}
                      label={(e: any) => {
                        // Hide labels for tiny slices to avoid overlap; they
                        // remain visible via tooltip, legend and Numbers view.
                        const share = incomeTotalAbs > 0 ? Math.abs(Number(e.value)) / incomeTotalAbs : 0;
                        return share >= 0.05 ? formatCurrency(Number(e.value)) : '';
                      }}
                    >
                      {incomePie.map((_, i) => <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: '0.25rem 0' }}>
                  <NumberRow label="Premiums" value={summary.income.optionsPremium} color={INCOME_COLORS[0]} />
                  <NumberRow label="Dividends" value={summary.income.dividends} color={INCOME_COLORS[1]} />
                  <NumberRow label="Interest" value={summary.income.interest} color={INCOME_COLORS[2]} />
                  <NumberRow label="Lending" value={summary.income.lending} color={INCOME_COLORS[3]} />
                  <NumberRow label="Tax" value={summary.income.tax} color={INCOME_COLORS[4]} />
                  <div style={{ borderTop: '2px solid #e5e7eb', marginTop: 6, paddingTop: 6 }}>
                    <NumberRow label="Total income" value={summary.income.total} color="#111827" bold />
                  </div>
                </div>
              )}
            </ChartCard>

            <ChartCard title={monthlyTitle}>
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

          {/* Top tickers (clickable) */}
          <ChartCard title="Income by ticker — click a bar for details">
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.72rem', color: '#6b7280' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: BAR_POSITIVE }} /> Gain</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: BAR_NEGATIVE }} /> Loss</span>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(240, topTickers.length * 34)}>
              <BarChart data={topTickers} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => formatCurrency(v, { compact: true })} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="ticker" width={64} tick={{ fontSize: 12 }} />
                <Tooltip content={<TickerBarTooltip />} />
                <Bar dataKey="absIncome" name="Income" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(d: any) => openTicker(d?.ticker || d?.payload?.ticker)}>
                  {topTickers.map((t, i) => <Cell key={i} fill={t.income >= 0 ? BAR_POSITIVE : BAR_NEGATIVE} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Portfolio / tickers table (clickable) */}
          <ChartCard
            title="Tickers"
            action={
              <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
                <ToggleBtn active={tickerScope === 'held'} onClick={() => setTickerScope('held')}>Currently held ({heldTickers.length})</ToggleBtn>
                <ToggleBtn active={tickerScope === 'closed'} onClick={() => setTickerScope('closed')}>Closed / sold ({closedTickers.length})</ToggleBtn>
                <ToggleBtn active={tickerScope === 'options'} onClick={() => setTickerScope('options')}>Open options ({openOptions.length})</ToggleBtn>
              </div>
            }
          >
            {tickerScope === 'options' ? (
              openOptions.length === 0 ? (
                <p style={{ color: '#9ca3af', margin: 0 }}>No open option positions.</p>
              ) : (
                <>
                  {Object.keys(optionQuotes).length === 0 && (
                    <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#9333ea', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '0.5rem 0.7rem' }}>
                      Live option marks aren't loaded — hit <strong>🔄 Refresh prices</strong> to value these positions. Marks aren't cached between sessions, so <strong>Mark</strong> and <strong>Mkt value</strong> stay blank until you refresh. Some illiquid or non-standard contracts may still not return a quote.
                    </p>
                  )}
                  <OpenOptionsTable openOptions={openOptions} optionQuotes={optionQuotes} legMarketValue={legMarketValue} onTicker={openTicker} />
                </>
              )
            ) : tickerRows.length === 0 ? (
              <p style={{ color: '#9ca3af', margin: 0 }}>No {tickerScope === 'held' ? 'open share positions' : 'closed / sold positions'} found.</p>
            ) : tickerScope === 'closed' ? (
              <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: '1px solid #eef0f2', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                      <Th>Ticker</Th><Th>Name</Th><Th>Account</Th><Th align="right">Shares held</Th>
                      <Th align="right">Avg buy</Th><Th align="right">Avg sell</Th>
                      <Th align="right">Realized</Th><Th align="right">Income</Th>
                      <Th align="right">Premium</Th><Th align="right">Dividends</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickerRows.map(t => {
                      const full = fullByTicker.get(t.ticker);
                      const held = Math.abs(t.sharesHeld) > 0.0001;
                      const avgBuy = full && full.sharesBought > 0.0001 ? full.costBought / full.sharesBought : null;
                      const avgSell = full && full.sharesSold > 0.0001 ? full.proceedsSold / full.sharesSold : null;
                      const realized = t.fullNetCash;
                      return (
                        <tr key={t.ticker} onClick={() => openTicker(t.ticker)} style={{ borderTop: '1px solid #f1f1f1', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <Td><strong style={{ color: '#4338ca' }}>{t.ticker}</strong></Td>
                          <Td title={t.name} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{t.name || '—'}</Td>
                          <Td><AccountBadges accounts={tickerAccounts(t.ticker)} /></Td>
                          <Td align="right">{held ? t.sharesHeld.toLocaleString('en-US', { maximumFractionDigits: 4 }) : <span style={{ color: '#9ca3af' }} title="Position fully closed">closed</span>}</Td>
                          <Td align="right" title={full && avgBuy != null ? `${full.sharesBought.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares bought for ${formatCurrency(full.costBought)}` : undefined}>{avgBuy != null ? formatCurrency(avgBuy) : '—'}</Td>
                          <Td align="right" title={full && avgSell != null ? `${full.sharesSold.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares sold for ${formatCurrency(full.proceedsSold)}` : undefined}>{avgSell != null ? formatCurrency(avgSell) : '—'}</Td>
                          <Td align="right" title="All cash in/out for this ticker: sale proceeds + option premiums + dividends − purchase cost. Ignores today's price." style={{ color: realized < 0 ? '#dc2626' : '#059669', fontWeight: 800 }}>{formatCurrency(realized)}</Td>
                          <Td align="right" style={{ color: t.income < 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>{formatCurrency(t.income)}</Td>
                          <Td align="right">{formatCurrency(t.optionsPremium)}</Td>
                          <Td align="right">{formatCurrency(t.dividends)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: '1px solid #eef0f2', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                      <Th>Ticker</Th><Th>Name</Th><Th>Account</Th><Th align="right">Shares held</Th>
                      <Th align="right">Price</Th><Th align="right">Mkt value</Th><Th align="right">P/L (if sold)</Th><Th align="right">Income</Th>
                      <Th align="right">Premium</Th><Th align="right">Dividends</Th><Th align="right">Net cash</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickerRows.map(t => {
                      const q = quotes[t.ticker];
                      const held = Math.abs(t.sharesHeld) > 0.0001;
                      const mktValue = q && held ? q.price * t.sharesHeld : null;
                      const optVal = optionValueByTicker.get(t.ticker) ?? 0;
                      const pl = mktValue != null ? t.fullNetCash + mktValue + optVal : null;
                      return (
                      <tr key={t.ticker} onClick={() => openTicker(t.ticker)} style={{ borderTop: '1px solid #f1f1f1', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8faff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <Td><strong style={{ color: '#4338ca' }}>{t.ticker}</strong></Td>
                        <Td title={t.name} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{t.name || '—'}</Td>
                        <Td><AccountBadges accounts={tickerAccounts(t.ticker)} /></Td>
                        <Td align="right">{held ? t.sharesHeld.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</Td>
                        <Td align="right" title={q?.changePct != null ? `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}% today` : undefined} style={{ color: q ? (q.change != null && q.change < 0 ? '#dc2626' : '#059669') : '#9ca3af' }}>
                          {editingPrice === t.ticker ? (
                            <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', gap: 3, alignItems: 'center', justifyContent: 'flex-end' }}>
                              <input
                                autoFocus
                                type="number"
                                step="0.01"
                                min="0"
                                value={priceDraft}
                                onChange={e => setPriceDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveManualPrice(t.ticker); } else if (e.key === 'Escape') { e.preventDefault(); cancelEditPrice(); } }}
                                placeholder="0.00"
                                style={{ width: 72, padding: '0.15rem 0.35rem', border: '1px solid #a5b4fc', borderRadius: 5, fontSize: '0.8rem', textAlign: 'right' }}
                              />
                              <button onClick={() => saveManualPrice(t.ticker)} className="ck-btn ck-btn-sm" title="Save price" style={{ padding: '0.1rem 0.3rem' }}>✓</button>
                              <button onClick={cancelEditPrice} className="ck-btn ck-btn-sm" title="Cancel" style={{ padding: '0.1rem 0.3rem' }}>✕</button>
                            </span>
                          ) : q ? (
                            <span
                              onClick={e => { e.stopPropagation(); startEditPrice(t.ticker, q.price); }}
                              title={q.source === 'manual' ? 'Manually entered — click to edit' : 'Click to override price'}
                              style={{ cursor: 'pointer' }}
                            >
                              {formatCurrency(q.price)}
                              {q.source === 'manual' && <span style={{ color: '#9333ea', fontSize: '0.7rem', marginLeft: 3 }} title="Manual price">✎</span>}
                            </span>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); startEditPrice(t.ticker, undefined); }}
                              className="ck-btn ck-btn-sm"
                              title="No live price available — enter one manually"
                              style={{ padding: '0.1rem 0.4rem', fontSize: '0.72rem' }}
                            >
                              ＋ price
                            </button>
                          )}
                        </Td>
                        <Td align="right" style={{ fontWeight: 700 }}>{mktValue != null ? formatCurrency(mktValue) : '—'}</Td>
                        <Td align="right" title={pl != null ? 'Net cash + current market value (stock + open options)' : undefined} style={{ color: pl == null ? '#9ca3af' : pl < 0 ? '#dc2626' : '#059669', fontWeight: 800 }}>{pl != null ? formatCurrency(pl) : '—'}</Td>
                        <Td align="right" style={{ color: t.income < 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>{formatCurrency(t.income)}</Td>
                        <Td align="right">{formatCurrency(t.optionsPremium)}</Td>
                        <Td align="right">{formatCurrency(t.dividends)}</Td>
                        <Td align="right" style={{ color: t.netCash < 0 ? '#dc2626' : '#374151' }}>{formatCurrency(t.netCash)}</Td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {tickerScope === 'held' && heldTickers.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem', fontSize: '0.82rem' }}>
                <span style={{ color: quotesError ? '#d97706' : '#6b7280' }}>
                  {quotesLoading ? 'Fetching prices…'
                    : quotesError && quotesAt ? `⚠️ Live fetch failed — showing cached prices from ${new Date(quotesAt).toLocaleString()}`
                    : quotesError ? '⚠️ Live prices unavailable right now'
                    : quotesAt ? `Prices ${quotesFromCache ? 'cached' : 'as of'} ${new Date(quotesAt).toLocaleString()}`
                    : 'Prices not loaded — hit Refresh prices'}
                  {!quotesLoading && quotesAt && missingPriced.length > 0 && (
                    <span style={{ color: '#9333ea' }}> · {missingPriced.length} without a live price — click <strong>＋ price</strong> in the table to enter manually</span>
                  )}
                </span>
                <span style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {holdingsMarketValue > 0 && (
                    <span style={{ fontWeight: 800 }}>Market value: {formatCurrency(holdingsMarketValue)}</span>
                  )}
                  {holdingsPL != null && (
                    <span style={{ fontWeight: 800, color: holdingsPL < 0 ? '#dc2626' : '#059669' }}>
                      P/L if sold: {formatCurrency(holdingsPL)}
                    </span>
                  )}
                </span>
              </div>
            )}
            {tickerScope === 'closed' && (
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                Tickers you've sold (realized trades) — a name still held in part appears here too, with its remaining <strong>Shares held</strong> shown. <strong>Avg buy</strong>, <strong>Avg sell</strong> and <strong>Realized</strong> use full history and ignore today's price. <strong>Realized</strong> = sale proceeds + premiums + dividends − purchase cost. Income / Premium / Dividends follow the date filter.
              </p>
            )}
          </ChartCard>

          {/* Watchlist / favorites */}
          <ChartCard
            title={`⭐ Favorites (${watchlist.length})`}
            action={
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  list="fav-ticker-list"
                  value={favInput}
                  onChange={e => setFavInput(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFavorite(favInput); setFavInput(''); } }}
                  placeholder="Add ticker…"
                  style={{ ...selectStyle, width: 130, textTransform: 'uppercase' }}
                />
                <datalist id="fav-ticker-list">
                  {summary.byTicker.map(t => <option key={t.ticker} value={t.ticker}>{t.name || t.ticker}</option>)}
                </datalist>
                <button onClick={() => { addFavorite(favInput); setFavInput(''); }} disabled={!favInput.trim()} className="ck-btn">+ Add</button>
              </div>
            }
          >
            {watchlist.length === 0 ? (
              <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.88rem' }}>
                Add tickers you follow to track their price without importing trades. Prices come from the cached quotes (hit <strong>Refresh prices</strong> to update).
              </p>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #eef0f2', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <Th>Ticker</Th><Th>Name</Th><Th align="right">Price</Th><Th align="right">Day</Th><Th align="right">You hold</Th>
                      <Th align="right">Buy cost</Th><Th align="right">Value today</Th><Th align="right">P/L if sold</Th><Th align="right">Earnings</Th><Th align="right">{' '}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map(w => {
                      const q = quotes[w.ticker];
                      const full = fullByTicker.get(w.ticker);
                      const held = full && full.sharesHeld > 0.0001 ? full.sharesHeld : 0;
                      const traded = !!full;
                      const avgCost = full && full.sharesBought > 0 ? full.costBought / full.sharesBought : 0;
                      const buyCost = held && avgCost ? avgCost * held : null;
                      const valueToday = q && held ? q.price * held : null;
                      // Total P/L if liquidated now = net cash (all realized flows,
                      // incl. premiums/dividends) + current stock value + open options.
                      // Matches the ticker panel's "P/L if sold now".
                      const optVal = optionValueByTicker.get(w.ticker) ?? 0;
                      const pl = valueToday != null ? (full?.netCash ?? 0) + valueToday + optVal : null;
                      return (
                        <tr key={w.ticker} style={{ borderTop: '1px solid #f1f1f1' }}>
                          <Td>{traded
                            ? <button onClick={() => openTicker(w.ticker)} style={tickerLinkStyle}>{w.ticker}</button>
                            : <strong style={{ color: '#4338ca' }}>{w.ticker}</strong>}</Td>
                          <Td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }}>{w.name || full?.name || '—'}</Td>
                          <Td align="right" style={{ fontWeight: 700 }}>{q ? formatCurrency(q.price) : '—'}</Td>
                          <Td align="right" style={{ color: q?.change == null ? '#9ca3af' : q.change < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                            {q?.changePct != null ? `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%` : '—'}
                          </Td>
                          <Td align="right">{held ? held.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</Td>
                          <Td align="right" title={buyCost != null ? `Avg cost ${formatCurrency(avgCost)}/sh × ${held}` : undefined}>{buyCost != null ? formatCurrency(buyCost) : '—'}</Td>
                          <Td align="right" style={{ fontWeight: 700 }}>{valueToday != null ? formatCurrency(valueToday) : '—'}</Td>
                          <Td align="right" title={pl != null ? 'Net cash (incl. premiums & dividends collected) + current value' : undefined} style={{ fontWeight: 800, color: pl == null ? '#9ca3af' : pl < 0 ? '#dc2626' : '#059669' }}>
                            {pl != null ? `${pl >= 0 ? '+' : ''}${formatCurrency(pl)}` : '—'}
                          </Td>
                          <Td align="right" style={{ whiteSpace: 'nowrap', color: '#6b7280' }} title="Next scheduled earnings date (hit Refresh prices to update)">
                            {tickerEvents[w.ticker]?.nextEarnings
                              ? `${fmtEventDate(tickerEvents[w.ticker].nextEarnings!)}${tickerEvents[w.ticker]?.earningsEstimated ? ' (est)' : ''}`
                              : '—'}
                          </Td>
                          <Td align="right"><button onClick={() => removeFavorite(w.ticker)} className="ck-btn ck-btn-sm" title="Remove from favorites">✕</button></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                  <strong>P/L if sold</strong> is the total on the name — it credits option premiums &amp; dividends already collected, so it won't equal “Value today − Buy cost” (which is share price only).
                </p>
              </div>
            )}
          </ChartCard>

          {/* Options activity (clickable) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', margin: '1rem 0 1.5rem' }}>
            {ACTIVITY_GROUPS.map(g => (
              <button
                key={g.key}
                onClick={() => openActivity(g.label, g.codes)}
                style={{
                  background: '#fff', border: '1px solid #eef0f2', borderRadius: 10, padding: '0.6rem 0.9rem',
                  minWidth: 92, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c7d2fe'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#eef0f2'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4338ca' }}>{summary.optionActivity[g.key]}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>{g.label}</div>
              </button>
            ))}
          </div>

          {/* Imports (collapsed) */}
          {data.imports.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <FormCollapsible title={`Imports (${data.imports.length})`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {data.imports.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.25rem', borderBottom: '1px solid #f1f1f1', fontSize: '0.85rem' }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📄 {b.fileName}
                      </span>
                      {b.tags.map(id => (
                        <span key={id} style={{ background: '#ede9fe', color: '#6b21a8', borderRadius: 6, padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 600 }}>{tagName(id)}</span>
                      ))}
                      <select
                        value={b.account || ''}
                        onChange={e => setBatchAccount(b.id, e.target.value)}
                        title="Assign account"
                        style={{ padding: '0.25rem 0.4rem', border: `1px solid ${b.account ? '#d1d5db' : '#fca5a5'}`, borderRadius: 6, fontSize: '0.75rem', background: '#fff', maxWidth: 190 }}
                      >
                        <option value="">{DEFAULT_ACCOUNT_BUCKET}…</option>
                        {assignableAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <span style={{ color: '#6b7280' }}>+{b.added} · {b.duplicates} dup</span>
                      <button onClick={() => handleDeleteBatch(b.id)} className="ck-btn ck-btn-sm" title="Remove import">🗑️</button>
                    </div>
                  ))}
                </div>
              </FormCollapsible>
            </div>
          )}

          {/* Transactions (collapsed) */}
          <div style={{ marginBottom: '1rem' }}>
            <FormCollapsible title={`Transactions (${data.transactions.length})`}>
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

              {dateFilterActive && (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#6b7280' }}>
                  Date filter active — <strong style={{ color: '#059669' }}>{includedCount}</strong> of {filtered.length} rows counted; ignored rows are greyed out.
                </p>
              )}

              <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto', border: '1px solid #eef0f2', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                      {dateFilterActive && <Th>Incl.</Th>}
                      <Th>Date</Th><Th>Ticker</Th><Th>Description</Th><Th>Code</Th>
                      <Th align="right">Qty</Th><Th align="right">Price</Th><Th align="right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 300).map((t: RawTradeTxn) => {
                      const included = inRange(t.activityDate);
                      const dim = dateFilterActive && !included;
                      return (
                      <tr key={t.id} style={{ borderTop: '1px solid #f1f1f1', opacity: dim ? 0.45 : 1, background: dim ? '#fafafa' : undefined }}>
                        {dateFilterActive && <Td>{included ? <span title="Counted" style={{ color: '#059669' }}>✓</span> : <span title="Ignored (outside date range)" style={{ color: '#9ca3af' }}>—</span>}</Td>}
                        <Td>{t.activityDate}</Td>
                        <Td>{t.instrument
                          ? <button onClick={() => openTicker(t.instrument)} style={tickerLinkStyle}>{t.instrument}</button>
                          : '—'}</Td>
                        <Td title={t.description} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</Td>
                        <Td><span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: 5, padding: '0.05rem 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>{t.transCode}</span></Td>
                        <Td align="right">{t.quantityRaw ?? ''}</Td>
                        <Td align="right">{t.price != null ? formatCurrency(t.price) : ''}</Td>
                        <Td align="right" style={{ color: (t.amount ?? 0) < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                          {t.amount != null ? formatCurrency(t.amount) : ''}
                        </Td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length > 300 && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>Showing first 300 of {filtered.length}. Use filters to narrow down.</p>
              )}
            </FormCollapsible>
          </div>
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

      {/* Accounts / sources manager */}
      <SlideOverPanel isOpen={showAccounts} onClose={() => setShowAccounts(false)} title="⚙️ Accounts & sources" width={480}>
        <AccountsManager
          accounts={data.accounts || []}
          visibleOptions={accounts}
          hidden={hiddenAccounts}
          counts={accountCounts}
          onToggleVisible={toggleAccountVisible}
          onShowAll={showAllAccounts}
          onHideAll={hideAllAccounts}
          onAdd={addAccount}
          onRename={renameAccount}
          onDelete={deleteAccount}
        />
      </SlideOverPanel>

      {/* Detail panel */}
      <SlideOverPanel isOpen={!!panel} onClose={() => setPanel(null)} title={panel?.title} width={620}>
        {panel && <PanelContent
          key={panel.title}
          panel={panel}
          stats={panel.ticker ? summary.byTicker.find(t => t.ticker === panel.ticker) : undefined}
          quote={panel.ticker ? quotes[panel.ticker] : undefined}
          heldShares={panel.ticker ? fullByTicker.get(panel.ticker)?.sharesHeld : undefined}
          fullNetCash={panel.ticker ? fullByTicker.get(panel.ticker)?.netCash : undefined}
          optionQuotes={optionQuotes}
          optionValue={panel.ticker ? optionValueByTicker.get(panel.ticker) : undefined}
          events={panel.ticker ? tickerEvents[panel.ticker] : undefined}
        />}
      </SlideOverPanel>
    </div>
  );
};

const PanelContent: React.FC<{
  panel: PanelState;
  stats?: TickerStats;
  quote?: Quote;
  heldShares?: number;
  fullNetCash?: number;
  optionQuotes?: Record<string, OptionMark>;
  optionValue?: number;
  events?: TickerEvents;
}> = ({ panel, stats, quote, heldShares, fullNetCash, optionQuotes = {}, optionValue, events }) => {
  const [codeFilter, setCodeFilter] = useState<'all' | string>('all');
  const sorted = useMemo(
    () => [...panel.txns].sort((a, b) => (a.activityDate < b.activityDate ? 1 : a.activityDate > b.activityDate ? -1 : 0)),
    [panel.txns]
  );
  // Transaction-code filter (Buy / Sell / CDIV / STO …) with per-code counts.
  const codeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of panel.txns) if (t.transCode) m.set(t.transCode, (m.get(t.transCode) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [panel.txns]);
  const visibleTxns = useMemo(
    () => codeFilter === 'all' ? sorted : sorted.filter(t => t.transCode === codeFilter),
    [sorted, codeFilter]
  );
  const openOptions = useMemo(() => panel.ticker ? computeOpenOptions(panel.txns) : [], [panel.txns, panel.ticker]);
  // Prefer full-history shares (panel opens with full account history).
  const sharesHeld = heldShares ?? stats?.sharesHeld ?? 0;
  const mktValue = quote && Math.abs(sharesHeld) > 0.0001 ? quote.price * sharesHeld : null;
  const netCash = fullNetCash ?? stats?.netCash ?? 0;
  const plIfSold = mktValue != null ? netCash + mktValue + (optionValue ?? 0) : null;
  const hasPosition = panel.ticker && (Math.abs(sharesHeld) > 0.0001 || openOptions.length > 0);
  return (
    <div>
      {hasPosition && (
        <div style={{ border: '1px solid #e0e7ff', background: '#f5f7ff', borderRadius: 10, padding: '0.75rem 0.85rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4338ca', fontWeight: 800, marginBottom: '0.5rem' }}>Current position</div>
          {Math.abs(sharesHeld) > 0.0001 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: openOptions.length ? '0.5rem' : 0 }}>
              <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 6, padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 700 }}>STOCK</span>
              <strong>{sharesHeld.toLocaleString('en-US', { maximumFractionDigits: 4 })}</strong> shares
              {quote && <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>@ {formatCurrency(quote.price)}</span>}
              {mktValue != null && (
                <span style={{ marginLeft: 'auto', fontSize: '0.82rem', fontWeight: 800 }}>{formatCurrency(mktValue)}</span>
              )}
            </div>
          )}
          {plIfSold != null && (
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed #d7dcff' }}>
              Net cash {formatCurrency(netCash)} + market value {formatCurrency(mktValue!)}
              {optionValue ? ` ${optionValue < 0 ? '−' : '+'} options ${formatCurrency(Math.abs(optionValue))}` : ''} ={' '}
              <strong style={{ color: plIfSold < 0 ? '#dc2626' : '#059669' }}>{formatCurrency(plIfSold)} P/L if sold now</strong>
            </div>
          )}
          {openOptions.map((o, i) => {
            const mark = optionQuotes[optionLegKey(o.ticker, o.optionType, o.strike ?? 0, o.expiration ?? '')]?.mark;
            const val = mark != null ? o.netContracts * mark * 100 : null;
            return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.15rem 0' }}>
              <span style={{
                background: o.side === 'short' ? '#fef3c7' : '#dcfce7',
                color: o.side === 'short' ? '#92400e' : '#166534',
                borderRadius: 6, padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 700,
              }}>{o.side === 'short' ? 'SHORT' : 'LONG'} {o.optionType}</span>
              <span style={{ fontSize: '0.85rem' }}>
                <strong>{Math.abs(o.netContracts)}</strong> × ${o.strike} · exp {o.expiration}
              </span>
              {o.account && <AccountBadges accounts={[o.account]} />}
              {mark != null && <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>mark {formatCurrency(mark)}</span>}
              <span style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '0.78rem', color: o.premium < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                  {o.premium >= 0 ? '+' : ''}{formatCurrency(o.premium)} prem
                </span>
                {val != null && (
                  <span style={{ display: 'block', fontSize: '0.72rem', color: val < 0 ? '#dc2626' : '#111827', fontWeight: 700 }}>
                    {formatCurrency(val)} value
                  </span>
                )}
              </span>
            </div>
            );
          })}
        </div>
      )}
      {events && (events.nextEarnings || events.exDividend || events.dividendDate) && (
        <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: '0.6rem 0.8rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#b45309', fontWeight: 800, marginBottom: '0.4rem' }}>📅 Upcoming dates</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {[
              ...(events.nextEarnings ? [{ label: 'Earnings', date: events.nextEarnings, estimated: events.earningsEstimated }] : []),
              ...(events.exDividend ? [{ label: 'Ex-dividend', date: events.exDividend, estimated: false }] : []),
              ...(events.dividendDate ? [{ label: 'Dividend pay', date: events.dividendDate, estimated: false }] : []),
            ]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((e, i) => <EventChip key={`${e.label}-${i}`} label={e.label} date={e.date} estimated={e.estimated} />)}
          </div>
        </div>
      )}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          <MiniStat label="Income" value={formatCurrency(stats.income)} accent={stats.income < 0 ? '#dc2626' : '#059669'} />
          <MiniStat label="Premium" value={formatCurrency(stats.optionsPremium)} />
          <MiniStat label="Dividends" value={formatCurrency(stats.dividends)} />
          <MiniStat label="Contracts" value={String(stats.contracts)} />
          <MiniStat label="Shares held" value={Math.abs(stats.sharesHeld) > 0.0001 ? stats.sharesHeld.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0'} />
          <MiniStat label="Net cash" value={formatCurrency(netCash)} accent={netCash < 0 ? '#dc2626' : '#374151'} />
          {plIfSold != null && (
            <MiniStat label="P/L if sold now" value={`${plIfSold >= 0 ? '+' : ''}${formatCurrency(plIfSold)}`} accent={plIfSold < 0 ? '#dc2626' : '#059669'} />
          )}
        </div>
      )}
      {panel.ticker && <TickerNews ticker={panel.ticker} />}
      {stats?.firstDate && (
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.75rem' }}>
          Timeline: {stats.firstDate} → {stats.lastDate} · {panel.txns.length} transactions
        </p>
      )}

      {codeCounts.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem' }}>
          <FilterChip active={codeFilter === 'all'} onClick={() => setCodeFilter('all')}>All ({panel.txns.length})</FilterChip>
          {codeCounts.map(([code, n]) => (
            <FilterChip key={code} active={codeFilter === code} onClick={() => setCodeFilter(code)}>{code} ({n})</FilterChip>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {visibleTxns.map(t => (
          <div key={t.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.55rem 0.65rem', border: '1px solid #eef0f2', borderRadius: 8, background: '#fff' }}>
            <div style={{ minWidth: 76, fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, paddingTop: 2 }}>{t.activityDate}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: 5, padding: '0.05rem 0.4rem', fontSize: '0.7rem', fontWeight: 700 }}>{t.transCode}</span>
                {t.instrument && <strong style={{ fontSize: '0.85rem' }}>{t.instrument}</strong>}
                {t.optionType && <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{t.optionType} {t.strike ? `$${t.strike}` : ''} {t.expiration ? `exp ${t.expiration}` : ''}</span>}
                {t.account && <span style={{ fontSize: '0.66rem', color: '#6b21a8', background: '#f3e8ff', borderRadius: 5, padding: '0.05rem 0.35rem', fontWeight: 600 }}>{t.account}</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2, whiteSpace: 'pre-line' }}>{t.description}</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 90 }}>
              {t.amount != null && (
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: t.amount < 0 ? '#dc2626' : '#059669' }}>{formatCurrency(t.amount)}</div>
              )}
              {t.quantityRaw && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{t.quantityRaw} {t.price != null ? `@ ${formatCurrency(t.price)}` : ''}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const OpenOptionsTable: React.FC<{
  openOptions: OpenOption[];
  optionQuotes: Record<string, OptionMark>;
  legMarketValue: (o: OpenOption) => number | null;
  onTicker: (ticker: string) => void;
}> = ({ openOptions, optionQuotes, legMarketValue, onTicker }) => (
  <>
    <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: '1px solid #eef0f2', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
            <Th>Ticker</Th><Th>Account</Th><Th>Position</Th><Th align="right">Contracts</Th><Th align="right">Strike</Th>
            <Th>Expiration</Th><Th align="right">Premium</Th><Th align="right">Mark</Th><Th align="right">Mkt value</Th>
          </tr>
        </thead>
        <tbody>
          {openOptions.map((o, i) => {
            const mark = optionQuotes[optionLegKey(o.ticker, o.optionType, o.strike ?? 0, o.expiration ?? '')]?.mark;
            const val = legMarketValue(o);
            const dte = o.expiration ? Math.round((Date.parse(o.expiration + 'T00:00:00') - Date.now()) / 86400000) : null;
            return (
              <tr key={i} style={{ borderTop: '1px solid #f1f1f1' }}>
                <Td><button onClick={() => onTicker(o.ticker)} style={tickerLinkStyle}>{o.ticker}</button></Td>
                <Td><AccountBadges accounts={[o.account || DEFAULT_ACCOUNT_BUCKET]} /></Td>
                <Td>
                  <span style={{
                    background: o.side === 'short' ? '#fef3c7' : '#dcfce7',
                    color: o.side === 'short' ? '#92400e' : '#166534',
                    borderRadius: 6, padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 700,
                  }}>{o.side === 'short' ? 'SHORT' : 'LONG'} {o.optionType}</span>
                </Td>
                <Td align="right">{Math.abs(o.netContracts)}</Td>
                <Td align="right">{o.strike != null ? `$${o.strike}` : '—'}</Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{o.expiration}{dte != null && <span style={{ color: dte <= 7 ? '#d97706' : '#9ca3af', fontSize: '0.72rem' }}> · {dte}d</span>}</Td>
                <Td align="right" style={{ color: o.premium < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>{o.premium >= 0 ? '+' : ''}{formatCurrency(o.premium)}</Td>
                <Td align="right" style={{ color: '#6b7280' }}>{mark != null ? formatCurrency(mark) : '—'}</Td>
                <Td align="right" style={{ fontWeight: 700, color: val == null ? '#9ca3af' : val < 0 ? '#dc2626' : '#111827' }}>{val != null ? formatCurrency(val) : '—'}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
      Mark is the current option price (mid, else last) × 100 per contract. Longs are assets (+), shorts are liabilities to buy back (−).
    </p>
  </>
);

const AccountsManager: React.FC<{
  accounts: string[];
  visibleOptions: string[];
  hidden: string[];
  counts: Map<string, number>;
  onToggleVisible: (name: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onAdd: (name: string) => void;
  onRename: (oldName: string, next: string) => void;
  onDelete: (name: string) => void;
}> = ({ accounts, visibleOptions, hidden, counts, onToggleVisible, onShowAll, onHideAll, onAdd, onRename, onDelete }) => {
  const [newName, setNewName] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const unassigned = counts.get(DEFAULT_ACCOUNT_BUCKET) || 0;
  const hiddenSet = new Set(hidden);
  const isShown = (a: string) => !hiddenSet.has(a);
  const allShown = visibleOptions.every(a => isShown(a));
  const noneShown = visibleOptions.every(a => !isShown(a));

  const draftFor = (a: string) => (drafts[a] !== undefined ? drafts[a] : a);
  const add = () => { const n = newName.trim(); if (!n) return; onAdd(n); setNewName(''); };

  return (
    <div>
      {/* Visibility filter (merged from the old top dropdown) */}
      {visibleOptions.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4338ca', fontWeight: 800 }}>Show data for</span>
            <span style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={onShowAll} disabled={allShown} className="ck-btn ck-btn-sm">Select all</button>
              <button onClick={onHideAll} disabled={noneShown} className="ck-btn ck-btn-sm" title="Deselect every account (then pick the one you want)">Remove all</button>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {visibleOptions.map(a => (
              <label key={a} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.4rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', background: isShown(a) ? '#f5f7ff' : 'transparent' }}>
                <input type="checkbox" checked={isShown(a)} onChange={() => onToggleVisible(a)} />
                <span style={{ flex: 1 }}>{a}</span>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{counts.get(a) || 0} txns</span>
              </label>
            ))}
          </div>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
            {allShown ? 'Showing all accounts.'
              : noneShown ? 'No accounts selected — pick one above to see its data.'
              : `Showing ${visibleOptions.filter(isShown).length} of ${visibleOptions.length}.`}
          </p>
        </div>
      )}

      <div style={{ borderTop: '1px solid #eef0f2', paddingTop: '1rem' }} />
      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4338ca', fontWeight: 800 }}>Manage sources</span>
      <p style={{ margin: '0.35rem 0 1rem', fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5 }}>
        Sources are chosen when importing (optional). Rename to update every transaction that uses it; delete moves its transactions to <strong>{DEFAULT_ACCOUNT_BUCKET}</strong> — no data is lost.
      </p>

      {/* Add new */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Add a source, e.g. Robinhood - Roth"
          style={{ flex: 1, padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.88rem' }}
        />
        <button onClick={add} disabled={!newName.trim()} className="ck-btn ck-btn-primary" style={{ whiteSpace: 'nowrap' }}>+ Add</button>
      </div>

      {accounts.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No sources yet. Add one above, or just import — trades go to {DEFAULT_ACCOUNT_BUCKET} by default.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {accounts.map(a => {
          const draft = draftFor(a);
          const changed = draft.trim() && draft.trim() !== a;
          return (
            <div key={a} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', border: '1px solid #eef0f2', borderRadius: 10, background: '#fff' }}>
              <input
                value={draft}
                onChange={e => setDrafts(d => ({ ...d, [a]: e.target.value }))}
                style={{ flex: 1, padding: '0.4rem 0.55rem', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', minWidth: 52, textAlign: 'right' }}>{counts.get(a) || 0} txns</span>
              {changed && (
                <button onClick={() => { onRename(a, draft); setDrafts(d => { const n = { ...d }; delete n[a]; return n; }); }} className="ck-btn ck-btn-sm" title="Save name">💾</button>
              )}
              <button onClick={() => onDelete(a)} className="ck-btn ck-btn-sm" title="Delete source">🗑️</button>
            </div>
          );
        })}
      </div>

      {unassigned > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.5rem 0.65rem', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 10, fontSize: '0.82rem', color: '#6b7280' }}>
          <strong>{DEFAULT_ACCOUNT_BUCKET}</strong> · {unassigned} txns (default bucket for imports with no source)
        </div>
      )}
    </div>
  );
};

/** Compact account label — last segment of "Broker - Owner - Type". */
const shortAccountLabel = (a: string) => {
  if (!a || a === DEFAULT_ACCOUNT_BUCKET) return 'Unassigned';
  const parts = a.split(' - ');
  return parts.length > 1 ? parts[parts.length - 1] : a;
};

const AccountBadges: React.FC<{ accounts: string[] }> = ({ accounts }) => {
  if (!accounts.length) return <span style={{ color: '#9ca3af' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {accounts.map(a => (
        <span key={a} title={a} style={{
          background: a === DEFAULT_ACCOUNT_BUCKET ? '#f3f4f6' : '#eef2ff',
          color: a === DEFAULT_ACCOUNT_BUCKET ? '#6b7280' : '#4338ca',
          borderRadius: 5, padding: '0.05rem 0.4rem', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
        }}>{shortAccountLabel(a)}</span>
      ))}
    </div>
  );
};

const selectStyle: React.CSSProperties = { padding: '0.45rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem', background: '#fff' };
const tickerLinkStyle: React.CSSProperties = { background: 'none', border: 'none', color: '#4338ca', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.82rem' };

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Resolve a preset (or custom inputs) into inclusive ISO date bounds. */
function computeDateBounds(preset: string, customFrom: string, customTo: string): { fromDate: string; toDate: string } {
  const now = new Date();
  switch (preset) {
    case 'ytd': return { fromDate: `${now.getFullYear()}-01-01`, toDate: '' };
    case '12m': {
      const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
      return { fromDate: toISO(d), toDate: '' };
    }
    case '2025': return { fromDate: '2025-01-01', toDate: '' };
    case '2024': return { fromDate: '2024-01-01', toDate: '' };
    case 'custom': return { fromDate: customFrom || '', toDate: customTo || '' };
    default: return { fromDate: '', toDate: '' };
  }
}

const TickerBarTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload as { ticker: string; name?: string; income: number };
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.5rem 0.7rem', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 800, color: '#4338ca' }}>{p.ticker}</div>
      {p.name && <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 2 }}>{p.name}</div>}
      <div style={{ fontSize: '0.85rem', color: p.income < 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>Income: {formatCurrency(p.income)}</div>
    </div>
  );
};

const FilterChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      border: active ? '1px solid #6366f1' : '1px solid #e5e7eb',
      background: active ? '#eef2ff' : '#fff',
      color: active ? '#4338ca' : '#6b7280',
      borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
    }}
  >{children}</button>
);

const ToggleBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    border: 'none', cursor: 'pointer', borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700,
    background: active ? '#fff' : 'transparent', color: active ? '#4338ca' : '#64748b',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
  }}>{children}</button>
);

const NumberRow: React.FC<{ label: string; value: number; color: string; bold?: boolean }> = ({ label, value, color, bold }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0' }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: bold ? 800 : 600, color: '#374151' }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
      {label}
    </span>
    <span style={{ fontSize: '0.95rem', fontWeight: bold ? 800 : 700, color: value < 0 ? '#dc2626' : color }}>{formatCurrency(value)}</span>
  </div>
);

const SummaryCard: React.FC<{ label: string; value: number; accent: string; emphasize?: boolean; onClick?: () => void; valueOverride?: string; hint?: string }> = ({ label, value, accent, emphasize, onClick, valueOverride, hint }) => (
  <div
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    title={hint || (onClick ? 'Click for details' : undefined)}
    style={{
      background: emphasize ? accent : '#fff', color: emphasize ? '#fff' : '#111827',
      border: emphasize ? 'none' : '1px solid #eef0f2', borderRadius: 12, padding: '0.9rem 1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.12s, box-shadow 0.12s',
    }}
    onMouseEnter={onClick ? (e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)'; }) : undefined}
    onMouseLeave={onClick ? (e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }) : undefined}
  >
    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, color: emphasize ? 'rgba(255,255,255,0.85)' : '#9ca3af' }}>{label}</div>
    <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.2rem', color: emphasize ? '#fff' : (valueOverride ? '#9ca3af' : value < 0 ? '#dc2626' : accent) }}>
      {valueOverride ?? formatCurrency(value)}
    </div>
  </div>
);

const MiniStat: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div style={{ background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 10, padding: '0.5rem 0.6rem' }}>
    <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#9ca3af', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: accent || '#1f2937' }}>{value}</div>
  </div>
);

// ── Upcoming event dates (factual: earnings / dividends) ────────────────
function daysFromToday(date: string): number {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}
function fmtEventDate(date: string): string {
  const md = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const n = daysFromToday(date);
  const rel = n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 0 ? `in ${n}d` : `${Math.abs(n)}d ago`;
  return `${md} · ${rel}`;
}
const EVENT_CHIP_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Earnings: { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
  'Ex-dividend': { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  'Dividend pay': { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
};
const EventChip: React.FC<{ ticker?: string; label: string; date: string; estimated?: boolean }> = ({ ticker, label, date, estimated }) => {
  const c = EVENT_CHIP_COLORS[label] || { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      borderRadius: 999, padding: '0.25rem 0.6rem', fontSize: '0.76rem', whiteSpace: 'nowrap',
    }}>
      {ticker && <strong>{ticker}</strong>}
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ opacity: 0.85 }}>{fmtEventDate(date)}</span>
      {estimated && <span style={{ fontSize: '0.66rem', opacity: 0.7 }}>(est)</span>}
    </span>
  );
};

// ── Recent news (context, not advice) — user-triggered per ticker ───────
// Never calls the external API on its own: on open it only reads the session
// cache; fetching fresh headlines is an explicit button click.
const TickerNews: React.FC<{ ticker: string }> = ({ ticker }) => {
  const cached = useMemo(() => peekCachedNews(ticker), [ticker]);
  const [news, setNews] = useState<NewsItem[] | null>(cached ? cached.news : null);
  const [configured, setConfigured] = useState(cached ? cached.configured : true);
  const [loaded, setLoaded] = useState(!!cached);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchTickerNews(ticker);
      setNews(r.news);
      setConfigured(r.configured);
      setLoaded(true);
    } catch (e: any) {
      const m = e?.message || String(e);
      console.error(`[Trades] ✗ news fetch failed for ${ticker}:`, m);
      setError(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #eef0f2', borderRadius: 10, padding: '0.6rem 0.8rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: loaded || error ? '0.5rem' : 0 }}>
        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', fontWeight: 800 }}>📰 Recent news</span>
        <button className="ck-btn" onClick={load} disabled={loading} style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}>
          {loading ? '⏳' : loaded ? '🔄 Refresh' : '📰 Load news'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: '0.8rem', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
          Couldn't load news: {error}
          <div style={{ fontSize: '0.72rem', color: '#9b1c1c', marginTop: '0.2rem' }}>The news API runs on <code>/api</code> (Vercel/prod). See console for details.</div>
        </div>
      )}

      {!error && loaded && !configured && (
        <div style={{ fontSize: '0.8rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
          News isn't configured on the server — add a free <code>FINNHUB_API_KEY</code> to enable it.
        </div>
      )}

      {!error && loaded && configured && news && news.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No recent news for {ticker}.</div>
      )}

      {!error && configured && news && news.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {news.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ fontSize: '0.85rem', color: '#1f2937', fontWeight: 600, lineHeight: 1.4 }}>{n.headline}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                  {n.source || 'News'}{n.datetime ? ` · ${newsRelativeTime(n.datetime)}` : ''}
                </div>
              </a>
            ))}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#c0c4cc', marginTop: '0.5rem' }}>Headlines via Finnhub · context only, not advice</div>
        </>
      )}

      {!loaded && !error && !loading && (
        <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Tap “Load news” to fetch recent headlines for {ticker}.</div>
      )}
    </div>
  );
};

const ChartCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <div style={{ background: '#fff', border: '1px solid #eef0f2', borderRadius: 14, padding: '1rem 1.1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
      <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#374151' }}>{title}</h3>
      {action}
    </div>
    {children}
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
