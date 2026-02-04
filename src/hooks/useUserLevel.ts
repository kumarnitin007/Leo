import { useState, useEffect } from 'react';
import { getUserLevel, UserLevelAssignment } from '../services/userLevelService';

export interface UserLevelFeatures {
  canAddTasks: boolean;
  canAddEvents: boolean;
  canAddJournal: boolean;
  canAddTodos: boolean;
  canAddItems: boolean;
  canUseVoiceCommands: boolean;
  canUseAI: boolean;
  canUseSafe: boolean;
  canExport: boolean;
  canShare: boolean;
  isDemo: boolean;
  isPremium: boolean;
  levelName: string;
  levelIcon: string;
  taskLimit: number | null;
  eventLimit: number | null;
  journalLimit: number | null;
}

export const useUserLevel = () => {
  const [userLevel, setUserLevel] = useState<UserLevelAssignment | null>(null);
  const [features, setFeatures] = useState<UserLevelFeatures>({
    canAddTasks: true,
    canAddEvents: true,
    canAddJournal: true,
    canAddTodos: true,
    canAddItems: true,
    canUseVoiceCommands: true,
    canUseAI: true,
    canUseSafe: true,
    canExport: true,
    canShare: true,
    isDemo: false,
    isPremium: true,
    levelName: 'Premium',
    levelIcon: '👑',
    taskLimit: null,
    eventLimit: null,
    journalLimit: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserLevel = async () => {
      try {
        const level = await getUserLevel();
        setUserLevel(level);

        if (level) {
          const isDemo = level.level.id === 'demo';
          const isPremium = level.level.id === 'premium';
          
          // Get feature flags from level_features
          const levelFeatures = level.level_features || [];
          
          const getFeature = (featureId: string) => {
            return levelFeatures.find(f => f.feature_id === featureId);
          };

          const getLimit = (featureId: string): number | null => {
            const feature = getFeature(featureId);
            return feature?.limit_value ?? null;
          };

          setFeatures({
            canAddTasks: getFeature('tasks')?.is_enabled ?? true,
            canAddEvents: getFeature('events')?.is_enabled ?? true,
            canAddJournal: getFeature('journal')?.is_enabled ?? true,
            canAddTodos: getFeature('todos')?.is_enabled ?? true,
            canAddItems: getFeature('items')?.is_enabled ?? true,
            canUseVoiceCommands: getFeature('voice_commands')?.is_enabled ?? false,
            canUseAI: getFeature('ai_insights')?.is_enabled ?? false,
            canUseSafe: getFeature('safe')?.is_enabled ?? false,
            canExport: getFeature('export')?.is_enabled ?? false,
            canShare: getFeature('sharing')?.is_enabled ?? false,
            isDemo,
            isPremium,
            levelName: level.level.displayName,
            levelIcon: level.level.icon || '👤',
            taskLimit: getLimit('task_limit'),
            eventLimit: getLimit('event_limit'),
            journalLimit: getLimit('journal_limit'),
          });
        }
      } catch (err) {
        console.error('Failed to load user level:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUserLevel();
  }, []);

  return { userLevel, features, loading };
};
