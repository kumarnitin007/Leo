/**
 * VoiceCommandPrefillContext
 * 
 * Manages prefilled data from voice commands for navigation to create screens.
 * When a voice command is accepted, this context stores the data and triggers
 * navigation to the appropriate form with pre-filled values.
 */

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { VoiceCommandLog, IntentType } from '../types/voice-command-db.types';
import { ParsedCommand } from '../services/voice/types';

// Prefill data structure for different item types
export interface VoicePrefillData {
  type: 'task' | 'event' | 'journal' | 'todo' | 'routine' | 'item' | 'milestone' | null;
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  priority?: string;
  tags?: string[];
  mood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  content?: string; // For journal entries
  groupId?: string; // For todo items
  recurrence?: string;
  sourceCommand?: VoiceCommandLog | ParsedCommand;
}

interface VoiceCommandPrefillContextType {
  prefillData: VoicePrefillData | null;
  setPrefillData: (data: VoicePrefillData | null) => void;
  setFromVoiceCommand: (command: VoiceCommandLog) => void;
  setFromParsedCommand: (parsed: ParsedCommand) => void;
  clearPrefill: () => void;
  getTargetView: () => string | null;
}

const VoiceCommandPrefillContext = createContext<VoiceCommandPrefillContextType | undefined>(undefined);

// Map intent types to app views
const INTENT_TO_VIEW: Record<string, string> = {
  'CREATE_TASK': 'tasks-events',
  'CREATE_EVENT': 'tasks-events',
  'CREATE_JOURNAL': 'journal',
  'CREATE_TODO': 'todo',
  'CREATE_ROUTINE': 'routines',
  'CREATE_ITEM': 'items',
  'CREATE_MILESTONE': 'milestones',
};

// Map intent types to item types
const INTENT_TO_TYPE: Record<string, VoicePrefillData['type']> = {
  'CREATE_TASK': 'task',
  'CREATE_EVENT': 'event',
  'CREATE_JOURNAL': 'journal',
  'CREATE_TODO': 'todo',
  'CREATE_ROUTINE': 'routine',
  'CREATE_ITEM': 'item',
  'CREATE_MILESTONE': 'milestone',
};

export const VoiceCommandPrefillProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [prefillData, setPrefillData] = useState<VoicePrefillData | null>(null);

  const setFromVoiceCommand = useCallback((command: VoiceCommandLog) => {
    const type = INTENT_TO_TYPE[command.intentType] || null;
    
    const data: VoicePrefillData = {
      type,
      title: command.extractedTitle || undefined,
      date: command.memoDate || undefined,
      time: command.memoTime || undefined,
      priority: command.extractedPriority || undefined,
      tags: command.extractedTags || undefined,
      recurrence: command.extractedRecurrence || undefined,
      sourceCommand: command,
    };

    // For journal, use the transcript as initial content
    if (type === 'journal') {
      data.content = command.rawTranscript;
    }

    setPrefillData(data);
  }, []);

  const setFromParsedCommand = useCallback((parsed: ParsedCommand) => {
    const type = INTENT_TO_TYPE[parsed.intent.type] || null;
    
    const getEntity = (entityType: string) => 
      parsed.entities.find(e => e.type === entityType);

    const data: VoicePrefillData = {
      type,
      title: getEntity('TITLE')?.normalizedValue || getEntity('TITLE')?.value,
      date: getEntity('DATE')?.normalizedValue || getEntity('DATE')?.value,
      time: getEntity('TIME')?.normalizedValue || getEntity('TIME')?.value,
      priority: getEntity('PRIORITY')?.normalizedValue || getEntity('PRIORITY')?.value,
      recurrence: getEntity('RECURRENCE')?.normalizedValue,
      sourceCommand: parsed,
    };

    // Extract tags
    const tagEntities = parsed.entities.filter(e => e.type === 'TAG');
    if (tagEntities.length > 0) {
      data.tags = tagEntities.map(t => t.normalizedValue || t.value);
    }

    // For journal, use the transcript as initial content
    if (type === 'journal') {
      // Try to extract meaningful content from the transcript
      const transcript = parsed.transcript;
      const journalPrefixes = ['journal', 'note to self', 'write in my journal', 'dear diary'];
      let content = transcript;
      for (const prefix of journalPrefixes) {
        if (content.toLowerCase().startsWith(prefix)) {
          content = content.substring(prefix.length).trim();
          // Remove leading punctuation
          content = content.replace(/^[:\s,]+/, '').trim();
          break;
        }
      }
      data.content = content;
      
      // Try to extract mood from transcript
      const moodPatterns: { pattern: RegExp; mood: VoicePrefillData['mood'] }[] = [
        { pattern: /(?:feeling|i'm|i feel)\s*(?:really\s*)?(?:great|amazing|fantastic|wonderful)/i, mood: 'great' },
        { pattern: /(?:feeling|i'm|i feel)\s*(?:really\s*)?(?:good|happy|fine|nice)/i, mood: 'good' },
        { pattern: /(?:feeling|i'm|i feel)\s*(?:really\s*)?(?:okay|ok|alright|so-so|meh)/i, mood: 'okay' },
        { pattern: /(?:feeling|i'm|i feel)\s*(?:really\s*)?(?:bad|sad|down|upset)/i, mood: 'bad' },
        { pattern: /(?:feeling|i'm|i feel)\s*(?:really\s*)?(?:terrible|awful|horrible|depressed)/i, mood: 'terrible' },
      ];
      for (const { pattern, mood } of moodPatterns) {
        if (pattern.test(transcript)) {
          data.mood = mood;
          break;
        }
      }
    }

    setPrefillData(data);
  }, []);

  const clearPrefill = useCallback(() => {
    setPrefillData(null);
  }, []);

  const getTargetView = useCallback(() => {
    if (!prefillData?.sourceCommand) return null;
    
    const intentType = 'intent' in prefillData.sourceCommand 
      ? (prefillData.sourceCommand as ParsedCommand).intent.type
      : (prefillData.sourceCommand as VoiceCommandLog).intentType;
    
    return INTENT_TO_VIEW[intentType] || null;
  }, [prefillData]);

  return (
    <VoiceCommandPrefillContext.Provider value={{
      prefillData,
      setPrefillData,
      setFromVoiceCommand,
      setFromParsedCommand,
      clearPrefill,
      getTargetView,
    }}>
      {children}
    </VoiceCommandPrefillContext.Provider>
  );
};

export const useVoiceCommandPrefill = () => {
  const context = useContext(VoiceCommandPrefillContext);
  if (!context) {
    throw new Error('useVoiceCommandPrefill must be used within VoiceCommandPrefillProvider');
  }
  return context;
};
