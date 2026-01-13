/**
 * Smart Coach Section Component
 * 
 * Collapsible section for AI-powered task insights and recommendations
 */

import React, { useState } from 'react';
import SmartCoachAlert from './SmartCoachAlert';
import { TaskInsight } from '../services/aiInsights';

interface SmartCoachSectionProps {
  insight: TaskInsight | null;
  onApply: () => void;
  onDismiss: () => void;
  collapsed?: boolean;
}

const SmartCoachSection: React.FC<SmartCoachSectionProps> = ({
  insight,
  onApply,
  onDismiss,
  collapsed = true
}) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  if (!insight) {
    return null;
  }

  // If not collapsed (modal view), show without wrapper
  if (!collapsed) {
    return (
      <SmartCoachAlert
        insight={insight}
        onApply={onApply}
        onDismiss={onDismiss}
      />
    );
  }

  // Collapsible inline view
  return (
    <div className="smart-coach-section" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '2rem',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      color: 'white'
    }}>
      <div 
        className="smart-coach-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🤖</span>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'white'
            }}>
              Smart Coach Insights
            </h3>
            <p style={{ 
              margin: '0.25rem 0 0 0', 
              fontSize: '0.875rem',
              opacity: 0.9,
              color: 'white'
            }}>
              AI-powered recommendations to improve your productivity
            </p>
          </div>
        </div>
        <button
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0.5rem 0.75rem',
            transition: 'all 0.2s',
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
        >
          ▼
        </button>
      </div>

      {!isCollapsed && (
        <div style={{ marginTop: '1rem' }}>
          <SmartCoachAlert
            insight={insight}
            onApply={onApply}
            onDismiss={onDismiss}
          />
        </div>
      )}
    </div>
  );
};

export default SmartCoachSection;

