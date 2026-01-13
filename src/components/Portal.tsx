/**
 * Portal Component
 * 
 * Renders children into a DOM node that exists outside the parent component's DOM hierarchy.
 * This is essential for modals to ensure they're positioned correctly relative to the viewport
 * and not affected by parent container overflow or positioning.
 * 
 * Usage:
 * ```tsx
 * <Portal>
 *   <YourModal />
 * </Portal>
 * ```
 */

import React, { useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
}

/**
 * Portal component that renders children to document.body
 */
const Portal: React.FC<PortalProps> = ({ children }) => {
  const portalRoot = document.body;

  useEffect(() => {
    // Prevent body scroll when portal is mounted (for modals)
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  return createPortal(children, portalRoot);
};

export default Portal;

