/**
 * Tabs Component
 * 
 * Flexible tab navigation with various styles and mobile support.
 * 
 * Usage:
 * ```tsx
 * <Tabs
 *   tabs={[
 *     { id: 'tasks', label: 'Tasks', icon: '📋', badge: 5 },
 *     { id: 'events', label: 'Events', icon: '📅' },
 *     { id: 'habits', label: 'Habits', icon: '🔄' },
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 * />
 * 
 * // Pill style for sub-navigation
 * <Tabs variant="pills" tabs={tabs} activeTab={active} onTabChange={setActive} />
 * 
 * // Underline style
 * <Tabs variant="underline" tabs={tabs} activeTab={active} onTabChange={setActive} />
 * ```
 */

import React, { CSSProperties, ReactNode, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, SHADOW } from '../../constants/design-tokens';
import { haptic } from '../../utils/haptic';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
  disabled?: boolean;
}

export type TabVariant = 'default' | 'pills' | 'underline' | 'buttons';

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: TabVariant;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  scrollable?: boolean;
  showIcons?: boolean;
  showLabels?: boolean;
  style?: CSSProperties;
  className?: string;
}

const sizeStyles = {
  sm: { padding: `${SPACING[1]} ${SPACING[2]}`, fontSize: '0.8125rem' },
  md: { padding: `${SPACING[2]} ${SPACING[3]}`, fontSize: '0.875rem' },
  lg: { padding: `${SPACING[3]} ${SPACING[4]}`, fontSize: '1rem' },
};

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'default',
  size = 'md',
  fullWidth = false,
  scrollable = true,
  showIcons = true,
  showLabels = true,
  style,
  className,
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (scrollable && activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeElement = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();

      if (activeRect.left < containerRect.left || activeRect.right > containerRect.right) {
        activeElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeTab, scrollable]);

  const handleTabClick = (tab: Tab) => {
    if (tab.disabled) return;
    haptic.light();
    onTabChange(tab.id);
  };

  const getContainerStyles = (): CSSProperties => {
    const base: CSSProperties = {
      display: 'flex',
      gap: variant === 'pills' ? SPACING[1] : variant === 'buttons' ? SPACING[2] : 0,
      overflowX: scrollable ? 'auto' : 'visible',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      WebkitOverflowScrolling: 'touch',
    };

    switch (variant) {
      case 'pills':
        return {
          ...base,
          background: theme.colors.background,
          padding: SPACING[1],
          borderRadius: RADIUS.lg,
        };
      case 'underline':
        return {
          ...base,
          borderBottom: `2px solid ${theme.colors.cardBorder}`,
        };
      case 'buttons':
        return base;
      default:
        return {
          ...base,
          background: theme.colors.cardBg,
          borderRadius: RADIUS.lg,
          border: `1px solid ${theme.colors.cardBorder}`,
        };
    }
  };

  const getTabStyles = (tab: Tab, isActive: boolean): CSSProperties => {
    const baseStyles: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING[1],
      border: 'none',
      cursor: tab.disabled ? 'not-allowed' : 'pointer',
      opacity: tab.disabled ? 0.5 : 1,
      fontWeight: isActive ? 600 : 400,
      transition: 'all 0.15s ease',
      whiteSpace: 'nowrap',
      flex: fullWidth ? 1 : undefined,
      ...sizeStyles[size],
    };

    switch (variant) {
      case 'pills':
        return {
          ...baseStyles,
          background: isActive
            ? (theme.gradient.textColor
                ? theme.colors.primary
                : `linear-gradient(135deg, ${theme.gradient.from}, ${theme.gradient.to})`)
            : 'transparent',
          color: isActive ? 'white' : theme.colors.text,
          borderRadius: RADIUS.md,
          boxShadow: isActive ? SHADOW.sm : 'none',
        };
      case 'underline':
        return {
          ...baseStyles,
          background: 'transparent',
          color: isActive ? theme.colors.primary : theme.colors.textLight,
          borderBottom: isActive ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
          marginBottom: '-2px',
          borderRadius: 0,
        };
      case 'buttons':
        return {
          ...baseStyles,
          background: isActive ? theme.colors.primary : theme.colors.cardBg,
          color: isActive ? 'white' : theme.colors.text,
          borderRadius: RADIUS.md,
          border: `1px solid ${isActive ? theme.colors.primary : theme.colors.cardBorder}`,
          boxShadow: isActive ? SHADOW.sm : 'none',
        };
      default:
        return {
          ...baseStyles,
          background: isActive ? theme.colors.cardBg : 'transparent',
          color: isActive ? theme.colors.primary : theme.colors.textLight,
          borderRadius: RADIUS.md,
        };
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...getContainerStyles(),
        ...style,
      }}
    >
      <style>
        {`
          .tabs-container::-webkit-scrollbar { display: none; }
        `}
      </style>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => handleTabClick(tab)}
            disabled={tab.disabled}
            style={getTabStyles(tab, isActive)}
            onMouseEnter={(e) => {
              if (!isActive && !tab.disabled && variant !== 'underline') {
                e.currentTarget.style.background = theme.colors.background;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive && !tab.disabled && variant !== 'underline') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {showIcons && tab.icon && (
              <span style={{ fontSize: size === 'sm' ? '1rem' : '1.125rem' }}>
                {tab.icon}
              </span>
            )}
            {showLabels && <span>{tab.label}</span>}
            {tab.badge !== undefined && (
              <span
                style={{
                  padding: `0 ${SPACING[1]}`,
                  background: isActive
                    ? variant === 'pills' ? 'rgba(255,255,255,0.3)' : theme.colors.primary
                    : theme.colors.cardBorder,
                  color: isActive && variant !== 'pills' ? 'white' : theme.colors.text,
                  borderRadius: RADIUS.full,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  minWidth: '20px',
                  textAlign: 'center',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
