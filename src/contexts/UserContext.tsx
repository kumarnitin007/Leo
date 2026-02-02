/* @refresh reset */
/**
 * User Context
 * 
 * Manages user preferences including avatar, username, and other
 * personalization settings.
 * 
 * Settings are persisted to Supabase (myday_users table) with
 * localStorage used as a cache for quick access.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Avatar, getAvatarById, DEFAULT_AVATAR_ID, avatars } from '../constants/avatars';
import { getUserProfile, updateUserProfile } from '../storage';
import { useAuth } from './AuthContext';

// Storage key for user settings
const USER_SETTINGS_KEY = 'myday-user-settings';

interface UserSettings {
  username: string;
  avatarId: string;
  email?: string;
}

interface UserContextType {
  username: string;
  avatar: Avatar;
  setUsername: (name: string) => Promise<void>;
  setAvatar: (avatarId: string) => Promise<void>;
  email: string;
  setEmail: (email: string) => Promise<void>;
}

// Default user settings
const defaultSettings: UserSettings = {
  username: 'User',
  avatarId: DEFAULT_AVATAR_ID,
  email: '',
};

// Create context
const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * User Provider Component
 * Wrap your app with this to enable user settings functionality
 */
export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(USER_SETTINGS_KEY);
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
    return defaultSettings;
  });
  const [isLoaded, setIsLoaded] = useState(false);

  /**
   * Load user profile from Supabase when user signs in
   */
  useEffect(() => {
    const loadProfile = async () => {
      // If running in local demo mode (synthetic demo user), load profile from localStorage
      const demoFlag = localStorage.getItem('myday-demo') === 'true';
      if (demoFlag && !isLoaded) {
        try {
          const demoRaw = localStorage.getItem('myday-demo-profile');
          if (demoRaw) {
            const profile = JSON.parse(demoRaw);
            const avatar = avatars.find(a => a.emoji === profile.avatarEmoji);
            setSettings({
              username: profile.username || 'Demo User',
              email: profile.email || '',
              avatarId: avatar?.id || DEFAULT_AVATAR_ID
            });
          }
        } catch (e) {
          console.warn('Failed to load local demo profile:', e);
        }
        setIsLoaded(true);
        return;
      }

      if (user && !isLoaded) {
        try {
          const profile = await getUserProfile();
          if (profile) {
            // Find avatar by emoji
            const avatar = avatars.find(a => a.emoji === profile.avatarEmoji);
            setSettings({
              username: profile.username,
              email: profile.email,
              avatarId: avatar?.id || DEFAULT_AVATAR_ID
            });
          }
          setIsLoaded(true);
        } catch (error) {
          // getUserProfile logs errors internally; treat as not-available and mark loaded
          setIsLoaded(true);
        }
      } else if (!user) {
        setIsLoaded(false);
      }
    };
    loadProfile();
  }, [user, isLoaded]);

  /**
   * Save settings to localStorage whenever they change
   */
  useEffect(() => {
    try {
      localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  }, [settings]);

  /**
   * Update username
   */
  const setUsername = async (name: string) => {
    setSettings(prev => ({ ...prev, username: name }));
    try {
      await updateUserProfile({ username: name });
    } catch (error) {
      console.error('Error updating username in database:', error);
    }
  };

  /**
   * Update avatar
   */
  const setAvatar = async (avatarId: string) => {
    setSettings(prev => ({ ...prev, avatarId }));
    const avatar = getAvatarById(avatarId);
    try {
      await updateUserProfile({ avatarEmoji: avatar.emoji });
    } catch (error) {
      console.error('Error updating avatar in database:', error);
    }
  };

  /**
   * Update email
   */
  const setEmail = async (email: string) => {
    setSettings(prev => ({ ...prev, email }));
    try {
      await updateUserProfile({ email });
    } catch (error) {
      console.error('Error updating email in database:', error);
    }
  };

  const value = {
    username: settings.username,
    avatar: getAvatarById(settings.avatarId),
    setUsername,
    setAvatar,
    email: settings.email || '',
    setEmail,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

/**
 * Custom hook to use user context
 * Must be used within UserProvider
 */
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};

