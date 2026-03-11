/**
 * useDesignTokens Hook
 * 
 * Provides easy access to design tokens in components.
 * Combines theme colors with standardized design tokens.
 * 
 * Usage:
 * ```tsx
 * const { radius, shadow, colors } = useDesignTokens();
 * 
 * <div style={{ 
 *   borderRadius: radius.lg, 
 *   boxShadow: shadow.md,
 *   background: colors.cardBg 
 * }}>
 * ```
 */

import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { RADIUS, SHADOW, TRANSITION, SPACING, SEMANTIC_COLORS, STYLE_PRESETS } from '../constants/design-tokens';

export const useDesignTokens = () => {
  const { theme } = useTheme();
  
  return useMemo(() => ({
    // Border radius tokens
    radius: RADIUS,
    
    // Shadow tokens
    shadow: SHADOW,
    
    // Transition tokens
    transition: TRANSITION,
    
    // Spacing tokens
    spacing: SPACING,
    
    // Theme colors (dynamic based on user's theme)
    colors: {
      ...theme.colors,
      // Semantic aliases
      textMuted: theme.colors.textLight,
      border: theme.colors.cardBorder,
      cardBgAlt: theme.colors.background,
    },
    
    // Gradient from theme
    gradient: theme.gradient,
    
    // Semantic colors (static, not theme-dependent)
    semantic: SEMANTIC_COLORS,
    
    // Pre-built style presets
    presets: STYLE_PRESETS,
    
    // Helper to create gradient string
    gradientString: `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`,
    
    // Helper for CSS variable usage
    cssVar: (name: string) => `var(--${name})`,
    
  }), [theme]);
};

/**
 * Quick style helpers for common patterns
 */
export const styleHelpers = {
  card: (tokens: ReturnType<typeof useDesignTokens>) => ({
    background: tokens.colors.cardBg,
    borderRadius: tokens.radius.lg,
    border: `1px solid ${tokens.colors.cardBorder}`,
    boxShadow: tokens.shadow.sm,
  }),
  
  button: (tokens: ReturnType<typeof useDesignTokens>, variant: 'primary' | 'secondary' | 'danger' = 'primary') => ({
    borderRadius: tokens.radius.md,
    padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
    transition: tokens.transition.fast,
    background: variant === 'primary' ? tokens.colors.primary 
              : variant === 'danger' ? tokens.colors.danger 
              : tokens.colors.cardBg,
    color: variant === 'secondary' ? tokens.colors.text : 'white',
    border: variant === 'secondary' ? `1px solid ${tokens.colors.border}` : 'none',
  }),
  
  input: (tokens: ReturnType<typeof useDesignTokens>) => ({
    borderRadius: tokens.radius.md,
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    border: `1px solid ${tokens.colors.border}`,
    background: tokens.colors.cardBg,
    transition: tokens.transition.fast,
  }),
  
  badge: (tokens: ReturnType<typeof useDesignTokens>) => ({
    borderRadius: tokens.radius.full,
    padding: `${tokens.spacing[0.5]} ${tokens.spacing[2]}`,
    fontSize: '0.75rem',
    fontWeight: 500,
  }),
  
  modal: (tokens: ReturnType<typeof useDesignTokens>) => ({
    borderRadius: tokens.radius.xl,
    boxShadow: tokens.shadow.xl,
    background: tokens.colors.cardBg,
  }),
};

export default useDesignTokens;
