/**
 * Button Component
 * 
 * A flexible button component with multiple variants and states.
 * Uses design tokens for consistent styling.
 * 
 * Usage:
 * ```tsx
 * <Button>Default</Button>
 * <Button variant="primary">Primary</Button>
 * <Button variant="danger" size="sm">Delete</Button>
 * <Button loading>Saving...</Button>
 * <Button icon="✓" iconPosition="left">Confirm</Button>
 * ```
 */

import React, { ReactNode, CSSProperties, ButtonHTMLAttributes } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SHADOW, SPACING, TRANSITION } from '../../constants/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: CSSProperties;
}

const sizeMap: Record<ButtonSize, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: `${SPACING[1]} ${SPACING[2]}`, fontSize: '0.875rem', height: '32px' },
  md: { padding: `${SPACING[2]} ${SPACING[4]}`, fontSize: '1rem', height: '40px' },
  lg: { padding: `${SPACING[3]} ${SPACING[6]}`, fontSize: '1.125rem', height: '48px' },
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const getVariantStyles = (): CSSProperties => {
    const baseStyles: CSSProperties = {
      borderRadius: RADIUS.md,
      border: 'none',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.6 : 1,
      fontWeight: 600,
      transition: TRANSITION.fast,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING[2],
      width: fullWidth ? '100%' : undefined,
      ...sizeMap[size],
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
          color: 'white',
          boxShadow: SHADOW.sm,
        };
      case 'secondary':
        return {
          ...baseStyles,
          background: theme.colors.cardBg,
          color: theme.colors.text,
          border: `1px solid ${theme.colors.cardBorder}`,
        };
      case 'danger':
        return {
          ...baseStyles,
          background: theme.colors.danger,
          color: 'white',
          boxShadow: SHADOW.sm,
        };
      case 'success':
        return {
          ...baseStyles,
          background: theme.colors.success,
          color: 'white',
          boxShadow: SHADOW.sm,
        };
      case 'ghost':
        return {
          ...baseStyles,
          background: 'transparent',
          color: theme.colors.text,
        };
      case 'outline':
        return {
          ...baseStyles,
          background: 'transparent',
          color: theme.colors.primary,
          border: `2px solid ${theme.colors.primary}`,
        };
      default:
        return baseStyles;
    }
  };

  const LoadingSpinner = () => (
    <span
      style={{
        display: 'inline-block',
        width: '1em',
        height: '1em',
        border: '2px solid currentColor',
        borderRightColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.75s linear infinite',
      }}
    />
  );

  return (
    <>
      <style>
        {`@keyframes spin { to { transform: rotate(360deg); } }`}
      </style>
      <button
        disabled={isDisabled}
        style={{
          ...getVariantStyles(),
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = SHADOW.md;
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = variant === 'ghost' || variant === 'outline' ? 'none' : SHADOW.sm;
          }
        }}
        {...props}
      >
        {loading && <LoadingSpinner />}
        {!loading && icon && iconPosition === 'left' && <span>{icon}</span>}
        {children}
        {!loading && icon && iconPosition === 'right' && <span>{icon}</span>}
      </button>
    </>
  );
};

export default Button;
