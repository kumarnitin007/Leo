/**
 * Card Component
 * 
 * A flexible container component for grouping related content.
 * Uses design tokens for consistent styling.
 * 
 * Usage:
 * ```tsx
 * <Card>Basic card content</Card>
 * 
 * <Card variant="elevated" padding="lg">
 *   <Card.Header>Title</Card.Header>
 *   <Card.Body>Content</Card.Body>
 *   <Card.Footer>Actions</Card.Footer>
 * </Card>
 * ```
 */

import React, { ReactNode, CSSProperties } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SHADOW, SPACING } from '../../constants/design-tokens';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'ghost' | 'gradient';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  hoverable?: boolean;
  fullWidth?: boolean;
}

const paddingMap: Record<CardPadding, string> = {
  none: '0',
  sm: SPACING[2],
  md: SPACING[4],
  lg: SPACING[6],
};

export const Card: React.FC<CardProps> & {
  Header: typeof CardHeader;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
} = ({
  children,
  variant = 'default',
  padding = 'md',
  onClick,
  className,
  style,
  hoverable = false,
  fullWidth = false,
}) => {
  const { theme } = useTheme();

  const getVariantStyles = (): CSSProperties => {
    const baseStyles: CSSProperties = {
      borderRadius: RADIUS.lg,
      padding: paddingMap[padding],
      transition: 'all 0.2s ease',
      width: fullWidth ? '100%' : undefined,
    };

    switch (variant) {
      case 'elevated':
        return {
          ...baseStyles,
          background: theme.colors.cardBg,
          boxShadow: SHADOW.md,
          border: 'none',
        };
      case 'outlined':
        return {
          ...baseStyles,
          background: 'transparent',
          boxShadow: 'none',
          border: `1px solid ${theme.colors.cardBorder}`,
        };
      case 'ghost':
        return {
          ...baseStyles,
          background: 'transparent',
          boxShadow: 'none',
          border: 'none',
        };
      case 'gradient':
        return {
          ...baseStyles,
          background: `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`,
          boxShadow: SHADOW.md,
          border: theme.gradient.textColor ? `1px solid ${theme.colors.cardBorder}` : 'none',
          color: theme.gradient.textColor || 'white',
        };
      default:
        return {
          ...baseStyles,
          background: theme.colors.cardBg,
          boxShadow: SHADOW.sm,
          border: `1px solid ${theme.colors.cardBorder}`,
        };
    }
  };

  const hoverStyles: CSSProperties = hoverable || onClick ? {
    cursor: 'pointer',
  } : {};

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        ...getVariantStyles(),
        ...hoverStyles,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable || onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = SHADOW.lg;
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable || onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = variant === 'elevated' ? SHADOW.md : SHADOW.sm;
        }
      }}
    >
      {children}
    </div>
  );
};

// Card.Header sub-component
interface CardHeaderProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const CardHeader: React.FC<CardHeaderProps> = ({ children, style, className }) => {
  const { theme } = useTheme();
  
  return (
    <div
      className={className}
      style={{
        paddingBottom: SPACING[3],
        marginBottom: SPACING[3],
        borderBottom: `1px solid ${theme.colors.cardBorder}`,
        fontWeight: 600,
        fontSize: '1.125rem',
        color: theme.colors.text,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Card.Body sub-component
interface CardBodyProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const CardBody: React.FC<CardBodyProps> = ({ children, style, className }) => {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
};

// Card.Footer sub-component
interface CardFooterProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'space-between';
}

const CardFooter: React.FC<CardFooterProps> = ({ 
  children, 
  style, 
  className,
  align = 'right' 
}) => {
  const { theme } = useTheme();
  
  const alignMap: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
    'space-between': 'space-between',
  };
  
  return (
    <div
      className={className}
      style={{
        paddingTop: SPACING[3],
        marginTop: SPACING[3],
        borderTop: `1px solid ${theme.colors.cardBorder}`,
        display: 'flex',
        justifyContent: alignMap[align],
        alignItems: 'center',
        gap: SPACING[2],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Attach sub-components
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
