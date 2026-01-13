export type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'custom' | 'count-based' | 'interval';
export type IntervalUnit = 'days' | 'weeks' | 'months' | 'years';

export interface Tag {
  id: string;
  name: string;
  color: string;
  trackable?: boolean; // If true, tag will be auto-counted in analytics
  description?: string; // Optional description of what this tag tracks
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
}

export interface SafeMasterKey {
  id: string;
  userId: string;
  keyHash: string; // PBKDF2 hash (for verification only)
  salt: string; // Salt for key derivation
  createdAt: string;
  updatedAt: string;
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
  safeTags: SafeTag[];
}

