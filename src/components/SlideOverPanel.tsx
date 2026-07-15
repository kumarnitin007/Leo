/**
 * SlideOverPanel
 *
 * Shared right-side slide-over drawer used for create/edit forms across
 * Tasks, Events, Routines, Items and Goals. On desktop it slides in from the
 * right and keeps the underlying list visible; on mobile it becomes a
 * full-height bottom sheet.
 */

import React, { useEffect, useState } from 'react';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Desktop panel max width in px. */
  width?: number;
}

const SlideOverPanel: React.FC<SlideOverPanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 560,
}) => {
  const [mounted, setMounted] = useState(isOpen);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    if (isOpen) {
      setMounted(true);
      raf = requestAnimationFrame(() => setEntered(true));
    } else {
      setEntered(false);
      timer = window.setTimeout(() => setMounted(false), 300);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return (
    <div className={`slideover-root ${entered ? 'open' : ''}`}>
      <div className="slideover-backdrop" onClick={onClose} />
      <div
        className="slideover-panel"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="slideover-header">
          <h3 className="slideover-title">{title}</h3>
          <button className="slideover-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="slideover-body">{children}</div>
      </div>
    </div>
  );
};

export default SlideOverPanel;
