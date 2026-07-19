/**
 * Client for the /api/quote proxy (keyless Yahoo Finance).
 * Returns current prices for the given symbols; missing symbols are omitted.
 */

export interface Quote {
  symbol: string;
  price: number;
  previousClose?: number;
  change?: number;
  changePct?: number;
  currency?: string;
  /** How the price was obtained: 'api' (market data) or 'manual' (user-entered). */
  source?: 'api' | 'manual';
}

export interface OptionLeg {
  symbol: string;
  expiration: string;   // YYYY-MM-DD
  optionType: 'CALL' | 'PUT';
  strike: number;
}

export interface OptionMark {
  mark: number;         // price per share (mid, else last)
  last?: number;
  bid?: number;
  ask?: number;
}

/** Stable key shared with the server: SYMBOL|OPTIONTYPE|STRIKE|EXPIRATION */
export function optionLegKey(symbol: string, optionType: string, strike: number, expiration: string): string {
  return `${symbol.toUpperCase()}|${optionType.toUpperCase()}|${strike}|${expiration}`;
}

export async function fetchQuotes(symbols: string[]): Promise<{ quotes: Record<string, Quote>; asOf?: string }> {
  const uniq = Array.from(new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean)));
  if (uniq.length === 0) return { quotes: {} };
  console.log(`[Quotes] → GET /api/quote for ${uniq.length} symbol(s):`, uniq.join(', '));
  const res = await fetch(`/api/quote?symbols=${encodeURIComponent(uniq.join(','))}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[Quotes] ✗ stock fetch failed (${res.status})`, body.slice(0, 300));
    throw new Error(`Quote fetch failed (${res.status})`);
  }
  const json = await res.json();
  const quotes = (json?.quotes || {}) as Record<string, Quote>;
  const got = Object.keys(quotes);
  const missing = uniq.filter(s => !got.includes(s));
  console.log(`[Quotes] ✓ ${got.length}/${uniq.length} priced${missing.length ? ` · no price for: ${missing.join(', ')}` : ''}`);
  return { quotes, asOf: json?.asOf };
}

export async function fetchOptionQuotes(legs: OptionLeg[]): Promise<Record<string, OptionMark>> {
  if (!legs.length) return {};
  console.log(`[Quotes] → POST /api/quote for ${legs.length} option leg(s):`, legs.map(l => `${l.symbol} ${l.optionType} $${l.strike} ${l.expiration}`).join(' | '));
  const res = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ options: legs }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[Quotes] ✗ option fetch failed (${res.status})`, body.slice(0, 300));
    throw new Error(`Option quote fetch failed (${res.status})`);
  }
  const json = await res.json();
  const marks = (json?.optionQuotes || {}) as Record<string, OptionMark>;
  const n = Object.keys(marks).length;
  console.log(`[Quotes] ✓ ${n}/${legs.length} option marks returned${n < legs.length ? ' (unmatched legs: illiquid, or Yahoo has no chain for that expiration/strike)' : ''}`);
  if (n > 0) console.log('[Quotes]   marks:', marks);
  return marks;
}
