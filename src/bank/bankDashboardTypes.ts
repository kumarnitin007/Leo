export type DisplayCurrencyMode = "ORIGINAL" | "INR" | "USD" | "EUR" | "GBP";

/** Single timeline for Overview “Next 30 days”: maturities, manual actions, linked next-actions (sorted by days). */
export type Next30DayRow =
  | {
      kind: "maturity";
      title: string;
      bank: string;
      date: string;
      days: number;
      amount?: string;
      currency?: string;
      sourceField: string;
      actionLabel?: string;
      rowType?: string;
      descriptiveLabel?: string;
      amountFormatted?: string;
    }
  | {
      kind: "manual";
      title: string;
      bank: string;
      date: string;
      days: number;
      sourceField: string;
      actionLabel?: string;
      rowType?: string;
      descriptiveLabel?: string;
      amountFormatted?: string;
    }
  | {
      kind: "linked";
      title: string;
      bank: string;
      date: string;
      days: number;
      sourceField: string;
      linkedSource: "account" | "deposit" | "bill";
      actionLabel?: string;
      rowType?: string;
      descriptiveLabel?: string;
      amountFormatted?: string;
    };

/** Portfolio-over-time chart row (real snapshot or synthetic "today" carry-forward) */
export type PortfolioHistoryChartPoint = {
  timestamp: number;
  dateLabel: string;
  fullDate: string;
  totalAccountValue: number;
  totalDepositValue: number;
  source?: string;
  isProjected?: boolean;
  /** Per-type breakdowns (may be absent for old entries) */
  accountsByType?: Record<string, number>;
};
