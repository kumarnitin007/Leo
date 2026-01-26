/**
 * Mobile Context Header Component
 * 
 * Sticky header for mobile showing current context, date, and progress
 */

import React from 'react';

interface MobileContextHeaderProps {
  title: string;
  subtitle: string;
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
}

const MobileContextHeader: React.FC<MobileContextHeaderProps> = ({
  title,
  subtitle,
  progress,
}) => {
  return (
    <div className="mobile-context-header">
      <h1 className="mobile-header-title">{title}</h1>
      <p className="mobile-header-subtitle">{subtitle}</p>
      
      {progress && (
        <div className="mobile-header-progress">
          <div className="mobile-progress-text">
            Progress: {progress.percentage}% ({progress.completed}/{progress.total} completed)
          </div>
          <div className="mobile-progress-bar">
            <div 
              className="mobile-progress-fill" 
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileContextHeader;
