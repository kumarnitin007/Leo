/**
 * Onboarding Flow Component
 * 
 * First-time user experience with:
 * - Welcome screen (single popup)
 */

import React from 'react';

interface OnboardingFlowProps {
  onComplete: (loadSampleTasks: boolean) => void;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const handleGetStarted = () => {
    onComplete(false); // Always pass false - no sample loading from onboarding
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      overflow: 'auto'
    }}>
      <div style={{
        maxWidth: '700px',
        width: '100%',
        background: 'white',
        borderRadius: '24px',
        padding: '3rem',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        position: 'relative'
      }}>
        {/* Skip button */}
        <button
          onClick={handleGetStarted}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '0.5rem',
            fontWeight: 600
          }}
        >
          Skip →
        </button>

        {/* Welcome Screen - Single Popup */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>👋</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '3rem' }}>🦁</span>
            <h1 style={{
              fontSize: '2.5rem',
              margin: 0,
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Welcome to Leo Planner!
            </h1>
          </div>
          <p style={{
            fontSize: '1.25rem',
            color: '#14b8a6',
            fontStyle: 'italic',
            fontWeight: 600,
            marginBottom: '0.5rem'
          }}>
            Plan with the strength of a lion 🦁✨
          </p>
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280',
            lineHeight: 1.7,
            marginBottom: '2rem'
          }}>
            Leo Planner helps you organize your day with confidence and clarity. 
            Track tasks, manage events, and stay on top of your schedule with the power and precision of a lion!
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2.5rem',
            textAlign: 'left'
          }}>
            <div style={{
              padding: '1.5rem',
              background: '#f0f9ff',
              borderRadius: '12px',
              border: '2px solid #bae6fd'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem', color: '#0c4a6e' }}>
                Simple Task Management
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#075985' }}>
                Create, organize, and complete your daily tasks with ease
              </p>
            </div>

            <div style={{
              padding: '1.5rem',
              background: '#fef3c7',
              borderRadius: '12px',
              border: '2px solid #fde68a'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem', color: '#78350f' }}>
                Track Your Progress
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#92400e' }}>
                Visualize streaks, completion rates, and patterns
              </p>
            </div>

            <div style={{
              padding: '1.5rem',
              background: '#f0fdf4',
              borderRadius: '12px',
              border: '2px solid #bbf7d0'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏱️</div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem', color: '#14532d' }}>
                Focus Timer
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#166534' }}>
                Built-in countdown timer for deep focus sessions
              </p>
            </div>
          </div>

          <button
            onClick={handleGetStarted}
            style={{
              width: '100%',
              padding: '1rem 2rem',
              fontSize: '1.125rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)'
            }}
          >
            Get Started →
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;

