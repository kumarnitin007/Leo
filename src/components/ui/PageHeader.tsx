/**
 * PageHeader Component
 * 
 * Consistent header for view pages with title, icon, and actions.
 * 
 * Usage:
 * ```tsx
 * <PageHeader
 *   title="Tasks"
 *   icon="📋"
 *   subtitle="Manage your daily tasks"
 *   actions={[
 *     { label: "Add", icon: "➕", onClick: handleAdd, variant: "primary" },
 *     { label: "Filter", icon: "🔍", onClick: handleFilter }
 *   ]}
 * />
 * 
 * <PageHeader title="Settings" backButton onBack={() => navigate(-1)} />
 * ```
 */

import React, { ReactNode, CSSProperties } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, SHADOW } from '../../constants/design-tokens';
import { Button, ButtonVariant } from './Button';

export interface PageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
}

export interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  subtitle?: string;
  actions?: PageHeaderAction[];
  backButton?: boolean;
  onBack?: () => void;
  sticky?: boolean;
  gradient?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  icon,
  subtitle,
  actions,
  backButton = false,
  onBack,
  sticky = false,
  gradient = false,
  children,
  style,
  className,
}) => {
  const { theme } = useTheme();

  const headerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING[3],
    padding: `${SPACING[4]} ${SPACING[6]}`,
    background: gradient
      ? `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`
      : theme.colors.cardBg,
    borderRadius: sticky ? 0 : RADIUS.lg,
    boxShadow: sticky ? SHADOW.sm : 'none',
    borderBottom: sticky ? `1px solid ${theme.colors.cardBorder}` : 'none',
    ...(sticky && {
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }),
    ...style,
  };

  const textColor = gradient ? 'white' : theme.colors.text;
  const subtitleColor = gradient ? 'rgba(255,255,255,0.8)' : theme.colors.textLight;

  return (
    <div className={className} style={headerStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: SPACING[3],
        }}
      >
        {/* Left side: Back button, icon, title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[3] }}>
          {backButton && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: textColor,
                padding: SPACING[1],
                borderRadius: RADIUS.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = gradient 
                  ? 'rgba(255,255,255,0.2)' 
                  : theme.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
              aria-label="Go back"
            >
              ←
            </button>
          )}

          {icon && (
            <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>
              {icon}
            </span>
          )}

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                color: textColor,
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  margin: 0,
                  marginTop: SPACING[1],
                  fontSize: '0.875rem',
                  color: subtitleColor,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right side: Actions */}
        {actions && actions.length > 0 && (
          <div style={{ display: 'flex', gap: SPACING[2], flexWrap: 'wrap' }}>
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || (gradient ? 'secondary' : 'primary')}
                onClick={action.onClick}
                icon={action.icon}
                disabled={action.disabled}
                size="sm"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Optional children for additional content (tabs, filters, etc.) */}
      {children}
    </div>
  );
};

export default PageHeader;
