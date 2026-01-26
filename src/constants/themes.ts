/**
 * Theme Constants
 * 
 * This file defines all available themes for the Leo Planner app.
 * Each theme includes colors, gradients, and styling properties
 * that create a unique visual experience.
 * 
 * Themes are designed to be accessible, visually appealing,
 * and suitable for different times of day or user preferences.
 */

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    textLight: string;
    cardBg: string;
    cardBorder: string;
    success: string;
    warning: string;
    danger: string;
  };
  gradient: {
    from: string;
    via: string;
    to: string;
  };
}

/**
 * Available themes for the application
 * Users can switch between these themes in the Settings menu
 */
export const themes: Theme[] = [
  {
    id: 'routine-ruby',
    name: 'Leo Planner',
    emoji: '🦁',
    description: 'Elegant muted ruby - inspired by lions',
    colors: {
      primary: '#8B3A3A',
      secondary: '#6B2C2C',
      accent: '#A94A4A',
      background: '#f9fafb',
      text: '#1f2937',
      textLight: '#6b7280',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#8B3A3A',
    },
    gradient: {
      from: '#8B3A3A',
      via: '#7A3333',
      to: '#6B2C2C',
    },
  },
  {
    id: 'purple-dream',
    name: 'Purple Dream',
    emoji: '💜',
    description: 'The classic purple gradient - calm and focused',
    colors: {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#8b5cf6',
      background: '#f9fafb',
      text: '#1f2937',
      textLight: '#6b7280',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
    gradient: {
      from: '#667eea',
      via: '#764ba2',
      to: '#764ba2',
    },
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    emoji: '🌊',
    description: 'Cool blues and teals for a refreshing feel',
    colors: {
      primary: '#3b82f6',
      secondary: '#0ea5e9',
      accent: '#06b6d4',
      background: '#f0f9ff',
      text: '#0c4a6e',
      textLight: '#475569',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#bae6fd',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
    gradient: {
      from: '#3b82f6',
      via: '#0ea5e9',
      to: '#06b6d4',
    },
  },
  {
    id: 'sunset-glow',
    name: 'Sunset Glow',
    emoji: '🌅',
    description: 'Warm oranges and pinks for evening vibes',
    colors: {
      primary: '#f97316',
      secondary: '#ec4899',
      accent: '#f43f5e',
      background: '#fff7ed',
      text: '#7c2d12',
      textLight: '#9a3412',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#fed7aa',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#dc2626',
    },
    gradient: {
      from: '#f97316',
      via: '#fb923c',
      to: '#ec4899',
    },
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    emoji: '🌲',
    description: 'Natural greens for a calming environment',
    colors: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#34d399',
      background: '#f0fdf4',
      text: '#064e3b',
      textLight: '#047857',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#bbf7d0',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
    gradient: {
      from: '#10b981',
      via: '#059669',
      to: '#047857',
    },
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    emoji: '🌸',
    description: 'Soft pinks for a gentle, feminine touch',
    colors: {
      primary: '#ec4899',
      secondary: '#f472b6',
      accent: '#f9a8d4',
      background: '#fdf2f8',
      text: '#831843',
      textLight: '#9d174d',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#fbcfe8',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#dc2626',
    },
    gradient: {
      from: '#ec4899',
      via: '#f472b6',
      to: '#f9a8d4',
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    emoji: '✨',
    description: 'Bright golds and yellows for positivity',
    colors: {
      primary: '#eab308',
      secondary: '#f59e0b',
      accent: '#fbbf24',
      background: '#fefce8',
      text: '#713f12',
      textLight: '#92400e',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#fde68a',
      success: '#10b981',
      warning: '#f97316',
      danger: '#ef4444',
    },
    gradient: {
      from: '#eab308',
      via: '#f59e0b',
      to: '#f97316',
    },
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    emoji: '🌙',
    description: 'Deep blues for late-night productivity',
    colors: {
      primary: '#1e3a8a',
      secondary: '#1e40af',
      accent: '#3b82f6',
      background: '#eff6ff',
      text: '#1e3a8a',
      textLight: '#1e40af',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#bfdbfe',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
    gradient: {
      from: '#1e3a8a',
      via: '#1e40af',
      to: '#3b82f6',
    },
  },
  {
    id: 'lavender-fields',
    name: 'Lavender Fields',
    emoji: '💐',
    description: 'Soft purples for a dreamy experience',
    colors: {
      primary: '#a855f7',
      secondary: '#c084fc',
      accent: '#d8b4fe',
      background: '#faf5ff',
      text: '#581c87',
      textLight: '#6b21a8',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#e9d5ff',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
    gradient: {
      from: '#a855f7',
      via: '#c084fc',
      to: '#d8b4fe',
    },
  },
  {
    id: 'autumn-leaves',
    name: 'Autumn Leaves',
    emoji: '🍂',
    description: 'Warm browns and oranges for cozy vibes',
    colors: {
      primary: '#ea580c',
      secondary: '#dc2626',
      accent: '#f59e0b',
      background: '#fff7ed',
      text: '#7c2d12',
      textLight: '#9a3412',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#fed7aa',
      success: '#10b981',
      warning: '#f97316',
      danger: '#dc2626',
    },
    gradient: {
      from: '#ea580c',
      via: '#dc2626',
      to: '#f59e0b',
    },
  },
  {
    id: 'mint-fresh',
    name: 'Mint Fresh',
    emoji: '🍃',
    description: 'Cool mint greens for a fresh start',
    colors: {
      primary: '#14b8a6',
      secondary: '#06b6d4',
      accent: '#22d3ee',
      background: '#f0fdfa',
      text: '#134e4a',
      textLight: '#0f766e',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: '#99f6e4',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
    gradient: {
      from: '#14b8a6',
      via: '#06b6d4',
      to: '#22d3ee',
    },
  },
  {
    id: 'corporate-navy',
    name: 'Corporate Navy',
    emoji: '💼',
    description: 'Professional navy blue for business environments',
    colors: {
      primary: '#1e3a8a',
      secondary: '#1e40af',
      accent: '#3b82f6',
      background: '#f8fafc',
      text: '#0f172a',
      textLight: '#475569',
      cardBg: 'rgba(255, 255, 255, 0.98)',
      cardBorder: '#e2e8f0',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#dc2626',
    },
    gradient: {
      from: '#1e3a8a',
      via: '#1e40af',
      to: '#2563eb',
    },
  },
  {
    id: 'executive-slate',
    name: 'Executive Slate',
    emoji: '🏢',
    description: 'Sophisticated slate gray for executive presence',
    colors: {
      primary: '#334155',
      secondary: '#475569',
      accent: '#64748b',
      background: '#f8fafc',
      text: '#0f172a',
      textLight: '#64748b',
      cardBg: 'rgba(255, 255, 255, 0.98)',
      cardBorder: '#e2e8f0',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#dc2626',
    },
    gradient: {
      from: '#334155',
      via: '#475569',
      to: '#64748b',
    },
  },
  {
    id: 'professional-charcoal',
    name: 'Professional Charcoal',
    emoji: '📊',
    description: 'Modern charcoal with subtle warmth for professionals',
    colors: {
      primary: '#374151',
      secondary: '#4b5563',
      accent: '#6b7280',
      background: '#fafafa',
      text: '#111827',
      textLight: '#6b7280',
      cardBg: 'rgba(255, 255, 255, 0.98)',
      cardBorder: '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#dc2626',
    },
    gradient: {
      from: '#374151',
      via: '#4b5563',
      to: '#6b7280',
    },
  },
  {
    id: 'banker-burgundy',
    name: 'Banker Burgundy',
    emoji: '🏦',
    description: 'Classic burgundy for traditional business settings',
    colors: {
      primary: '#7c2d12',
      secondary: '#991b1b',
      accent: '#b91c1c',
      background: '#fef2f2',
      text: '#1f2937',
      textLight: '#6b7280',
      cardBg: 'rgba(255, 255, 255, 0.98)',
      cardBorder: '#fee2e2',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#dc2626',
    },
    gradient: {
      from: '#7c2d12',
      via: '#991b1b',
      to: '#b91c1c',
    },
  },
];

/**
 * Get theme by ID
 * Returns the default theme if ID not found
 */
export const getThemeById = (id: string): Theme => {
  return themes.find(theme => theme.id === id) || themes[0];
};

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = 'mint-fresh';

