/**
 * Smart Coach Alert Component
 * 
 * Displays AI-powered recommendations for underperforming tasks
 * on the Today dashboard. Helps users adapt their goals based on
 * actual completion patterns.
 */

import React, { useState } from 'react';
import { TaskInsight, Recommendation, applyRecommendation, dismissInsight } from '../services/aiInsights';

interface SmartCoachAlertProps {
  insight: TaskInsight;
  onApply: () => void; // Callback to refresh data after applying
  onDismiss: () => void; // Callback to hide this alert
}

const SmartCoachAlert: React.FC<SmartCoachAlertProps> = ({ insight, onApply, onDismiss }) => {
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyRecommendation = async (recommendation: Recommendation) => {
    setIsApplying(true);
    
    const success = applyRecommendation(insight.taskId, recommendation);
    
    if (success) {
      // Show success message briefly
      alert(`✅ Applied: ${recommendation.actionLabel}\n\nYour task has been updated. We'll monitor the improvement over the next 2 weeks!`);
      onApply();
    } else {
      alert('❌ Failed to apply recommendation. Please try again.');
    }
    
    setIsApplying(false);
  };

  const handleDismiss = () => {
    dismissInsight(insight.taskId);
    onDismiss();
  };

  return (
    <div style={{
      color: 'white'
    }}>
      {/* Dismiss Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          onClick={handleDismiss}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
        >
          Dismiss for 7 days
        </button>
      </div>

      {/* Task Performance Summary */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1rem',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
            📊 {insight.taskName}
          </h4>
          <span style={{
            background: insight.currentMetrics.completionRate < 20 ? '#ef4444' : '#f59e0b',
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: '700'
          }}>
            {insight.currentMetrics.completionRate}% Completion
          </span>
        </div>
        
        <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.95, lineHeight: '1.5' }}>
          You've completed this task <strong>{insight.currentMetrics.completedCount} of {insight.currentMetrics.attemptedCount} times</strong> over the last {insight.currentMetrics.weeksAnalyzed} weeks.
        </p>
      </div>

      {/* Recommendations */}
      <div>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          💡 Recommended Adjustments:
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {insight.recommendations.slice(0, 3).map((recommendation, index) => (
            <div
              key={index}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>
                      {recommendation.type === 'reduce_frequency' && '🔄'}
                      {recommendation.type === 'change_days' && '📅'}
                      {recommendation.type === 'pause' && '⏸️'}
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '600', opacity: 0.95 }}>
                      {recommendation.reason}
                    </span>
                  </div>
                  
                  <p style={{
                    margin: '0.5rem 0 0 2rem',
                    fontSize: '0.85rem',
                    opacity: 0.9,
                    fontStyle: 'italic'
                  }}>
                    Expected: {recommendation.expectedImprovement}
                  </p>
                </div>
                
                <button
                  onClick={() => handleApplyRecommendation(recommendation)}
                  disabled={isApplying}
                  style={{
                    background: 'white',
                    color: '#667eea',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    cursor: isApplying ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    opacity: isApplying ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isApplying) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                  }}
                >
                  {isApplying ? 'Applying...' : recommendation.actionLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confidence Note */}
      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        fontSize: '0.85rem',
        opacity: 0.9,
        lineHeight: '1.5'
      }}>
        💭 <strong>Note:</strong> These suggestions are based on your completion patterns over the last {insight.currentMetrics.weeksAnalyzed} weeks. 
        You can always adjust them further in the Configure tab.
      </div>
    </div>
  );
};

export default SmartCoachAlert;

