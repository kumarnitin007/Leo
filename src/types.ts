export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'custom' | 'count-based' | 'interval';
export type IntervalUnit = 'days' | 'weeks' | 'months' | 'years';

export type TagSection = 'tasks' | 'events' | 'journals' | 'items' | 'safe';

export interface Tag {
  id: string;
  name: string;
  color: string;
  trackable?: boolean; // If true, tag will be auto-counted in analytics
  description?: string; // Optional description of what this tag tracks
  
  // Section assignment - which sections can use this tag
  // If null/undefined, tag is available in all sections (backward compatible)
  allowedSections?: TagSection[];
  
  // Safe tag fields (only for safe-only tags)
  isSafeOnly?: boolean; // True = exclusive to safe section
  isSystemCategory?: boolean; // True for system categories (Login, Identity, etc.)
  parentId?: string; // For tree hierarchy - reference to parent tag ID
  
  createdAt: string;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  category?: string; // e.g., "Exercise", "Study", "Self Care", etc.
  tags?: string[]; // Array of tag IDs
  weightage: number; // 1-10, determines screen space
  frequency: FrequencyType;
  customFrequency?: string; // e.g., "1st of every month", "every Monday"
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday (for weekly)
  dayOfMonth?: number; // 1-31 (for monthly)
  frequencyCount?: number; // e.g., 3 for "3 times per week"
  frequencyPeriod?: 'week' | 'month'; // period for count-based frequency
  intervalValue?: number; // e.g., 47 for "every 47 days"
  intervalUnit?: IntervalUnit; // 'days' | 'weeks' | 'months' | 'years'
  intervalStartDate?: string; // YYYY-MM-DD - reference date for interval calculation
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime'; // Time component for routines
  startDate?: string; // YYYY-MM-DD - task won't appear before this date
  endDate?: string; // YYYY-MM-DD - task won't appear after this date
  specificDate?: string; // YYYY-MM-DD - for one-time tasks (when frequency is 'custom')
  color?: string;
  customBackgroundColor?: string; // User-defined background color for the card
  dependentTaskIds?: string[]; // Task IDs that when completed, will auto-complete this task
  onHold?: boolean; // If true, task is paused
  holdStartDate?: string; // YYYY-MM-DD - when hold started
  holdEndDate?: string; // YYYY-MM-DD - when hold will automatically end (optional)
  holdReason?: string; // Optional reason for holding
  endTime?: string; // HH:mm - scheduled end time for task (for timer countdown to end time)
  order?: number; // For custom ordering
  createdAt: string;
}

export interface TaskCompletion {
  taskId: string;
  date: string; // YYYY-MM-DD
  completedAt: string; // ISO timestamp
  durationMinutes?: number; // Optional: how long the task took
  startedAt?: string; // Optional: ISO timestamp when task was started
}

export interface TaskSpillover {
  taskId: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  movedAt: string; // ISO timestamp
}

export type EventFrequencyType = 'yearly' | 'one-time' | 'custom';

