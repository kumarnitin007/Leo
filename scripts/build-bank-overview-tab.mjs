import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bankDir = join(__dirname, "../src/components/bank");
let body = fs.readFileSync(join(bankDir, "_overview_body.txt"), "utf8");
body = body.replace(
  /\n\s*const total = typeAmounts\.reduce\(\(s, t\) => s \+ Math\.abs\(t\.amount\), 0\);\s*\n\s*\n/,
  "\n"
);

const header = `import React from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
  LabelList,
} from "recharts";
import type {
  Deposit,
  BankAccount,
  Bill,
  ActionItem,
  SavingsGoal,
  Currency,
  TotalValueHistoryEntry,
} from "../../types/bankRecords";
import type { BankDashboardTheme } from "../../bank/bankDashboardTheme";
import type { PortfolioHistoryChartPoint } from "../../bank/bankDashboardTypes";
import { convertCurrency, fmt, fmtDate } from "../../bank/bankDashboardFormat";
import { CURRENCY_SYMBOLS } from "../../bank/bankDashboardConstants";

export type MaturingSoonDepositOverview = {
  type: "maturity";
  title: string;
  bank: string;
  date: string;
  days: number;
  amount?: string;
  currency?: string;
  sourceField: string;
};

export type ActionDue30Overview = {
  type: "action";
  title: string;
  bank: string;
  date: string;
  days: number;
  sourceField: string;
};

export type Upcoming30DayOverviewItem = {
  type: string;
  title: string;
  bank: string;
  date: string;
  days: number;
  amount?: string;
  currency?: string;
};

export type DisplayCurrencyMode = "ORIGINAL" | "INR" | "USD" | "EUR" | "GBP";

export interface BankOverviewTabProps {
  theme: BankDashboardTheme;
  isMobile: boolean;
  deposits: Deposit[];
  accounts: BankAccount[];
  bills: Bill[];
  actions: ActionItem[];
  goals: SavingsGoal[];
  displayCurrency: DisplayCurrencyMode;
  setDisplayCurrency: (c: DisplayCurrencyMode) => void;
  exchangeRates: { USD: number; EUR: number; GBP: number };
  targetCurrency: Currency;
  netWorthConverted: number;
  sumConverted: (items: { amount?: number | string; currency?: Currency }[]) => number;
  totalInvested: number;
  totalMaturity: number;
  maturingSoonDeposits: MaturingSoonDepositOverview[];
  actionsDue30: ActionDue30Overview[];
  upcoming30Days: Upcoming30DayOverviewItem[];
  portfolioHistoryChartData: PortfolioHistoryChartPoint[];
  portfolioHistoryXDomain: [number, number] | undefined;
  portfolioHistoryYDomain: [number, number] | undefined;
  portfolioHistorySnapshotCount: number;
  showPortfolioHistory: boolean;
  setShowPortfolioHistory: React.Dispatch<React.SetStateAction<boolean>>;
  clearPortfolioHistory: () => void;
  deletePortfolioHistoryEntry: (fullDate: string) => void;
  setShowRatesModal: (v: boolean) => void;
  show30Days: boolean;
  setShow30Days: React.Dispatch<React.SetStateAction<boolean>>;
  expandedBanks: Set<string>;
  setExpandedBanks: React.Dispatch<React.SetStateAction<Set<string>>>;
  setTab: (tab: string) => void;
  persist: (
    deps: Deposit[],
    accs: BankAccount[],
    bls: Bill[],
    acts: ActionItem[],
    gls?: SavingsGoal[],
    rates?: { USD: number; EUR: number; GBP: number },
    dispCur?: DisplayCurrencyMode,
    totalValueHist?: TotalValueHistoryEntry[]
  ) => void | Promise<void>;
  totalValueHistory: TotalValueHistoryEntry[];
  toggleDone: (t: string, i: number) => void;
  getBankColor: (bank: string) => string;
}

export function BankOverviewTab({
  theme: THEME,
  isMobile,
  deposits,
  accounts,
  bills,
  actions,
  goals,
  displayCurrency,
  setDisplayCurrency,
  exchangeRates,
  targetCurrency,
  netWorthConverted,
  sumConverted,
  totalInvested,
  totalMaturity,
  maturingSoonDeposits,
  actionsDue30,
  upcoming30Days,
  portfolioHistoryChartData,
  portfolioHistoryXDomain,
  portfolioHistoryYDomain,
  portfolioHistorySnapshotCount,
  showPortfolioHistory,
  setShowPortfolioHistory,
  clearPortfolioHistory,
  deletePortfolioHistoryEntry,
  setShowRatesModal,
  show30Days,
  setShow30Days,
  expandedBanks,
  setExpandedBanks,
  setTab,
  persist,
  totalValueHistory,
  toggleDone,
  getBankColor,
}: BankOverviewTabProps) {
  return (
`;

const footer = `
  );
}
`;

fs.writeFileSync(join(bankDir, "BankOverviewTab.tsx"), header + body + footer, "utf8");
console.log("Wrote BankOverviewTab.tsx");
