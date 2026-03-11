/**
 * EmptyState Component
 * 
 * Displays a friendly message when content is empty.
 * Encourages user action with optional CTA button.
 * 
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon="📋"
 *   title="No tasks yet"
 *   description="Create your first task to get started"
 *   action={{ label: "Create Task", onClick: handleCreate }}
 * />
 * 
 * <EmptyState
 *   icon="🔍"
 *   title="No results found"
 *   description="Try adjusting your search or filters"
 * />
 * ```
 */

import React, { ReactNode, CSSProperties } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING } from '../../constants/design-tokens';
import { Button } from './Button';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: ReactNode;
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
  className?: string;
}

const sizeMap = {
  sm: { iconSize: '2rem', titleSize: '1rem', descSize: '0.875rem', padding: SPACING[4] },
  md: { iconSize: '3rem', titleSize: '1.25rem', descSize: '1rem', padding: SPACING[6] },
  lg: { iconSize: '4rem', titleSize: '1.5rem', descSize: '1.125rem', padding: SPACING[8] },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  style,
  className,
}) => {
  const { theme } = useTheme();
  const sizes = sizeMap[size];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: sizes.padding,
        borderRadius: RADIUS.lg,
        background: theme.colors.background,
        border: `1px dashed ${theme.colors.cardBorder}`,
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            fontSize: sizes.iconSize,
            marginBottom: SPACING[3],
            lineHeight: 1,
          }}
        >
          {icon}
        </div>
      )}

      <h3
        style={{
          margin: 0,
          fontSize: sizes.titleSize,
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: description || action ? SPACING[2] : 0,
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            margin: 0,
            fontSize: sizes.descSize,
            color: theme.colors.textLight,
            maxWidth: '400px',
            marginBottom: action ? SPACING[4] : 0,
          }}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            gap: SPACING[3],
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {action && (
            <Button
              variant={action.variant || 'primary'}
              onClick={action.onClick}
              icon={action.icon}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant || 'secondary'}
              onClick={secondaryAction.onClick}
              icon={secondaryAction.icon}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
