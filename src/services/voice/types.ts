// Minimal shared types for voice module
export type IntentType =
  | 'CREATE_TASK'
  | 'CREATE_EVENT'
  | 'CREATE_ITEM'
  | 'CREATE_JOURNAL'
  | 'CREATE_ROUTINE'
  | 'CREATE_PINNED_EVENT'
  | 'CREATE_MILESTONE'
  | 'CREATE_RESOLUTION'
  | 'CREATE_TODO' // New To-Do list item
  | 'UPDATE'
  | 'DELETE'
  | 'QUERY'
  | 'UNKNOWN';

export type EntityType =
  | 'TITLE'
  | 'DATE'
  | 'TIME'
  | 'PRIORITY'
  | 'TAG'
  | 'LOCATION'
  | 'DESCRIPTION'
  | 'RECURRENCE'
  | 'QUANTITY'
  | 'PERSON';

export interface Entity {
  type: EntityType;
  value: any;
  normalizedValue?: any;
  confidence: number; // 0-1
}

export interface IntentClassification {
  type: IntentType;
  confidence: number; // 0-1
  method?: 'RULES' | 'AI' | 'HYBRID';
}

export interface ParsedCommand {
  transcript: string;
  intent: IntentClassification;
  entities: Entity[];
  overallConfidence: number; // 0-1
  timestamp: string;
}