export interface Event {
  id: string;
  name: string;
  description?: string;
  category?: string; // e.g., "Birthday", "Anniversary", "Holiday", etc.
  tags?: string[]; // Array of tag IDs
  date: string; // MM-DD format for yearly, YYYY-MM-DD for one-time
  frequency: EventFrequencyType;
  customFrequency?: string; // e.g., "every 5 years"
  year?: number; // For one-time events or tracking age/years
  notifyDaysBefore?: number; // Show on dashboard N days before (default 0 = day of)
  priority?: number; // 1-10, controls display size on dashboard (default 5)
  hideFromDashboard?: boolean; // If true, event won't show on Today dashboard
  color?: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  mood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  tags?: string[]; // Array of tag IDs
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DashboardLayout = 'uniform' | 'grid-spans' | 'masonry';

export interface UserSettings {
  dashboardLayout: DashboardLayout;
  theme?: string;
  notifications?: boolean;
  location?: {
    zipCode?: string;
    city?: string;
    country?: string;
  };
}

export interface Routine {
  id: string;
  name: string;
  description?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  taskIds: string[]; // References to tasks
  isPreDefined: boolean; // true for system templates, false for user-created
  isActive: boolean; // true = active and usable, false = inactive/template
  createdAt: string;
}

export interface EventAcknowledgment {
  eventId: string;
  date: string; // YYYY-MM-DD - the date it was shown/acknowledged
  acknowledgedAt: string; // ISO timestamp
}

export type ItemCategory = 'Gift Card' | 'Subscription' | 'Warranty' | 'Note';

export interface Item {
  id: string;
  name: string;
  description?: string;
  category: ItemCategory;
  tags?: string[]; // Array of tag IDs
  expirationDate?: string; // YYYY-MM-DD - expiration date for gift cards, warranties, subscriptions
  value?: number; // Balance/value for gift cards, cost for subscriptions
  currency?: string; // Currency code (USD, EUR, etc.)
  merchant?: string; // Store/merchant name for gift cards, service name for subscriptions
  accountNumber?: string; // Account number, card number, etc.
  autoRenew?: boolean; // For subscriptions
  notifyDaysBefore?: number; // Show reminder N days before expiration
  priority?: number; // 1-10, for sorting/filtering
  color?: string;
  isClosed?: boolean; // For gift cards - mark as used/closed
  createdAt: string;
  updatedAt?: string;
}

// ===== SAFE SECTION TYPES =====

export interface SafeTag {
  id: string;
  name: string;
  isSystemCategory: boolean; // True for system categories (Login, Identity, etc.)
  isSafeOnly: boolean; // True = hidden from regular tag screens
  color: string;
  createdAt: string;
}

export interface SafeCustomField {
  key: string;
  value: string;
  isEncrypted: boolean;
}

// Encrypted data structure (stored as JSON blob in encrypted_data column)
export interface SafeEntryEncryptedData {
  // Core fields (always encrypted)
  username?: string;
  password?: string;
  notes?: string;
  
  // Custom fields (up to 5)
  customFields?: SafeCustomField[];
  
  // Expiry date (encrypted)
  expiryDate?: string; // YYYY-MM-DD
  
  // Future fields for other categories (all optional, encrypted)
  // Credit Card fields
  cardNumber?: string;
  cvv?: string;
  cardholderName?: string;
  billingAddress?: string;
  pin?: string;
  
  // Bank Account fields
  accountNumber?: string;
  routingNumber?: string;
  bankName?: string;
  accountType?: string; // Checking, Savings, etc.
  swiftCode?: string;
  iban?: string;
  
  // Identity Document fields
  documentNumber?: string; // Passport, SSN, License number
  issueDate?: string; // YYYY-MM-DD
  issueAuthority?: string; // State, Country, Agency
  issueLocation?: string;
  
  // Insurance fields
  policyNumber?: string;
  groupNumber?: string;
  provider?: string;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  
  // Medical fields
  memberId?: string;
  medicalGroupNumber?: string; // Renamed to avoid conflict with Insurance groupNumber
  medicalProvider?: string; // Renamed to avoid conflict with Insurance provider
  planName?: string;
  rxBin?: string;
  rxPCN?: string;
  
  // License/Software fields
  licenseKey?: string;
  productName?: string;
  version?: string;
  vendor?: string;
  
  // API Key fields
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  serviceName?: string;
  
  // WiFi fields
  networkName?: string;
  securityType?: string; // WPA2, WPA3, etc.
  
  // Gift Card fields (if needed in safe section)
  giftCardNumber?: string; // Renamed to avoid conflict with Credit Card cardNumber
  giftCardPin?: string; // Renamed to avoid conflict with Credit Card pin
  balance?: number;
  merchant?: string;
  
  // Stock Trading Account fields
  brokerName?: string;
  tradingPlatform?: string;
  tradingAccountType?: string; // Individual, Joint, IRA, etc. (renamed to avoid conflict)
  accountHolder?: string;
  
