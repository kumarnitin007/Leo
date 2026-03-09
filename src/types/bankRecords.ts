/**
 * Bank Records Types
 * 
 * Type definitions for the Financial Dashboard inside Safe section.
 * These types support fixed deposits, savings accounts, bills, and action items.
 * 
 * Design considerations for future sharing:
 * - All records have optional `sharedWith` field for group sharing
 * - Each record type can be shared independently
 * - Encryption handled at the Safe level (uses master password key)
 */

// Supported currencies
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';

// Deposit categories for organization
export type DepositCategory = 
  | 'Emergency Fund'
  | 'Retirement'
  | 'Child Education'
  | 'House/Property'
  | 'Vehicle'
  | 'Wedding'
  | 'Travel'
  | 'General Savings'
  | 'Tax Saving'
  | 'Other';

export interface Deposit {
  bank: string;
  type: string;
  depositId: string;
  nominee: string;
  startDate: string;
  deposit: number | string;
  roi: number | string;
  maturityAmt: number | string;
  maturityDate: string;
  duration: string;
  maturityAction: string;
  done: boolean;
  // New fields
  currency?: Currency;
  category?: DepositCategory;
  tdsPercent?: number | string;  // Tax Deducted at Source %
  autoRenewal?: boolean;
  linkedAccount?: string;  // Account where interest/maturity credits
  documentId?: string;  // Link to Safe Document
  notes?: string;
  // Future: sharing support
  sharedWith?: string[]; // Group IDs that have access
}

export interface BankAccount {
  bank: string;
  type: string;
  holders: string;
  amount: number | string;
  roi: number | string;
  online: string;
  address: string;
  detail: string;
  nextAction: string;
  done: boolean;
  // New fields
  currency?: Currency;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  hidden?: boolean; // Hide from default view, aggregate into "Other Accounts"
  // Future: sharing support
  sharedWith?: string[];
}

export interface Bill {
  name: string;
  freq: string;
  amount: number | string;
  due: string;
  priority: string;
  phone: string;
  email: string;
  done: boolean;
  // New fields
  currency?: Currency;
  category?: string;
  autoPay?: boolean;
  lastPaid?: string;
  // Future: sharing support
  sharedWith?: string[];
}

export interface ActionItem {
  title: string;
  bank: string;
  date: string;
  note: string;
  done: boolean;
  // New fields
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  reminderDays?: number[];  // Days before to remind (e.g., [30, 7, 1])
  // Future: sharing support
  sharedWith?: string[];
}

// Savings Goals
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currency: Currency;
  currentAmount: number;
  deadline?: string;
  category?: DepositCategory;
  linkedDeposits?: string[];  // Deposit IDs contributing to this goal
  color?: string;
  notes?: string;
  createdAt: string;
  done: boolean;
}

// Financial Alert for home page integration
export interface FinancialAlert {
  id: string;
  type: 'maturity' | 'bill_due' | 'action' | 'goal_milestone' | 'low_balance';
  title: string;
  description: string;
  date: string;
  daysUntil: number;
  severity: 'info' | 'warning' | 'urgent';
  relatedId?: string;  // ID of deposit/bill/etc
  currency?: Currency;
  amount?: number;
}

export interface BankRecordsData {
  deposits: Deposit[];
  accounts: BankAccount[];
  bills: Bill[];
  actions: ActionItem[];
  goals?: SavingsGoal[];
  // Currency settings
  exchangeRates?: { USD: number; EUR: number; GBP: number };
  displayCurrency?: 'ORIGINAL' | 'INR' | 'USD' | 'EUR' | 'GBP';
  // Metadata
  updatedAt?: string;
  version?: number; // For future migrations
}

// Pre-loaded sample data for first-time users
export const PRELOAD_BANK_DATA: BankRecordsData = {
  deposits: [
    // ICICI deposits
    {
      bank: "ICICI",
      type: "Fixed Deposit",
      depositId: "157713020941",
      nominee: "Nitin",
      startDate: "2023-01-18",
      deposit: 1159436,
      roi: 0.075,
      maturityAmt: 1445098.0,
      maturityDate: "2028-01-19",
      duration: "60 months 1 day",
      maturityAction: "",
      done: false
    },
    {
      bank: "ICICI",
      type: "Fixed Deposit",
      depositId: "157713020847",
      nominee: "Nitin",
      startDate: "2023-01-11",
      deposit: 1160886,
      roi: 0.075,
      maturityAmt: 1445063.0,
      maturityDate: "2028-01-12",
      duration: "60 months 1 day",
      maturityAction: "",
      done: false
    },
    // Add more sample deposits as needed
  ],
  accounts: [
    {
      bank: "Canara Bank",
      type: "Saving",
      holders: "MRS MEENA KUMAR",
      amount: 100.0,
      roi: "",
      online: "Yes",
      address: "NOIDA(Morna) 18778",
      detail: "cust - 200047216",
      nextAction: "Check Mama DOB",
      done: false
    },
    {
      bank: "ICICI Bank",
      type: "Saving",
      holders: "Mama, Nimesh",
      amount: 300.0,
      roi: 0.03,
      online: "Yes",
      address: "NOIDA Sec 30",
      detail: "a/c - 157701001329",
      nextAction: "",
      done: false
    },
  ],
  bills: [
    {
      name: "Airtel Internet",
      freq: "Monthly",
      amount: "",
      due: "",
      priority: "Normal",
      phone: "9810252747",
      email: "",
      done: false
    },
    {
      name: "Jio Mobile",
      freq: "Monthly",
      amount: "",
      due: "",
      priority: "Normal",
      phone: "xxxxxx2037",
      email: "",
      done: false
    },
    {
      name: "Elec Bill",
      freq: "Monthly",
      amount: 2000.0,
      due: "3rd of month",
      priority: "High",
      phone: "xxxxxx2037",
      email: "rxxxxxxxxxgmail.com",
      done: false
    },
  ],
  actions: [],
  version: 1
};
