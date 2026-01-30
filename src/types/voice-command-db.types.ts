/**
 * Types for the voice command database tables (myday_voice_command_logs)
 * Generated from VOICE_COMMAND_TRAINING_DATA_AND_SCHEMA.md
 */

/**
 * Allowed intent types detected by the system.
 */
export type IntentType =
  | 'CREATE_TASK'
  | 'CREATE_EVENT'
  | 'CREATE_ITEM'
  | 'CREATE_JOURNAL'
  | 'CREATE_ROUTINE'
  | 'CREATE_TAG'
  | 'CREATE_MILESTONE'
  | 'UPDATE_TASK'
  | 'UPDATE_EVENT'
  | 'DELETE_TASK'
  | 'DELETE_EVENT'
  | 'QUERY_TASK'
  | 'QUERY_EVENT'
  | 'UNKNOWN'
  | 'MULTIPLE';

/**
 * High-level entity types extracted from an utterance.
 */
export type EntityType = 'TASK' | 'EVENT' | 'JOURNAL' | 'ROUTINE' | 'ITEM' | 'TAG' | 'MILESTONE' | 'NEEDS_USER_INPUT';

/**
 * Priority levels recognized by the system.
 */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Outcome of attempting to execute a voice command.
 */
export type Outcome = 'PENDING' | 'SUCCESS' | 'CANCELLED' | 'FAILED' | 'UNDONE';

/**
 * Method used to determine intent classification.
 */
export type IntentMethod = 'RULES' | 'AI' | 'HYBRID';

/**
 * Single extracted entity item from the `entities` JSONB column.
 */
export interface Entity {
  /** High-level entity type (TASK, EVENT, etc.) */
  type: EntityType;
  /** Raw value as extracted from the transcript */
  value: string;
  /** Normalized value (iso date, normalized time, canonical title, etc.) */
  normalizedValue?: string;
  /** Confidence score between 0 and 1 */
  confidence?: number;
  /** Any additional metadata about the extraction */
  meta?: Record<string, any>;
}

/**
 * Breakdown of confidence scores for components of the pipeline.
 */
export interface ConfidenceBreakdown {
  /** Intent classifier confidence (0-1) */
  intent?: number;
  /** Average confidence over all extracted entities (0-1) */
  entities?: number;
  /** Speech-to-text confidence (0-1) */
  stt?: number;
  /** Overall confidence (0-1) */
  overall?: number;
  /** Per-entity confidences keyed by entity name */
  perEntity?: Record<string, number>;
}

/**
 * Represents a user correction applied after confirmation or editing.
 */
export interface UserCorrection {
  /** Field that was corrected (e.g. title, memoDate) */
  field: string;
  /** Value before correction */
  oldValue: any;
  /** Value after correction */
  newValue: any;
  /** When the correction was made */
  correctedAt?: Date;
  /** Optional note or reason */
  note?: string;
  /** Optional user id who made the correction */
  userId?: string;
}

/**
 * Full representation of a voice command log row (camelCase fields).
 */
export interface VoiceCommandLog {
  /** Primary key UUID */
  id: string;
  /** ID of the user who issued the command (nullable for legacy rows) */
  userId?: string | null;
  /** Session identifier grouping related commands */
  sessionId: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Expiration timestamp for auto-deletion */
  expiresAt: Date;

  /** Original transcript (encrypted at rest) */
  rawTranscript: string;
  /** Whether rawTranscript is encrypted */
  rawTranscriptEncrypted: boolean;
  /** Language tag for the transcript (en-US, etc.) */
  language?: string;

  /** Intent classification */
  intentType: IntentType;
  /** Intent confidence (0-1) */
  intentConfidence?: number;
  /** Method used to generate the intent */
  intentMethod?: IntentMethod;
  /** Alternative intent candidates */
  intentAlternatives?: any;

  /** Entity extraction */
  entityType?: EntityType;
  /** All extracted entities */
  entities: Entity[];

  /** Denormalized date/time fields */
  memoDate?: Date | null;
  memoDateExpression?: string | null;
  memoTime?: string | null;
  memoTimeExpression?: string | null;
  allDayEvent?: boolean;

  /** Structured fields */
  extractedTitle?: string | null;
  extractedPriority?: Priority | null;
  extractedTags?: string[];
  extractedRecurrence?: string | null; // RRULE
  extractedRecurrenceHuman?: string | null;
  extractedDuration?: number | null; // minutes
  extractedLocation?: string | null;
  extractedAttendees?: string[];

  /** Processing metadata */
  processingDurationMs?: number | null;
  overallConfidence?: number | null;
  confidenceBreakdown?: ConfidenceBreakdown | null;

  /** Validation */
  isValid?: boolean;
  missingFields?: string[];
  validationErrors?: string[];
  needsUserInput?: boolean;

  /** User actions */
  userCorrections?: UserCorrection[] | null;
  confirmationShown?: boolean;
  userConfirmed?: boolean;
  userEdited?: boolean;

  /** Execution outcome */
  outcome: Outcome;
  failureReason?: string | null;
  retryCount?: number;

  /** Created item references */
  createdItemType?: string | null;
  createdItemId?: string | null;
  createdItemData?: any;

  /** Search & fuzzy matching */
  fuzzyMatchUsed?: boolean;
  fuzzyMatchScore?: number | null;
  searchKeywords?: string[];

  /** Context & learning */
  contextData?: any;
  learnedFromHistory?: boolean;
  userPatternMatched?: boolean;
  customVocabularyUsed?: string[];

  /** Device & environment */
  deviceType?: string | null;
  deviceOs?: string | null;
  appVersion?: string | null;
  modelVersion?: string | null;

  /** Privacy & compliance */
  containsPii?: boolean;
  anonymized?: boolean;
}

/**
 * Insert payload for creating a new voice command log.
 * Required fields are minimal: `rawTranscript` and `intentType`.
 * Other fields are optional and will be filled by the system when applicable.
 */
export interface VoiceCommandLogInsert {
  rawTranscript: string;
  intentType: IntentType;
  userId?: string | null;
  sessionId?: string;
  language?: string;
  entities?: Entity[];
  memoDate?: Date | string | null;
  memoTime?: string | null;
  extractedTitle?: string | null;
  extractedPriority?: Priority | null;
  extractedTags?: string[];
  extractedRecurrence?: string | null;
  extractedDuration?: number | null;
  createdItemType?: string | null;
  createdItemId?: string | null;
  createdItemData?: any;
  intentConfidence?: number;
  intentMethod?: IntentMethod;
  intentAlternatives?: any;
  confidenceBreakdown?: ConfidenceBreakdown | null;
  // allow any additional columns
  [key: string]: any;
}

/**
 * Update payload for a voice command log. `id` is required to identify the row.
 * All other fields are optional.
 */
export type VoiceCommandLogUpdate = Partial<Omit<VoiceCommandLog, 'id'>> & { id: string };