  // TOTP (2FA) fields
  totpSecret?: string; // Base32 encoded secret
  totpIssuer?: string; // Service name (e.g., "Gmail")
  totpAccount?: string; // Account identifier (e.g., "user@example.com")
}

export interface SafeEntry {
  id: string;
  title: string; // Plaintext (for search)
  url?: string; // Plaintext (for search)
  categoryTagId?: string; // Reference to safe category tag
  tags?: string[]; // Array of tag IDs (plaintext)
  isFavorite: boolean;
  expiresAt?: string; // YYYY-MM-DD (plaintext for filtering)
  encryptedData: string; // Encrypted JSON blob (SafeEntryEncryptedData)
  encryptedDataIv: string; // IV for decryption
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  // Sharing fields (for entries shared with current user)
  isShared?: boolean;
  sharedBy?: string; // Display name of the person who shared
  sharedAt?: string;
}

export interface SafeMasterKey {
  id: string;
  userId: string;
  keyHash: string; // PBKDF2 hash (for verification only)
  salt: string; // Salt for key derivation
  createdAt: string;
  updatedAt: string;
}

// ===== DOCUMENT VAULT TYPES =====

export type DocumentProvider = 'google' | 'onedrive' | 'dropbox';
export type DocumentType = 'invoice' | 'contract' | 'identity' | 'insurance' | 'medical' | 'tax' | 'warranty' | 'license' | 'other';

export interface DocumentVaultEncryptedData {
  // File reference (encrypted) - provider-specific ID or URL
  fileReference: string;
  
  // Notes (encrypted) - 4-5 lines max
  notes?: string;
  
  // Priority (encrypted)
  priority?: number; // 1-10
  
  // Expiry date (encrypted)
  expiryDate?: string; // YYYY-MM-DD
}

export interface DocumentVault {
  id: string;
  title: string; // Plaintext (for search)
  provider: DocumentProvider; // google | onedrive | dropbox (plaintext)
  documentType: DocumentType; // invoice, contract, identity, etc.
  tags?: string[]; // Array of tag IDs (plaintext)
  issueDate?: string; // YYYY-MM-DD (plaintext)
  expiryDate?: string; // YYYY-MM-DD (plaintext for filtering)
  isFavorite: boolean;
  encryptedData: string; // Encrypted JSON blob (DocumentVaultEncryptedData)
  encryptedDataIv: string; // IV for decryption
  createdAt: string;
  updatedAt: string;
}

export type ProgressMetricType = 'count' | 'percentage' | 'milestone' | 'binary';

export interface ResolutionMilestone {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  targetValue?: number; // For count/percentage metrics
  completed: boolean;
  completedAt?: string; // ISO timestamp
}

export interface Resolution {
  id: string;
  title: string;
  description?: string;
  category?: string; // e.g., "Health", "Career", "Personal", "Financial", "Relationships"
  tags?: string[]; // Array of tag IDs
  targetYear: number; // e.g., 2026
  startDate: string; // YYYY-MM-DD (when the resolution starts, usually Jan 1)
  endDate?: string; // YYYY-MM-DD (when the resolution ends, usually Dec 31)
  progressMetric: ProgressMetricType;
  targetValue?: number; // For count or percentage metrics (e.g., target 52 for weekly habit, 90 for percentage)
  currentValue?: number; // Current progress (count or percentage)
  milestones?: ResolutionMilestone[]; // Optional interim milestones
  linkedTaskIds?: string[]; // References to tasks that help achieve this resolution
  priority?: number; // 1-10, for display and sorting
  color?: string;
  status: 'active' | 'paused' | 'abandoned' | 'completed'; // Status of resolution
  createdAt: string;
  updatedAt?: string;
}

export interface AppData {
  tasks: Task[];
  completions: TaskCompletion[];
  spillovers: TaskSpillover[];
  events: Event[];
  eventAcknowledgments: EventAcknowledgment[];
  tags: Tag[];
  journalEntries: JournalEntry[];
  routines: Routine[];
  items: Item[];
  safeEntries: SafeEntry[];
  safeTags: Tag[];
  resolutions?: Resolution[];
}

// ===== REFERENCE CALENDARS TYPES =====

export interface LunarCalendarMetadata {
  tithi?: string; // e.g., "Purnima", "Amavasya"
  paksha?: string; // "Shukla" (waxing) or "Krishna" (waning)
  masa?: string; // Lunar month (e.g., "Phalguna", "Chaitra")
  tithiStart?: string; // ISO timestamp
  tithiEnd?: string; // ISO timestamp
  nakshatra?: string; // Lunar mansion
  yoga?: string; // Yoga (auspicious combination)
  karana?: string; // Half of a tithi
  source?: string; // e.g., "Drik Panchang"
}

export interface RegionalVariation {
  state?: string; // State code
  region?: string; // Region name
  country?: string; // Country code
  custom?: string; // Description of local custom
}

export interface DayURLs {
  info?: string;
  wiki?: string;
  source?: string;
  [key: string]: string | undefined;
}

export interface ReferenceDay {
  id: string; // Deterministic key: e.g., "IN-2026-01-26", "GLOBAL-07-18"
  date: string; // YYYY-MM-DD
  year?: number;
  month: number; // 1-12
  dayOfMonth: number; // 1-31
  
