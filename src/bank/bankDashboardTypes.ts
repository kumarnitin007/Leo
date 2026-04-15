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
