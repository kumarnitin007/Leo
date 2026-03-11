/**
 * Loading / Spinner Components
 * 
 * Consistent loading indicators for the app.
 * 
 * Usage:
 * ```tsx
 * <Spinner />
 * <Spinner size="lg" color="primary" />
 * 
 * <LoadingOverlay message="Saving..." />
 * 
 * <PageLoader />
 * ```
 */

import React, { CSSProperties } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, Z_INDEX } from '../../constants/design-tokens';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'primary' | 'secondary' | 'white' | 'muted';

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  style?: CSSProperties;
  className?: string;
}

const sizeMap: Record<SpinnerSize, string> = {
  xs: '12px',
  sm: '16px',
  md: '24px',
  lg: '32px',
  xl: '48px',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  style,
  className,
}) => {
  const { theme } = useTheme();

  const getColor = (): string => {
    switch (color) {
      case 'primary': return theme.colors.primary;
      case 'secondary': return theme.colors.secondary;
      case 'white': return '#ffffff';
      case 'muted': return theme.colors.textLight;
      default: return theme.colors.primary;
    }
  };

  const dimension = sizeMap[size];
  const borderWidth = size === 'xs' || size === 'sm' ? '2px' : '3px';

  return (
    <>
      <style>
        {`
          @keyframes spinnerRotate {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div
        className={className}
        style={{
          width: dimension,
          height: dimension,
          border: `${borderWidth} solid ${getColor()}20`,
          borderTopColor: getColor(),
          borderRadius: '50%',
          animation: 'spinnerRotate 0.75s linear infinite',
          ...style,
        }}
        role="status"
        aria-label="Loading"
      />
    </>
  );
};

// ============ LOADING OVERLAY ============
export interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
  style?: CSSProperties;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message,
  fullScreen = false,
  style,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        position: fullScreen ? 'fixed' : 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING[3],
        background: fullScreen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(2px)',
        zIndex: fullScreen ? Z_INDEX.modal : 10,
        ...style,
      }}
    >
      <Spinner size="lg" />
      {message && (
        <p style={{
          margin: 0,
          color: theme.colors.text,
          fontWeight: 500,
        }}>
          {message}
        </p>
      )}
    </div>
  );
};

// ============ PAGE LOADER ============
export interface PageLoaderProps {
  message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ message = 'Loading...' }) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        padding: SPACING[8],
        gap: SPACING[4],
      }}
    >
      <Spinner size="xl" />
      <p style={{
        margin: 0,
        color: theme.colors.textLight,
        fontSize: '1.125rem',
      }}>
        {message}
      </p>
    </div>
  );
};

// ============ SKELETON LOADER ============
export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: CSSProperties;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = '4px',
  style,
  className,
}) => {
  const { theme } = useTheme();

  return (
    <>
      <style>
        {`
          @keyframes skeletonPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
      <div
        className={className}
        style={{
          width,
          height,
          borderRadius,
          background: theme.colors.cardBorder,
          animation: 'skeletonPulse 1.5s ease-in-out infinite',
          ...style,
        }}
      />
    </>
  );
};

// ============ SKELETON TEXT ============
export interface SkeletonTextProps {
  lines?: number;
  lastLineWidth?: string;
  spacing?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lastLineWidth = '60%',
  spacing = SPACING[2],
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          height="1rem"
        />
      ))}
    </div>
  );
};

export default Spinner;
