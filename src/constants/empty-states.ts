/**
 * Empty State Configurations
 * 
 * Centralized configurations for empty states throughout the app.
 * Use with the EmptyState component for consistent, actionable empty states.
 * 
 * Usage:
 * ```tsx
 * import { EMPTY_STATES } from '../constants/empty-states';
 * import { EmptyState } from '../components/ui';
 * 
 * <EmptyState {...EMPTY_STATES.tasks} action={{ label: 'Create Task', onClick: handleCreate }} />
 * ```
 */

export interface EmptyStateConfig {
  icon: string;
  title: string;
  description: string;
}

export const EMPTY_STATES: Record<string, EmptyStateConfig> = {
  // Tasks & Events
  tasks: {
    icon: '📋',
    title: 'No tasks yet',
    description: 'Create your first task to start organizing your day',
  },
  events: {
    icon: '📅',
    title: 'No events yet',
    description: 'Add events to keep track of important dates and appointments',
  },
  todayEmpty: {
    icon: '🌤️',
    title: 'Nothing scheduled for today',
    description: 'Enjoy your free day or create a new task to stay productive',
  },
  
  // Safe
  safeEntries: {
    icon: '🔐',
    title: 'No entries yet',
    description: 'Store passwords, notes, and sensitive information securely',
  },
  safeDocuments: {
    icon: '📄',
    title: 'No documents yet',
    description: 'Upload important documents like IDs, certificates, and contracts',
  },
  
  // Bank Dashboard
  bankAccounts: {
    icon: '🏦',
    title: 'No accounts tracked',
    description: 'Add your bank accounts to monitor balances and track spending',
  },
  bankDeposits: {
    icon: '💰',
    title: 'No deposits found',
    description: 'Track fixed deposits to monitor maturity dates and interest',
  },
  bankBills: {
    icon: '📑',
    title: 'No bills tracked',
    description: 'Add recurring bills to never miss a payment deadline',
  },
  bankActions: {
    icon: '✅',
    title: 'No action items',
    description: 'Action items will appear when deposits mature or bills are due',
  },
  
  // Groups & Sharing
  groups: {
    icon: '👥',
    title: 'No groups yet',
    description: 'Create a group to share passwords and documents with family or team',
  },
  groupMessages: {
    icon: '💬',
    title: 'No messages yet',
    description: 'Start the conversation by sending a message',
  },
  sharedEntries: {
    icon: '🔗',
    title: 'Nothing shared with you',
    description: 'Shared passwords and documents will appear here',
  },
  
  // Journal & Notes
  journal: {
    icon: '📝',
    title: 'No journal entries',
    description: 'Start journaling to capture thoughts, memories, and reflections',
  },
  
  // Items & Lists
  items: {
    icon: '📦',
    title: 'No items yet',
    description: 'Track inventory, collections, or any items you want to organize',
  },
  
  // Search & Filters
  searchNoResults: {
    icon: '🔍',
    title: 'No results found',
    description: 'Try adjusting your search terms or filters',
  },
  filterNoResults: {
    icon: '🎯',
    title: 'No matches',
    description: 'No items match your current filters. Try broadening your criteria',
  },
  
  // Voice Commands
  voiceHistory: {
    icon: '🎤',
    title: 'No voice commands yet',
    description: 'Use voice commands to quickly add tasks and events',
  },
  
  // Comments
  comments: {
    icon: '💭',
    title: 'No comments yet',
    description: 'Be the first to add a comment',
  },
  
  // Calendar
  calendars: {
    icon: '📆',
    title: 'No calendars found',
    description: 'Import or create calendars to see events and observances',
  },
  
  // Timer
  timerNoTasks: {
    icon: '⏱️',
    title: 'No tasks available',
    description: 'Create tasks with time estimates to use the timer feature',
  },
  
  // Resolutions
  resolutions: {
    icon: '🎯',
    title: 'No resolutions yet',
    description: 'Set goals and track your progress throughout the year',
  },
  
  // Tags
  tags: {
    icon: '🏷️',
    title: 'No tags available',
    description: 'Create tags in Settings to organize and filter your content',
  },
  
  // Generic
  generic: {
    icon: '📭',
    title: 'Nothing here yet',
    description: 'Content will appear here once you add some items',
  },
};

export default EMPTY_STATES;
