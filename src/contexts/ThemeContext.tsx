/**
 * Theme Context
 * 
 * Provides theme functionality throughout the app.
 * Manages theme selection, persistence, and provides
 * theme data to all components.
 * 
 * Usage:
 * ```tsx
 * const { theme, setTheme } = useTheme();
 * ```
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, themes, getThemeById, DEFAULT_THEME_ID } from '../constants/themes';

// Storage key for theme preference
const THEME_STORAGE_KEY = 'myday-theme';

interface ThemeContextType {
  theme: Theme;
  setTheme: (themeId: string) => void;
  availableThemes: Theme[];
}

// Create context with default values
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Theme Provider Component
 * Wrap your app with this to enable theme functionality
 */
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load saved theme or use default
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved || DEFAULT_THEME_ID;
    } catch {
      return DEFAULT_THEME_ID;
    }
  });

  const theme = getThemeById(currentThemeId);

  /**
   * Change the current theme
   * Saves preference to localStorage for persistence
   */
  const setTheme = (themeId: string) => {
    setCurrentThemeId(themeId);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  /**
   * Apply theme colors to CSS variables
   * This allows dynamic theming throughout the app
   */
  useEffect(() => {
    const root = document.documentElement;
    
    // Set CSS custom properties for the theme
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--color-text-light', theme.colors.textLight);
    root.style.setProperty('--gradient-from', theme.gradient.from);
    root.style.setProperty('--gradient-via', theme.gradient.via);
    root.style.setProperty('--gradient-to', theme.gradient.to);
  }, [theme]);

  const value = {
    theme,
    setTheme,
    availableThemes: themes,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Custom hook to use theme context
 * Must be used within ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

