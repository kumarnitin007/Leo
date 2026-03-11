/**
 * Input Components
 * 
 * Flexible form input components with consistent styling.
 * Includes Input, TextArea, Select, and Checkbox.
 * 
 * Usage:
 * ```tsx
 * <Input placeholder="Enter name" />
 * <Input type="email" label="Email" error="Invalid email" />
 * <TextArea rows={4} placeholder="Description..." />
 * <Select options={[{value: '1', label: 'One'}]} />
 * <Checkbox checked={agree} onChange={setAgree} label="I agree" />
 * ```
 */

import React, { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, CSSProperties, forwardRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, TRANSITION } from '../../constants/design-tokens';

// ============ INPUT ============
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style' | 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  style?: CSSProperties;
  containerStyle?: CSSProperties;
}

const inputSizeMap: Record<string, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: `${SPACING[1]} ${SPACING[2]}`, fontSize: '0.875rem', height: '32px' },
  md: { padding: `${SPACING[2]} ${SPACING[3]}`, fontSize: '1rem', height: '40px' },
  lg: { padding: `${SPACING[3]} ${SPACING[4]}`, fontSize: '1.125rem', height: '48px' },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  size = 'md',
  fullWidth = true,
  style,
  containerStyle,
  disabled,
  ...props
}, ref) => {
  const { theme } = useTheme();
  const hasError = !!error;

  const inputStyle: CSSProperties = {
    width: fullWidth ? '100%' : undefined,
    borderRadius: RADIUS.md,
    border: `1px solid ${hasError ? theme.colors.danger : theme.colors.cardBorder}`,
    background: disabled ? theme.colors.background : theme.colors.cardBg,
    color: theme.colors.text,
    transition: TRANSITION.fast,
    outline: 'none',
    paddingLeft: leftIcon ? '2.5rem' : undefined,
    paddingRight: rightIcon ? '2.5rem' : undefined,
    ...inputSizeMap[size],
    ...style,
  };

  return (
    <div style={{ width: fullWidth ? '100%' : undefined, ...containerStyle }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: SPACING[1],
          fontWeight: 500,
          fontSize: '0.875rem',
          color: theme.colors.text,
        }}>
          {label}
        </label>
      )}
      
      <div style={{ position: 'relative' }}>
        {leftIcon && (
          <span style={{
            position: 'absolute',
            left: SPACING[3],
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.colors.textLight,
            pointerEvents: 'none',
          }}>
            {leftIcon}
          </span>
        )}
        
        <input
          ref={ref}
          disabled={disabled}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = hasError ? theme.colors.danger : theme.colors.primary;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${hasError ? theme.colors.danger : theme.colors.primary}20`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = hasError ? theme.colors.danger : theme.colors.cardBorder;
            e.currentTarget.style.boxShadow = 'none';
          }}
          {...props}
        />
        
        {rightIcon && (
          <span style={{
            position: 'absolute',
            right: SPACING[3],
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.colors.textLight,
          }}>
            {rightIcon}
          </span>
        )}
      </div>
      
      {(error || hint) && (
        <p style={{
          marginTop: SPACING[1],
          fontSize: '0.875rem',
          color: error ? theme.colors.danger : theme.colors.textLight,
        }}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// ============ TEXTAREA ============
export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
  style?: CSSProperties;
  containerStyle?: CSSProperties;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
  label,
  error,
  hint,
  fullWidth = true,
  style,
  containerStyle,
  disabled,
  rows = 4,
  ...props
}, ref) => {
  const { theme } = useTheme();
  const hasError = !!error;

  const textareaStyle: CSSProperties = {
    width: fullWidth ? '100%' : undefined,
    borderRadius: RADIUS.md,
    border: `1px solid ${hasError ? theme.colors.danger : theme.colors.cardBorder}`,
    background: disabled ? theme.colors.background : theme.colors.cardBg,
    color: theme.colors.text,
    transition: TRANSITION.fast,
    outline: 'none',
    padding: SPACING[3],
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'inherit',
    ...style,
  };

  return (
    <div style={{ width: fullWidth ? '100%' : undefined, ...containerStyle }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: SPACING[1],
          fontWeight: 500,
          fontSize: '0.875rem',
          color: theme.colors.text,
        }}>
          {label}
        </label>
      )}
      
      <textarea
        ref={ref}
        disabled={disabled}
        rows={rows}
        style={textareaStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = hasError ? theme.colors.danger : theme.colors.primary;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${hasError ? theme.colors.danger : theme.colors.primary}20`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = hasError ? theme.colors.danger : theme.colors.cardBorder;
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...props}
      />
      
      {(error || hint) && (
        <p style={{
          marginTop: SPACING[1],
          fontSize: '0.875rem',
          color: error ? theme.colors.danger : theme.colors.textLight,
        }}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

TextArea.displayName = 'TextArea';

// ============ SELECT ============
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'style' | 'size'> {
  options: SelectOption[];
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  style?: CSSProperties;
  containerStyle?: CSSProperties;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  options,
  label,
  error,
  hint,
  placeholder,
  size = 'md',
  fullWidth = true,
  style,
  containerStyle,
  disabled,
  ...props
}, ref) => {
  const { theme } = useTheme();
  const hasError = !!error;

  const selectStyle: CSSProperties = {
    width: fullWidth ? '100%' : undefined,
    borderRadius: RADIUS.md,
    border: `1px solid ${hasError ? theme.colors.danger : theme.colors.cardBorder}`,
    background: disabled ? theme.colors.background : theme.colors.cardBg,
    color: theme.colors.text,
    transition: TRANSITION.fast,
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `right ${SPACING[3]} center`,
    paddingRight: '2.5rem',
    ...inputSizeMap[size],
    ...style,
  };

  return (
    <div style={{ width: fullWidth ? '100%' : undefined, ...containerStyle }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: SPACING[1],
          fontWeight: 500,
          fontSize: '0.875rem',
          color: theme.colors.text,
        }}>
          {label}
        </label>
      )}
      
      <select
        ref={ref}
        disabled={disabled}
        style={selectStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = hasError ? theme.colors.danger : theme.colors.primary;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${hasError ? theme.colors.danger : theme.colors.primary}20`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = hasError ? theme.colors.danger : theme.colors.cardBorder;
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...props}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      
      {(error || hint) && (
        <p style={{
          marginTop: SPACING[1],
          fontSize: '0.875rem',
          color: error ? theme.colors.danger : theme.colors.textLight,
        }}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

// ============ CHECKBOX ============
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'style'> {
  label?: string;
  description?: string;
  style?: CSSProperties;
  containerStyle?: CSSProperties;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  description,
  style,
  containerStyle,
  disabled,
  ...props
}, ref) => {
  const { theme } = useTheme();

  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: SPACING[2],
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      ...containerStyle,
    }}>
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        style={{
          width: '18px',
          height: '18px',
          accentColor: theme.colors.primary,
          cursor: disabled ? 'not-allowed' : 'pointer',
          marginTop: '2px',
          ...style,
        }}
        {...props}
      />
      {(label || description) && (
        <div>
          {label && (
            <span style={{ fontWeight: 500, color: theme.colors.text }}>
              {label}
            </span>
          )}
          {description && (
            <p style={{
              margin: 0,
              marginTop: SPACING[0.5],
              fontSize: '0.875rem',
              color: theme.colors.textLight,
            }}>
              {description}
            </p>
          )}
        </div>
      )}
    </label>
  );
});

Checkbox.displayName = 'Checkbox';

export default Input;
