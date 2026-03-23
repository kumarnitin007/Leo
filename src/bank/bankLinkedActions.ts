/**
 * Derives "action" rows for the Actions tab from Next Action fields on
 * accounts, deposits, and bills (no duplicate persistence).
 */
import type { BankAccount, Bill, Deposit } from "../types/bankRecords";
import { extractDateFromTitle } from "./actionDateParse";

export type LinkedActionSource = "account" | "deposit" | "bill";

export interface LinkedNextActionRow {
  source: LinkedActionSource;
  index: number;
  title: string;
  bank: string;
  note: string;
  /** Best-effort due date for urgency: explicit Excel field, title parse, or deposit maturity */
  date: string;
}

function trimNext(s: string | undefined): string {
  return (s || "").trim();
}

/** Resolve linked-row calendar date: explicit Next Action Due Date > title parse > fallback (e.g. FD maturity). */
function resolveLinkedDate(
  nextDue: string | undefined,
  title: string,
  fallback: string
): string {
  const explicit = trimNext(nextDue);
  if (explicit) return explicit;
  const fromTitle = extractDateFromTitle(title);
  if (fromTitle) return fromTitle;
  return trimNext(fallback);
}

/** Collect non-empty Next Action text from records that are not marked done. */
export function collectLinkedNextActions(
  accounts: BankAccount[],
  deposits: Deposit[],
  bills: Bill[]
): LinkedNextActionRow[] {
  const out: LinkedNextActionRow[] = [];

  accounts.forEach((a, i) => {
    const t = trimNext(a.nextAction);
    if (!t || a.done) return;
    out.push({
      source: "account",
      index: i,
      title: t,
      bank: a.bank || "",
      note: [a.type, a.holders].filter(Boolean).join(" · "),
      date: resolveLinkedDate(a.nextActionDueDate, t, ""),
    });
  });

  deposits.forEach((d, i) => {
    const t = trimNext(d.nextAction);
    if (!t || d.done) return;
    out.push({
      source: "deposit",
      index: i,
      title: t,
      bank: d.bank || "",
      note: [d.type, d.depositId].filter(Boolean).join(" · "),
      date: resolveLinkedDate(d.nextActionDueDate, t, d.maturityDate || ""),
    });
  });

  bills.forEach((b, i) => {
    const t = trimNext(b.nextAction);
    if (!t || b.done) return;
    out.push({
      source: "bill",
      index: i,
      title: t,
      bank: "",
      note: `Bill: ${b.name}`,
      date: resolveLinkedDate(b.nextActionDueDate, t, ""),
    });
  });

  return out;
}
