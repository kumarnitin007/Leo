/**
 * Image Scanning Types
 * 
 * Shared types for image scanning and AI extraction
 */

export type ScanMode = 'quick' | 'smart';

export type ExtractedItemType = 
  | 'birthday'
  | 'invitation'
  | 'todo'
  | 'receipt'
  | 'gift-card'
  | 'meeting-notes'
  | 'workout-plan'
  | 'prescription'
  | 'financial-screenshot';

export interface ExtractedItem {
  id: string;
  type: ExtractedItemType;
  confidence: number; // 0-1
  title: string;
  description?: string;
  data: Record<string, any>; // Type-specific data
  suggestedDestination: 'event' | 'task' | 'todo' | 'journal' | 'safe' | 'gift-card' | 'resolution' | 'financial-import';
  icon: string;
}

// Type-specific data structures
export interface BirthdayData {
  personName: string;
  date: string; // YYYY-MM-DD
  age?: number;
  message?: string;
  recurring: boolean;
}

export interface InvitationData {
  eventName: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  location?: string;
  host?: string;
  rsvpInfo?: string;
}

export interface TodoData {
  items: string[];
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

export interface ReceiptData {
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  items?: Array<{ name: string; price: number }>;
  category?: string;
}

export interface GiftCardData {
  brand: string;
  amount: number;
  currency: string;
  code?: string;
  expiryDate?: string;
  pin?: string;
}

export interface MeetingNotesData {
  meetingTitle?: string;
  date?: string;
  attendees?: string[];
  actionItems: string[];
  notes?: string;
}

export interface WorkoutPlanData {
  goalName: string;
  targetValue?: number;
  targetUnit?: string;
  startDate?: string;
  endDate?: string;
  exercises?: string[];
}

export interface PrescriptionData {
  medicineName: string;
  dosage: string;
  frequency: string;
  prescribedBy?: string;
  date?: string;
  refills?: number;
  warnings?: string[];
}

export interface FinancialScreenshotData {
  source: 'robinhood' | 'fidelity' | 'schwab' | 'vanguard' | 'etrade' | 'zerodha' | 'groww' | 'coinbase' | 'sofi' | 'chase' | 'unknown';
  accounts: Array<{
    name: string;
    type: 'brokerage' | 'retirement' | 'savings' | 'checking' | 'crypto' | 'loan' | 'other';
    balance: number;
    currency: string;
    holdings?: Array<{
      symbol?: string;
      name: string;
      quantity?: number;
      value: number;
      change?: number;
      changePercent?: number;
    }>;
  }>;
  totalValue?: number;
  screenshotDate: string;
  confidence: number;
}

export interface PendingFinancialImport {
  id: string;
  createdAt: string;
  imageBase64?: string;
  extractedData: FinancialScreenshotData;
  status: 'pending' | 'approved' | 'dismissed';
  approvedAt?: string;
  matchedAccounts?: Array<{
    extractedName: string;
    matchedBankIndex?: number;
    matchedDepositIndex?: number;
    action: 'update' | 'create' | 'skip';
    newValue?: number;
    oldValue?: number;
  }>;
}

export interface ScanResult {
  success: boolean;
  mode: ScanMode;
  items: ExtractedItem[];
  rawText?: string;
  error?: string;
  processingTime?: number;
}
