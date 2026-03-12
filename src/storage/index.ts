/**
 * Storage Module Index
 * 
 * Re-exports all storage functions from individual modules.
 * This allows gradual migration from monolithic storage.ts
 * 
 * Usage: 
 *   import { getTasks, addTask } from './storage';      // Old path (still works)
 *   import { getTasks, addTask } from './storage/';     // New modular path
 */

// Core utilities
export {
  generateUUID,
  VoiceFields,
  mapVoiceFieldsToDb,
  mapVoiceFields,
  pendingRequests,
  getCacheKey,
  isCacheValid,
  setCache,
  getCache,
  clearDashboardCache,
  AuthContext,
  requireAuth
} from './core';

// Tasks module
export {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask,
  getCompletions,
  getTaskHistory
} from './tasks';

// Events module
export {
  getEvents,
  addEvent,
  updateEvent,
  deleteEvent
} from './events';

// Items module
export {
  getItems,
  addItem,
  updateItem,
  deleteItem,
  getExpiringItems
} from './items';

// Journal module
export {
  getJournalEntries,
  saveJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  getJournalEntryByDate
} from './journal';

// Routines module
export {
  getRoutines,
  saveRoutine,
  deleteRoutine,
  addRoutine,
  updateRoutine,
  initializeDefaultRoutines
} from './routines';

// Tags module
export {
  getTags,
  getTagsForSection,
  saveTag,
  deleteTag,
  addTag,
  updateTag
} from './tags';

// Settings module
export {
  loadUserSettings,
  saveUserSettings,
  getUserSettings,
  getUserSettingsSync,
  getDashboardLayout,
  setDashboardLayout,
  saveDashboardLayout,
  isFirstTimeUser,
  markOnboardingComplete,
  saveTaskOrder,
  loadTaskOrder
} from './settings';

// Dashboard module
export {
  loadData,
  loadDashboardData,
  getCompletionsForDateRange,
  isTaskCompletedToday,
  getTaskSpilloversForDate,
  moveTaskToNextDay,
  getCompletionCountForPeriod
} from './dashboard';
