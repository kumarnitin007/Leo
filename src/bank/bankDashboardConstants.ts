/**
 * Shared constants and empty record templates for Bank Dashboard.
 */
import type {
  Deposit,
  BankAccount,
  Bill,
  ActionItem,
  SavingsGoal,
  Currency,
  DepositCategory,
} from "../types/bankRecords";

export const MS_PER_DAY = 86400000;

export const URGENCY_THRESHOLDS = {
  CRITICAL: 7,
  WARNING: 30,
  UPCOMING: 90,
} as const;

export const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export const CURRENCY_LOCALES: Record<Currency, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

/** Default FX rates to INR (when user has not saved custom rates) */
export const DEFAULT_RATES = { USD: 83, EUR: 90, GBP: 105 };

export const emptyDeposit: Deposit = {
  bank: "",
  type: "Fixed Deposit",
  depositId: "",
  accountOwner: "",
  nominee: "",
  startDate: "",
  deposit: "",
  roi: "",
  maturityAmt: "",
  maturityDate: "",
  duration: "",
  maturityAction: "",
  nextAction: "",
  done: false,
  currency: "INR",
  category: "General Savings",
  tdsPercent: "",
  autoRenewal: false,
  linkedAccount: "",
  notes: "",
};

export const emptyAccount: BankAccount = {
  bank: "",
  type: "Saving",
  holders: "",
  nominee: "",
  amount: "",
  roi: "",
  online: "Yes",
  address: "",
  detail: "",
  notes: "",
  nextAction: "",
  done: false,
  currency: "INR",
  accountNumber: "",
  ifscCode: "",
  branch: "",
  hidden: false,
};

export const emptyBill: Bill = {
  name: "",
  freq: "Monthly",
  amount: "",
  due: "",
  priority: "Normal",
  phone: "",
  email: "",
  done: false,
  currency: "INR",
  category: "",
  autoPay: false,
  nextAction: "",
};

export const emptyAction: ActionItem = {
  title: "",
  bank: "",
  date: "",
  note: "",
  done: false,
  priority: "Medium",
  reminderDays: [7, 1],
};

export const emptyGoal: SavingsGoal = {
  id: "",
  name: "",
  targetAmount: 0,
  currency: "INR",
  currentAmount: 0,
  deadline: "",
  category: "General Savings",
  linkedDeposits: [],
  color: "#3B82F6",
  notes: "",
  createdAt: "",
  done: false,
};

export const CATEGORIES: DepositCategory[] = [
  "Emergency Fund",
  "Retirement",
  "Child Education",
  "House/Property",
  "Vehicle",
  "Wedding",
  "Travel",
  "General Savings",
  "Tax Saving",
  "Other",
];

export const CURRENCIES: Currency[] = ["INR", "USD", "EUR", "GBP"];
