/**
 * Formatting, FX conversion, and bank-color helpers for Bank Dashboard.
 */
import type { BankAccount, Currency } from "../types/bankRecords";
import {
  MS_PER_DAY,
  CURRENCY_SYMBOLS,
  CURRENCY_LOCALES,
} from "./bankDashboardConstants";

const PALETTE = [
  "#F97316",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#06B6D4",
  "#EF4444",
  "#84CC16",
  "#A78BFA",
  "#FB923C",
  "#34D399",
];

const bankColorMap: Record<string, string> = {};

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / MS_PER_DAY);
}

export function daysSinceUpdated(isoOrDate: string | null | undefined): number | null {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / MS_PER_DAY);
}

export function accountNotesDetail(a: BankAccount): string {
  return [a.notes, a.detail].filter(Boolean).join("\n\n").trim();
}

export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rates: { USD: number; EUR: number; GBP: number }
): number {
  const validFrom: Currency =
    fromCurrency && CURRENCY_SYMBOLS[fromCurrency] ? fromCurrency : "INR";
  const validTo: Currency =
    toCurrency && CURRENCY_SYMBOLS[toCurrency] ? toCurrency : "INR";

  if (validFrom === validTo) return amount;

  let inrAmount = amount;
  if (validFrom !== "INR") {
    inrAmount = amount * (rates[validFrom as keyof typeof rates] || 1);
  }

  if (validTo === "INR") return inrAmount;
  return inrAmount / (rates[validTo as keyof typeof rates] || 1);
}

export function fmt(
  n: number | string | null | undefined,
  currency: Currency = "INR"
): string {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const validCurrency: Currency =
    currency && CURRENCY_SYMBOLS[currency] ? currency : "INR";
  const sym = CURRENCY_SYMBOLS[validCurrency];

  if (validCurrency === "INR") {
    if (abs >= 10000000) return sign + sym + (abs / 10000000).toFixed(2) + " Cr";
    if (abs >= 100000) return sign + sym + (abs / 100000).toFixed(2) + " L";
    if (abs >= 1000) return sign + sym + (abs / 1000).toFixed(2) + " K";
  } else {
    if (abs >= 1000000000) return sign + sym + (abs / 1000000000).toFixed(2) + "B";
    if (abs >= 1000000) return sign + sym + (abs / 1000000).toFixed(2) + "M";
    if (abs >= 1000) return sign + sym + (abs / 1000).toFixed(1) + "K";
  }
  return (
    sign +
    sym +
    abs.toLocaleString(CURRENCY_LOCALES[validCurrency], { maximumFractionDigits: 2 })
  );
}

export function fmtFull(
  n: number | string | null | undefined,
  currency: Currency = "INR"
): string {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const validCurrency: Currency =
    currency && CURRENCY_SYMBOLS[currency] ? currency : "INR";
  return (
    sign +
    CURRENCY_SYMBOLS[validCurrency] +
    abs.toLocaleString(CURRENCY_LOCALES[validCurrency], { maximumFractionDigits: 2 })
  );
}

export function fmtDate(str: string | null | undefined): string {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getBankColor(bank: string): string {
  if (!bank) return "#6B7280";
  if (!bankColorMap[bank])
    bankColorMap[bank] = PALETTE[Object.keys(bankColorMap).length % PALETTE.length];
  return bankColorMap[bank];
}

export function getDefaultDisplayCurrency():
  | "ORIGINAL"
  | "INR"
  | "USD"
  | "EUR"
  | "GBP" {
  try {
    const lang = typeof navigator !== "undefined" ? navigator.language : "";
    const tz =
      typeof Intl !== "undefined" && Intl.DateTimeFormat
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "";
    if (lang.startsWith("en-IN") || tz.includes("Kolkata") || tz.includes("India"))
      return "INR";
    if (
      lang.startsWith("en-US") ||
      lang.startsWith("en-GB") ||
      tz.startsWith("America/") ||
      tz.startsWith("Europe/London")
    )
      return "USD";
    if (tz.startsWith("Europe/") && !tz.includes("London")) return "EUR";
    return "USD";
  } catch {
    return "USD";
  }
}
