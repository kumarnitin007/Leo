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
  | 'prescription';

export interface ExtractedItem {
  id: string;
  type: ExtractedItemType;
  confidence: number; // 0-1
  title: string;
  description?: string;
  data: Record<string, any>; // Type-specific data
  suggestedDestination: 'event' | 'task' | 'todo' | 'journal' | 'safe' | 'gift-card' | 'resolution';
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

export interface ScanResult {
  success: boolean;
  mode: ScanMode;
  items: ExtractedItem[];
  rawText?: string;
  error?: string;
  processingTime?: number;
}
