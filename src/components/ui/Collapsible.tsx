/**
 * Collapsible / Accordion Component
 * 
 * Expandable sections for organizing content, reducing visual complexity.
 * Perfect for long forms, settings, and grouped content.
 * 
 * Usage:
 * ```tsx
 * // Single collapsible section
 * <Collapsible title="Advanced Settings" defaultOpen={false}>
 *   <Input label="API Key" />
 *   <Input label="Webhook URL" />
 * </Collapsible>
 * 
 * // Accordion (only one open at a time)
 * <Accordion>
 *   <Accordion.Item title="Basic Info" icon="📝">
 *     <Input label="Name" />
 *   </Accordion.Item>
 *   <Accordion.Item title="Security" icon="🔐">
 *     <Input label="Password" type="password" />
 *   </Accordion.Item>
 * </Accordion>
 * ```
 */

import React, { ReactNode, CSSProperties, useState, useRef, useEffect, createContext, useContext } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, TRANSITION } from '../../constants/design-tokens';
import { haptic } from '../../utils/haptic';

// ============ COLLAPSIBLE ============
export interface CollapsibleProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  onToggle?: (isOpen: boolean) => void;
}

export const Collapsible: React.FC<CollapsibleProps> = ({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
  disabled = false,
  style,
  className,
  onToggle,
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>(defaultOpen ? 'auto' : 0);

  useEffect(() => {
    if (contentRef.current) {
      if (isOpen) {
        setContentHeight(contentRef.current.scrollHeight);
        const timer = setTimeout(() => setContentHeight('auto'), 200);
        return () => clearTimeout(timer);
      } else {
        setContentHeight(contentRef.current.scrollHeight);
        requestAnimationFrame(() => setContentHeight(0));
      }
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    haptic.light();
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <div
      className={className}
      style={{
        borderRadius: RADIUS.lg,
        border: `1px solid ${theme.colors.cardBorder}`,
        background: theme.colors.cardBg,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: `${SPACING[3]} ${SPACING[4]}`,
          background: isOpen ? theme.colors.background : 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: TRANSITION.fast,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[2] }}>
          {icon && <span style={{ fontSize: '1.125rem' }}>{icon}</span>}
          <span style={{ fontWeight: 600, color: theme.colors.text }}>{title}</span>
          {badge !== undefined && (
            <span
              style={{
                padding: `${SPACING[0.5]} ${SPACING[2]}`,
                background: theme.colors.primary,
                color: 'white',
                borderRadius: RADIUS.full,
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <span
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: TRANSITION.fast,
            color: theme.colors.textLight,
            fontSize: '0.75rem',
          }}
        >
          ▼
        </span>
      </button>

      {/* Content */}
      <div
        style={{
          height: contentHeight,
          overflow: 'hidden',
          transition: 'height 0.2s ease-out',
        }}
      >
        <div ref={contentRef} style={{ padding: SPACING[4], paddingTop: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ============ ACCORDION ============
interface AccordionContextValue {
  openIndex: number | null;
  setOpenIndex: (index: number | null) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

export interface AccordionProps {
  children: ReactNode;
  defaultIndex?: number;
  allowMultiple?: boolean;
  style?: CSSProperties;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> & {
  Item: typeof AccordionItem;
} = ({
  children,
  defaultIndex,
  allowMultiple = false,
  style,
  className,
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultIndex ?? null);

  return (
    <AccordionContext.Provider value={{ openIndex, setOpenIndex }}>
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING[2],
          ...style,
        }}
      >
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<AccordionItemProps & { index: number }>, {
              index,
            });
          }
          return child;
        })}
      </div>
    </AccordionContext.Provider>
  );
};

// ============ ACCORDION ITEM ============
interface AccordionItemProps extends Omit<CollapsibleProps, 'defaultOpen' | 'onToggle'> {
  index?: number;
}

const AccordionItem: React.FC<AccordionItemProps> = ({
  index = 0,
  ...props
}) => {
  const context = useContext(AccordionContext);
  
  if (!context) {
    return <Collapsible {...props} />;
  }

  const { openIndex, setOpenIndex } = context;
  const isOpen = openIndex === index;

  return (
    <Collapsible
      {...props}
      defaultOpen={isOpen}
      onToggle={(open) => {
        setOpenIndex(open ? index : null);
      }}
    />
  );
};

// Attach sub-component
Accordion.Item = AccordionItem;

export default Collapsible;
