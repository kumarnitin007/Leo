/**
 * Group Finance Chat Types
 * Types for the encrypted group messaging feature in Safe section
 */

export type MessageType = 'text' | 'fd' | 'alert' | 'doc';

export interface FDPayload {
  id: string;
  bank: string;
  type: string;
  deposit: number | string;
  maturityDate: string;
  roi: number | string;
  maturityAmt: number | string;
  currency?: string;
}

export interface AlertPayload {
  title: string;
  date: string;
  amount: number;
  bank: string;
  daysLeft: number;
}

export interface DocPayload {
  name: string;
  size: string;
  type: string;
  url?: string;
}

export interface GroupFinanceMessage {
  id: string;
  group_id: string;
  sender_id: string;
  sender_name: string;
  type: MessageType;
  text: string;
  payload?: {
    fd?: FDPayload;
    alert?: AlertPayload;
    doc?: DocPayload;
  };
  created_at: string;
  // Flattened fields for UI convenience
  fd?: FDPayload;
  alert?: AlertPayload;
  doc?: DocPayload;
}

export interface GroupMemberProfile {
  id: string;
  name: string;
  role: 'owner' | 'member' | 'admin';
  avatar: string;
  color: string;
}

export interface GroupFinanceChatProps {
  groupId: string;
  groupName: string;
  groupIcon?: string;
  groupColor?: string;
  currentUser: {
    id: string;
    name: string;
  };
  members: GroupMemberProfile[];
  userDeposits?: FDPayload[];
  onBack: () => void;
}
