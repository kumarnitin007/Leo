/**
 * Mobile Bottom Navigation Component
 * 
 * Provides persistent bottom navigation bar for mobile devices
 * with Home, Safe, Journal, Add (FAB), and More options
 */

import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onAddClick: () => void;
  onMoreClick: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onAddClick,
  onMoreClick,
}) => {
  const { theme } = useTheme();

  return (
    <div className="mobile-bottom-nav">
      <button
        className={`bottom-nav-btn ${currentView === 'today' ? 'active' : ''}`}
        onClick={() => onNavigate('today')}
        aria-label="Dashboard"
      >
        <span className="bottom-nav-icon">🏠</span>
        <span className="bottom-nav-label">Home</span>
      </button>

      <button
        className={`bottom-nav-btn ${currentView === 'safe' ? 'active' : ''}`}
        onClick={() => onNavigate('safe')}
        aria-label="Safe"
      >
        <span className="bottom-nav-icon">🔒</span>
        <span className="bottom-nav-label">Safe</span>
      </button>

      <button
        className="bottom-nav-fab"
        onClick={onAddClick}
        aria-label="Add New"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})` }}
      >
        <span className="fab-icon">+</span>
      </button>

      <button
        className={`bottom-nav-btn ${currentView === 'journal' ? 'active' : ''}`}
        onClick={() => onNavigate('journal')}
        aria-label="Journal"
      >
        <span className="bottom-nav-icon">📔</span>
        <span className="bottom-nav-label">Journal</span>
      </button>

      <button
        className="bottom-nav-btn"
        onClick={onMoreClick}
        aria-label="More Options"
      >
        <span className="bottom-nav-icon">⋯</span>
        <span className="bottom-nav-label">More</span>
      </button>
    </div>
  );
};

export default MobileBottomNav;
