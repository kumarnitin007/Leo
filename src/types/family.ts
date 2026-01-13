/**
 * Family Feature Types
 * 
 * Types for family accounts, invitations, task assignments, and sharing
 */

export interface Family {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  // Extended with user details
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface FamilyInvitation {
  id: string;
  familyId: string;
  invitedBy: string;
  invitedEmail: string;
  invitedUserId?: string;
  status: InvitationStatus;
  message?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  // Extended with details
  familyName?: string;
  inviterEmail?: string;
}

export type TaskAssignmentStatus = 'pending' | 'accepted' | 'rejected' | 'completed';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskAssignment {
  id: string;
  taskId: string;
  assignedBy: string;
  assignedTo: string;
  familyId: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskAssignmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Extended with details
  taskName?: string;
  assignerEmail?: string;
  assigneeEmail?: string;
}

export type SharePermission = 'view' | 'edit';

export interface SharedTask {
  id: string;
  taskId: string;
  sharedBy: string;
  sharedWith?: string;
  familyId: string;
  permission: SharePermission;
  createdAt: string;
  // Extended with details
  taskName?: string;
  sharerEmail?: string;
}

export type NotificationType = 
  | 'invitation' 
  | 'task_assigned' 
  | 'task_shared' 
  | 'task_completed' 
  | 'family_update';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  data?: any;
  createdAt: string;
}

export interface FamilyData {
  family: Family;
  members: FamilyMember[];
  myRole: 'admin' | 'member';
}

export interface InvitationSummary {
  pending: FamilyInvitation[];
  sent: FamilyInvitation[];
  expired: FamilyInvitation[];
}


