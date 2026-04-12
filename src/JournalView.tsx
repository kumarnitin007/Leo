/**
 * Journal View — Orchestrator
 *
 * Manages all journal state (entries, editor, streaks, fitness) and delegates
 * rendering to JournalDesktop (3-column) or JournalMobile (timeline) based
 * on viewport width.
 *
 * Redesigned April 2026 — warm paper-toned UI with Lora serif body text.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { JournalEntry, MoodType, Tag } from './types';
import {
  getJournalEntries,
  getJournalEntriesForDate,
  saveJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  getTagsForSection,
  getUserSettings,
} from './storage';
import { formatDate } from './utils';
import { useFitness } from './integrations/fitness';
import { calculateStreaks, computeStreakDots } from './components/journal/streakUtils';
import type { JournalReflectionResult } from './services/ai/abilities/journalReflection';
import JournalDesktop from './components/journal/JournalDesktop';
import JournalMobile from './components/journal/JournalMobile';

interface JournalViewProps {
  prefillContent?: string;
  prefillMood?: MoodType;
  onPrefillUsed?: () => void;
}

const AUTOSAVE_INTERVAL = 30_000;

const JournalView: React.FC<JournalViewProps> = ({ prefillContent, prefillMood, onPrefillUsed }) => {
  // ── Data state ──────────────────────────────────────────────────────
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [dayEntries, setDayEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // ── Editor state ────────────────────────────────────────────────────
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodType | undefined>();
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5 | undefined>();
  const [activities, setActivities] = useState<string[]>([]);
  const [weather, setWeather] = useState('');
  const [location, setLocation] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // ── Fitness ─────────────────────────────────────────────────────────
  const { data: fitnessData, loading: fitnessLoading, connected: fitnessConnected, fetchRecent: fetchFitness } = useFitness();

  // ── AI reflection (shared between center + right panels) ──────────
  const [aiReflection, setAiReflection] = useState<JournalReflectionResult | null>(null);

  const handleReflectionUpdate = useCallback((result: JournalReflectionResult | null) => {
    setAiReflection(result);
  }, []);

  // ── Responsive ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Prefill from voice command ──────────────────────────────────────
  useEffect(() => {
    if (!prefillApplied && (prefillContent || prefillMood)) {
      const timer = setTimeout(() => {
        if (prefillContent) {
          setContent(prev => {
            if (prev && prev.trim() && !prev.includes(prefillContent || '')) {
              return `${prev}\n\n${prefillContent}`;
            }
            return prefillContent;
          });
          setIsEditing(true);
          setIsNewEntry(true);
        }
        if (prefillMood) setMood(prefillMood);
        setPrefillApplied(true);
        onPrefillUsed?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [prefillContent, prefillMood, prefillApplied, onPrefillUsed]);

  // ── Load data ───────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [tags, entries] = await Promise.all([
          getTagsForSection('journals'),
          getJournalEntries(),
        ]);
        setAvailableTags(tags);
        setAllEntries(entries);
      } catch (err) {
        console.error('Error loading journal data:', err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    loadDayEntries(selectedDate);
    setJustSaved(false);
  }, [selectedDate]);

  const loadAllEntries = useCallback(async () => {
    try {
      const entries = await getJournalEntries();
      setAllEntries(entries);
    } catch (err) {
      console.error('Error loading entries:', err);
    }
  }, []);

  const loadDayEntries = useCallback(async (date: string) => {
    try {
      const entries = await getJournalEntriesForDate(date);
      setDayEntries(entries);
      if (entries.length > 0 && !isEditing) {
        selectEntry(entries[0]);
      } else if (entries.length === 0) {
        resetEditor();
        setIsEditing(true);
        setIsNewEntry(true);
        if (date === formatDate(new Date())) {
          autoPopulateContext();
        }
      }
    } catch (err) {
      console.error('Error loading day entries:', err);
    }
  }, [isEditing]);

  // ── Editor helpers ──────────────────────────────────────────────────
  const selectEntry = useCallback((entry: JournalEntry) => {
    setEditingEntry(entry);
    setContent(entry.content);
    setMood(entry.mood);
    setEnergyLevel(entry.energyLevel);
    setActivities(entry.activity || []);
    setWeather(entry.weather || '');
    setLocation(entry.location || '');
    setSelectedTags(entry.tags || []);
    setIsEditing(false);
    setIsNewEntry(false);
  }, []);

  const resetEditor = useCallback(() => {
    setEditingEntry(null);
    setContent('');
    setMood(undefined);
    setEnergyLevel(undefined);
    setActivities([]);
    setWeather('');
    setLocation('');
    setSelectedTags([]);
  }, []);

  const autoPopulateContext = useCallback(async () => {
    try {
      const settings = await getUserSettings();
      // Auto-populate location from user settings
      if (settings.location) {
        const parts = [settings.location.city, settings.location.country].filter(Boolean);
        if (parts.length > 0) setLocation(parts.join(', '));
      }
      // Auto-populate weather from OpenWeatherMap
      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
      if (apiKey && settings.location && (settings.location.zipCode || settings.location.city)) {
        const loc = settings.location;
        const query = loc.zipCode
          ? `zip=${loc.zipCode}${loc.country ? ',' + loc.country : ''}`
          : `q=${loc.city}${loc.country ? ',' + loc.country : ''}`;
        const units = (settings.temperatureUnit === 'celsius') ? 'metric' : 'imperial';
        const symbol = units === 'metric' ? '°C' : '°F';
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${apiKey}&units=${units}`
        );
        if (res.ok) {
          const d = await res.json();
          const desc = d.weather?.[0]?.description || '';
          const temp = Math.round(d.main?.temp ?? 0);
          setWeather(`${temp}${symbol} · ${desc.charAt(0).toUpperCase() + desc.slice(1)}`);
        }
      }
    } catch {
      // Non-critical — silently ignore
    }
  }, []);

  const startNewEntry = useCallback(() => {
    resetEditor();
    setIsEditing(true);
    setIsNewEntry(true);
    if (selectedDate === formatDate(new Date())) {
      autoPopulateContext();
    }
  }, [resetEditor, selectedDate, autoPopulateContext]);

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    try {
      if (isNewEntry || !editingEntry) {
        const entry: JournalEntry = {
          id: crypto.randomUUID(),
          date: selectedDate,
          content,
          mood,
          energyLevel,
          activity: activities.length > 0 ? activities : undefined,
          weather: weather.trim() || undefined,
          location: location.trim() || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveJournalEntry(entry);
      } else {
        await updateJournalEntry(editingEntry.id, {
          content,
          mood,
          energyLevel,
          activity: activities.length > 0 ? activities : undefined,
          weather: weather.trim() || undefined,
          location: location.trim() || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        });
      }
      await loadAllEntries();
      await loadDayEntries(selectedDate);
      setIsEditing(false);
      setIsNewEntry(false);
      setJustSaved(true);
      setAutosaveStatus('saved');
      setTimeout(() => setAutosaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Error saving journal entry:', err);
      alert('Failed to save journal entry. Please try again.');
    }
  }, [content, mood, energyLevel, activities, weather, location, selectedTags, selectedDate, isNewEntry, editingEntry, loadAllEntries, loadDayEntries]);

  const handleDelete = useCallback(async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await deleteJournalEntry(entryId);
      await loadAllEntries();
      await loadDayEntries(selectedDate);
    } catch (err) {
      console.error('Error deleting journal entry:', err);
    }
  }, [selectedDate, loadAllEntries, loadDayEntries]);

  const handleCancel = useCallback(() => {
    if (editingEntry && !isNewEntry) {
      selectEntry(editingEntry);
    } else if (dayEntries.length > 0) {
      selectEntry(dayEntries[0]);
    }
    setIsEditing(false);
    setIsNewEntry(false);
  }, [editingEntry, isNewEntry, dayEntries, selectEntry]);

  // ── Autosave ────────────────────────────────────────────────────────
  const lastSavedContent = useRef(content);
  useEffect(() => {
    if (!isEditing || !content.trim()) return;
    const timer = setInterval(() => {
      if (content !== lastSavedContent.current && content.trim()) {
        setAutosaveStatus('saving');
        handleSave().then(() => {
          lastSavedContent.current = content;
        });
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [isEditing, content, handleSave]);

  // ── Navigation ──────────────────────────────────────────────────────
  const goToPreviousDay = useCallback(() => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    setSelectedDate(formatDate(date));
  }, [selectedDate]);

  const goToNextDay = useCallback(() => {
    const date = new Date(selectedDate + 'T00:00:00');
    const today = new Date();
    if (date < today) {
      date.setDate(date.getDate() + 1);
      setSelectedDate(formatDate(date));
    }
  }, [selectedDate]);

  // ── Computed values ─────────────────────────────────────────────────
  const isToday = selectedDate === formatDate(new Date());
  const { current: currentStreak, best: bestStreak } = calculateStreaks(allEntries);
  const entryDates = new Set(allEntries.map(e => e.date));
  const dots = computeStreakDots(entryDates);

  const { stepsToday, stepsYesterday } = useMemo(() => {
    const now = new Date();
    const todayStr = formatDate(now);
    const yday = new Date(now); yday.setDate(yday.getDate() - 1);
    const ydayStr = formatDate(yday);
    const td = fitnessData.find(d => d.date === todayStr);
    const yd = fitnessData.find(d => d.date === ydayStr);
    return { stepsToday: td?.steps ?? null, stepsYesterday: yd?.steps ?? null };
  }, [fitnessData]);

  // ── Shared props ────────────────────────────────────────────────────
  const sharedProps = {
    allEntries,
    tags: availableTags,
    searchTerm,
    onSearchChange: setSearchTerm,
    selectedDate,
    dayEntries,
    isToday,
    content,
    mood,
    energyLevel,
    activities,
    selectedTags,
    availableTags,
    isEditing,
    isNewEntry,
    editingEntry,
    weather,
    location,
    autosaveStatus,
    onContentChange: setContent,
    onMoodChange: setMood,
    onEnergyChange: setEnergyLevel,
    onActivitiesChange: setActivities,
    onTagsChange: setSelectedTags,
    onWeatherChange: setWeather,
    onLocationChange: setLocation,
    onSave: handleSave,
    onEdit: () => setIsEditing(true),
    onCancel: handleCancel,
    onDelete: handleDelete,
    onNewEntry: startNewEntry,
    onSelectDate: setSelectedDate,
    onSelectEntry: selectEntry,
    onPrevDay: goToPreviousDay,
    onNextDay: goToNextDay,
    currentStreak,
    bestStreak,
    dots,
    justSaved,
    stepsToday,
    stepsYesterday,
    aiReflection,
    onReflectionUpdate: handleReflectionUpdate,
    fitnessData,
    fitnessLoading,
    fitnessConnected,
    onFetchFitness: () => fetchFitness(),
  };

  return (
    <div className="journal-redesign">
      {isMobile ? (
        <JournalMobile
          {...sharedProps}
          aiNudge={null}
        />
      ) : (
        <JournalDesktop
          {...sharedProps}
          aiNudge={null}
        />
      )}
    </div>
  );
};

export default JournalView;