  // Calendar system
  calendarSystem: 'gregorian' | 'lunar' | 'solar' | 'combined'; // Default: 'gregorian'
  
  // Geographic/cultural anchor
  anchorType?: 'country' | 'region' | 'global' | 'religious';
  anchorKey?: string; // e.g., 'IN', 'US', 'HINDU', 'GLOBAL'
  
  // Event information
  eventName: string;
  eventDescription?: string;
  eventCategory: 'holiday' | 'festival' | 'observance' | 'birthday' | 'earnings' | 'economic' | 'religious' | 'cultural';
  eventType: 'fixed' | 'lunar' | 'solar' | 'moveable';
  
  // Importance and significance
  importanceLevel: number; // 1-100 scale
  significance?: string;
  mythology?: string[]; // e.g., ["Holika Dahan", "Devotion of Prahlada"]
  
  // Lunar metadata (for religious/lunar calendars)
  lunarMetadata?: LunarCalendarMetadata;
  
  // Regional variations
  regionalVariations?: RegionalVariation[];
  
  // Local customs
  localCustoms?: string[];
  
  // Observance rules
  isPublicHoliday?: boolean;
  isBankHoliday?: boolean;
  isSchoolHoliday?: boolean;
  observanceRule?: string; // e.g., "If Saturday → Friday; If Sunday → Monday"
  
  // Visual metadata
  primaryColor?: string; // Hex color
  mood?: string; // e.g., 'celebratory', 'solemn', 'joyful'
  icon?: string; // e.g., 'colors', 'fireworks', 'lights'
  
  // Media
  imageUrl?: string;
  audioUrl?: string;
  
  // Metadata
  source?: string; // Data source
  sourceConfidence?: 'confirmed' | 'estimated' | 'religious-calendar';
  urls?: DayURLs;
  tags?: string[]; // e.g., ['spring', 'colors', 'joy']
  
  // Audit
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceCalendar {
  id: string; // e.g., 'india-national-holidays', 'us-federal-holidays'
  name: string;
  description?: string;
  
  // Classification
  domain: 'holiday' | 'festival' | 'religious' | 'financial' | 'observance';
  calendarType: 'reference' | 'user-created';
  
  // Geographic/cultural scope
  geography?: string; // e.g., 'IN', 'US', 'JP', 'GLOBAL'
  religion?: string; // e.g., 'Hindu', 'Islamic'
  
  // Configuration
  isPreloaded: boolean;
  isUserEditable: boolean;
  version?: string; // e.g., '2026', '2026-2027'
  
  // UI metadata
  color?: string;
  icon?: string;
  source?: string;
  documentationUrl?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
}

export interface CalendarDay {
  calendarId: string;
  dayId: string;
  sequenceOrder?: number;
  calendarSpecificMetadata?: Record<string, unknown>;
  createdAt: string;
}

export interface UserReferenceCalendar {
  id: string;
  user_id: string;
  calendar_id: string;
  
