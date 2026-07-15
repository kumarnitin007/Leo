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
  const res = await fetch(`/api/quote?symbols=${encodeURIComponent(uniq.join(','))}`);
  if (!res.ok) throw new Error(`Quote fetch failed (${res.status})`);
  const json = await res.json();
  return { quotes: (json?.quotes || {}) as Record<string, Quote>, asOf: json?.asOf };
}

export async function fetchOptionQuotes(legs: OptionLeg[]): Promise<Record<string, OptionMark>> {
  if (!legs.length) return {};
  const res = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ options: legs }),
  });
  if (!res.ok) throw new Error(`Option quote fetch failed (${res.status})`);
  const json = await res.json();
  return (json?.optionQuotes || {}) as Record<string, OptionMark>;
}
