/**
 * JournalDesktop — 3-Column Desktop Layout
 *
 * Left: EntryList | Center: Composer | Right: ContextPanel
 * Matches the desktop reference HTML mockup.
 */

import React from 'react';
import EntryList from './EntryList';
import Composer from './Composer';
import ContextPanel from './ContextPanel';
import type { JournalEntry, MoodType, Tag } from '../../types';
import type { DailyFitnessData } from '../../integrations/google/types/fit.types';
import type { StreakDotData } from './streakUtils';
import type { JournalReflectionResult } from '../../services/ai/abilities/journalReflection';

interface JournalDesktopProps {
  // Entry list
  allEntries: JournalEntry[];
  tags: Tag[];
  searchTerm: string;
  onSearchChange: (term: string) => void;

  // Composer
  selectedDate: string;
  dayEntries: JournalEntry[];
  isToday: boolean;
  content: string;
  mood?: MoodType;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  activities: string[];
  selectedTags: string[];
  availableTags: Tag[];
  isEditing: boolean;
  isNewEntry: boolean;
  editingEntry: JournalEntry | null;
  weather: string;
  location: string;
  autosaveStatus: 'idle' | 'saving' | 'saved';

  // Callbacks
  onContentChange: (text: string) => void;
  onMoodChange: (mood: MoodType) => void;
  onEnergyChange: (level: 1 | 2 | 3 | 4 | 5) => void;
  onActivitiesChange: (acts: string[]) => void;
  onTagsChange: (tags: string[]) => void;
  onWeatherChange: (w: string) => void;
  onLocationChange: (l: string) => void;
  onSave: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onNewEntry: () => void;
  onSelectDate: (date: string) => void;
  onSelectEntry: (entry: JournalEntry) => void;
  onPrevDay: () => void;
  onNextDay: () => void;

  // Context panel
  currentStreak: number;
  bestStreak: number;
  dots: StreakDotData[];
  justSaved: boolean;
  fitnessData: DailyFitnessData[];
  fitnessLoading: boolean;
  fitnessConnected?: boolean | null;
  onFetchFitness: () => void;

  // AI
  stepsToday?: number | null;
  stepsYesterday?: number | null;
  aiReflection?: JournalReflectionResult | null;
  onReflectionUpdate?: (result: JournalReflectionResult | null) => void;
  aiNudge?: string | null;
  onDismissNudge?: () => void;
  onUseNudge?: () => void;
}

const JournalDesktop: React.FC<JournalDesktopProps> = (props) => (
  <div className="j-desktop">
    <EntryList
      entries={props.allEntries}
      selectedDate={props.selectedDate}
      editingEntryId={props.editingEntry?.id}
      tags={props.tags}
      searchTerm={props.searchTerm}
      onSearchChange={props.onSearchChange}
      onSelectDate={props.onSelectDate}
      onSelectEntry={props.onSelectEntry}
      onNewEntry={props.onNewEntry}
    />
    <Composer
      selectedDate={props.selectedDate}
      dayEntries={props.dayEntries}
      isToday={props.isToday}
      onPrevDay={props.onPrevDay}
      onNextDay={props.onNextDay}
      content={props.content}
      mood={props.mood}
      energyLevel={props.energyLevel}
      activities={props.activities}
      selectedTags={props.selectedTags}
      availableTags={props.availableTags}
      isEditing={props.isEditing}
      isNewEntry={props.isNewEntry}
      editingEntry={props.editingEntry}
      weather={props.weather}
      location={props.location}
      onContentChange={props.onContentChange}
      onMoodChange={props.onMoodChange}
      onEnergyChange={props.onEnergyChange}
      onActivitiesChange={props.onActivitiesChange}
      onTagsChange={props.onTagsChange}
      onWeatherChange={props.onWeatherChange}
      onLocationChange={props.onLocationChange}
      onSave={props.onSave}
      onEdit={props.onEdit}
      onCancel={props.onCancel}
      onDelete={props.onDelete}
      onNewEntry={props.onNewEntry}
      onSelectEntry={props.onSelectEntry}
      autosaveStatus={props.autosaveStatus}
      justSaved={props.justSaved}
      stepsToday={props.stepsToday}
      stepsYesterday={props.stepsYesterday}
      onReflectionUpdate={props.onReflectionUpdate}
      aiNudge={props.aiNudge}
      onDismissNudge={props.onDismissNudge}
      onUseNudge={props.onUseNudge}
    />
    <ContextPanel
      currentStreak={props.currentStreak}
      bestStreak={props.bestStreak}
      dots={props.dots}
      allEntries={props.allEntries}
      selectedDate={props.selectedDate}
      editingEntry={props.editingEntry}
      justSaved={props.justSaved}
      aiReflection={props.aiReflection}
      fitnessData={props.fitnessData}
      fitnessLoading={props.fitnessLoading}
      fitnessConnected={props.fitnessConnected}
      onFetchFitness={props.onFetchFitness}
    />
  </div>
);

export default JournalDesktop;