  // Configuration
  is_enabled: boolean;
  show_in_dashboard: boolean;
  
  // User preferences
  color_override?: string;
  notification_enabled: boolean;
  
  // Audit
  created_at: string;
  updated_at: string;
}

export interface DayAssociation {
  dayId: string;
  calendarCount: number;
  calendarIds: string[];
  isDuplicate: boolean;
  duplicateOf?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserVisibleDay extends ReferenceDay {
  calendarCount: number;
  calendarNames: string[];
}

// ===== TO-DO LIST TYPES =====

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TodoGroup {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  order: number;
  isExpanded?: boolean; // UI state for collapsed/expanded
  createdAt: string;
  updatedAt: string;
}

export interface TodoItem {
  id: string;
  text: string;
  groupId?: string; // null = ungrouped
  isCompleted: boolean;
  completedAt?: string; // ISO timestamp
  priority?: TodoPriority;
  dueDate?: string; // YYYY-MM-DD
  notes?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ===== SHARING SYSTEM TYPES =====

export type GroupMemberRole = 'owner' | 'admin' | 'member';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type ShareMode = 'readonly' | 'copy'; // copy = can copy to local DB; readonly = view only

export interface SharingGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  createdBy: string; // user_id
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  displayName?: string;
  joinedAt: string;
  // Extended fields from joins
  userEmail?: string;
  userAvatar?: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  invitedBy: string; // user_id
  invitedUserId?: string; // For existing users
  invitedEmail?: string; // For non-users
  status: InvitationStatus;
  message?: string;
  expiresAt?: string;
  createdAt: string;
  respondedAt?: string;
  // Extended fields from joins
  groupName?: string;
  inviterName?: string;
}

export interface SharedSafeEntry {
  id: string;
  safeEntryId: string;
  groupId: string;
  sharedBy: string; // user_id
  shareMode: ShareMode;
  sharedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  isActive: boolean;
  // Extended fields from joins
  entryTitle?: string;
  groupName?: string;
  sharedByName?: string;
}

export interface SharedDocument {
  id: string;
  documentId: string;
  groupId: string;
  sharedBy: string;
  shareMode: ShareMode;
  sharedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  isActive: boolean;
  // Extended fields
  documentTitle?: string;
  groupName?: string;
  sharedByName?: string;
}

export interface EntryCopy {
  id: string;
  originalEntryId: string;
  originalOwnerId: string;
  copiedEntryId: string;
  copiedBy: string;
  entryType: 'safe_entry' | 'document';
  copiedAt: string;
}

// Extended type for viewing shared entries with full details
export interface SharedEntryView extends SharedSafeEntry {
  entry?: SafeEntry; // The actual entry data (decrypted on client)
}

export interface SharedDocumentView extends SharedDocument {
  document?: DocumentVault; // The actual document data
}

// ===== USER LEVEL/TIER SYSTEM =====

export type UserLevelId = 'free' | 'basic' | 'pro' | 'premium';

export interface UserLevel {
  id: UserLevelId;
  name: string;
  displayName: string;
  description?: string;
  tierOrder: number;
  color: string;
  icon: string;
  monthlyPrice: number;
  yearlyPrice: number;
  isDefault: boolean;
}

export interface AppFeature {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: 'core' | 'safe' | 'sharing' | 'calendars' | 'voice' | 'analytics' | 'ai';
}

export interface LevelFeature {
  levelId: UserLevelId;
  featureId: string;
  isEnabled: boolean;
  limitValue?: number | null; // null = unlimited
}

export interface UserLevelAssignment {
  id: string;
  userId: string;
  levelId: UserLevelId;
  assignedAt: string;
  expiresAt?: string;
  assignedBy?: string;
  notes?: string;
  subscriptionId?: string;
  isActive: boolean;
}

// User's effective level with all features
export interface UserEffectiveLevel {
  level: UserLevel;
  features: Map<string, { enabled: boolean; limit?: number | null }>;
  expiresAt?: string;
}
