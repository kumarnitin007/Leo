/**
 * Mobile Context Header Component
 *
 * Shows current view context on mobile with back navigation
 * and view-specific information.
 *
 * Sub-pages can override the title / icon / back behaviour at runtime via
 * `useMobileHeader()` (see `src/contexts/MobileHeaderContext.tsx`). For
 * example, when the user opens Settings → Profile on mobile, Settings sets
 * an override so this bar reads "‹ 👤 Profile" with the back arrow returning
 * to the Settings menu instead of Home.
 */

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useMobileHeader } from '../contexts/MobileHeaderContext';

interface MobileContextHeaderProps {
  currentView: string;
  onBack?: () => void;
  showBack?: boolean;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

const viewConfig: Record<string, { title: string; icon: string; color: string }> = {
  today: { title: 'Home', icon: '🏠', color: '#14b8a6' },
  'tasks-events': { title: 'New', icon: '➕', color: '#3b82f6' },
  items: { title: 'Items', icon: '📦', color: '#f59e0b' },
  journal: { title: 'Journal', icon: '📔', color: '#8b5cf6' },
  smart: { title: 'Smart', icon: '✨', color: '#8b5cf6' },
  history: { title: 'History', icon: '📋', color: '#f59e0b' },
  'voice-pending': { title: 'Pending', icon: '⏳', color: '#ea580c' },
  'ai-history': { title: 'AI', icon: '🤖', color: '#818cf8' },
  resolutions: { title: 'Goals', icon: '🎯', color: '#ec4899' },
  analytics: { title: 'Analytics', icon: '📊', color: '#06b6d4' },
  settings: { title: 'Settings', icon: '⚙️', color: '#6b7280' },
  safe: { title: 'Vault', icon: '🔒', color: '#10b981' },
  todo: { title: 'Lists', icon: '✅', color: '#14b8a6' },
  groups: { title: 'Groups', icon: '👨‍👩‍👧‍👦', color: '#f43f5e' },
};

const MobileContextHeader: React.FC<MobileContextHeaderProps> = ({
  currentView,
  onBack,
  showBack = false,
  subtitle,
  rightAction,
}) => {
  const { theme } = useTheme();
  const { override } = useMobileHeader();
  const baseConfig =
    viewConfig[currentView] || { title: 'Leo Planner', icon: '🦁', color: theme.colors.primary };

  // Sub-page overrides take precedence over the per-view defaults.
  const title    = override?.title    ?? baseConfig.title;
  const icon     = override?.icon     ?? baseConfig.icon;
  const sub      = override?.subtitle ?? subtitle;
  const handleBack = override?.onBack ?? onBack;
  // If an override is set we always show a back arrow — the override exists
  // precisely to provide an in-page "back to parent" action.
  const showBackBtn = override?.onBack ? true : showBack;

  const gradientText = theme.gradient.textColor || 'white';
  const isLightGradient = !!theme.gradient.textColor;

  return (
    <div
      className={`mobile-context-header${isLightGradient ? ' light-gradient' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        {showBackBtn && handleBack && (
          <button
            onClick={handleBack}
            style={{
              background: isLightGradient ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              color: gradientText,
              fontSize: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Go back"
          >
            ‹
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h1 className="mobile-header-title" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>{icon}</span>
            <span>{title}</span>
          </h1>
          {sub && (
            <p className="mobile-header-subtitle">{sub}</p>
          )}
        </div>
        {rightAction}
      </div>
    </div>
  );
};

export default MobileContextHeader;
