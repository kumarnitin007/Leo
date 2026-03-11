/* @refresh reset */
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
import { RADIUS, SHADOW, TRANSITION, SPACING } from '../constants/design-tokens';

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
   * Apply theme colors and design tokens to CSS variables
   * This allows dynamic theming throughout the app
   */
  useEffect(() => {
    const root = document.documentElement;
    
    // ===== THEME COLORS =====
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-background', theme.colors.background);
    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--color-text-light', theme.colors.textLight);
    root.style.setProperty('--color-card-bg', theme.colors.cardBg);
    root.style.setProperty('--color-card-border', theme.colors.cardBorder);
    root.style.setProperty('--color-success', theme.colors.success);
    root.style.setProperty('--color-warning', theme.colors.warning);
    root.style.setProperty('--color-danger', theme.colors.danger);
    root.style.setProperty('--gradient-from', theme.gradient.from);
    root.style.setProperty('--gradient-via', theme.gradient.via);
    root.style.setProperty('--gradient-to', theme.gradient.to);
    
    // Derived colors for common UI patterns
    root.style.setProperty('--color-text-muted', theme.colors.textLight);
    root.style.setProperty('--color-border', theme.colors.cardBorder);
    root.style.setProperty('--color-card-bg-alt', theme.colors.background);
    
    // ===== BORDER RADIUS (Design Tokens) =====
    root.style.setProperty('--radius-none', RADIUS.none);
    root.style.setProperty('--radius-xs', RADIUS.xs);
    root.style.setProperty('--radius-sm', RADIUS.sm);
    root.style.setProperty('--radius-md', RADIUS.md);
    root.style.setProperty('--radius-lg', RADIUS.lg);
    root.style.setProperty('--radius-xl', RADIUS.xl);
    root.style.setProperty('--radius-2xl', RADIUS['2xl']);
    root.style.setProperty('--radius-full', RADIUS.full);
    root.style.setProperty('--radius-circle', RADIUS.circle);
    
    // ===== SHADOWS =====
    root.style.setProperty('--shadow-none', SHADOW.none);
    root.style.setProperty('--shadow-xs', SHADOW.xs);
    root.style.setProperty('--shadow-sm', SHADOW.sm);
    root.style.setProperty('--shadow-md', SHADOW.md);
    root.style.setProperty('--shadow-lg', SHADOW.lg);
    root.style.setProperty('--shadow-xl', SHADOW.xl);
    root.style.setProperty('--shadow-2xl', SHADOW['2xl']);
    
    // ===== TRANSITIONS =====
    root.style.setProperty('--transition-fast', TRANSITION.fast);
    root.style.setProperty('--transition-normal', TRANSITION.normal);
    root.style.setProperty('--transition-slow', TRANSITION.slow);
    root.style.setProperty('--transition-bounce', TRANSITION.bounce);
    
    // ===== SPACING =====
    root.style.setProperty('--space-1', SPACING[1]);
    root.style.setProperty('--space-2', SPACING[2]);
    root.style.setProperty('--space-3', SPACING[3]);
    root.style.setProperty('--space-4', SPACING[4]);
    root.style.setProperty('--space-5', SPACING[5]);
    root.style.setProperty('--space-6', SPACING[6]);
    root.style.setProperty('--space-8', SPACING[8]);
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

