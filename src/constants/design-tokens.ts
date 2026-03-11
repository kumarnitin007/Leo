/**
 * Design Tokens - Standardized values for consistent UI
 * 
 * Usage:
 * - Import these constants for inline styles: `borderRadius: RADIUS.md`
 * - CSS variables are set in ThemeContext: `var(--radius-md)`
 * 
 * Border Radius Scale:
 * - none: 0        - No rounding (tables, specific UI)
 * - xs:   2px      - Tiny elements (inline badges)
 * - sm:   4px      - Small inputs, chips
 * - md:   8px      - Default for most elements
 * - lg:   12px     - Cards, modals, sections
 * - xl:   16px     - Large cards, hero sections
 * - 2xl:  24px     - Extra large containers
 * - full: 9999px   - Pills, tags, fully rounded
 * - circle: 50%    - Perfect circles (avatars, FABs)
 */

export const RADIUS = {
  none: '0',
  xs: '2px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
  circle: '50%',
} as const;

export type RadiusKey = keyof typeof RADIUS;

/**
 * Spacing Scale (consistent with Tailwind)
 * Used for padding, margin, gap
 */
export const SPACING = {
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
} as const;

/**
 * Shadow Scale
 */
export const SHADOW = {
  none: 'none',
  xs: '0 1px 2px rgba(0,0,0,0.05)',
  sm: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
  md: '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
  lg: '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
  xl: '0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)',
  '2xl': '0 25px 50px rgba(0,0,0,0.25)',
} as const;

/**
 * Transition presets
 */
export const TRANSITION = {
  fast: 'all 0.15s ease',
  normal: 'all 0.2s ease',
  slow: 'all 0.3s ease',
  bounce: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

/**
 * Z-Index scale for layering
 */
export const Z_INDEX = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

/**
 * Font sizes (using rem for accessibility)
 */
export const FONT_SIZE = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem', // 36px
} as const;

/**
 * Standard semantic colors (for non-theme colors)
 * Theme colors should come from ThemeContext
 */
export const SEMANTIC_COLORS = {
  success: {
    light: '#d1fae5',
    main: '#10b981',
    dark: '#059669',
  },
  warning: {
    light: '#fef3c7',
    main: '#f59e0b',
    dark: '#d97706',
  },
  danger: {
    light: '#fee2e2',
    main: '#ef4444',
    dark: '#dc2626',
  },
  info: {
    light: '#dbeafe',
    main: '#3b82f6',
    dark: '#2563eb',
  },
} as const;

/**
 * Common style presets for quick application
 */
export const STYLE_PRESETS = {
  card: {
    borderRadius: RADIUS.lg,
    boxShadow: SHADOW.sm,
    padding: SPACING[4],
  },
  button: {
    borderRadius: RADIUS.md,
    padding: `${SPACING[2]} ${SPACING[4]}`,
    transition: TRANSITION.fast,
  },
  input: {
    borderRadius: RADIUS.md,
    padding: `${SPACING[2]} ${SPACING[3]}`,
  },
  badge: {
    borderRadius: RADIUS.full,
    padding: `${SPACING[0.5]} ${SPACING[2]}`,
    fontSize: FONT_SIZE.xs,
  },
  modal: {
    borderRadius: RADIUS.xl,
    boxShadow: SHADOW.xl,
  },
} as const;
