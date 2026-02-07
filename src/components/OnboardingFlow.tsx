/**
 * Onboarding Flow Component
 * 
 * First-time user experience with:
 * - Welcome screen (single popup)
 * - Mobile responsive design
 */

import React from 'react';

interface OnboardingFlowProps {
  onComplete: (loadSampleTasks: boolean) => void;
}

const FEATURES = [
  {
    icon: '🎤',
    title: 'Voice Commands',
    description: 'Create tasks, events & todos with your voice',
    bg: '#faf5ff',
    border: '#e9d5ff',
    titleColor: '#581c87',
    textColor: '#7c3aed'
  },
  {
    icon: '🔒',
    title: 'Password Safe',
    description: 'Securely store passwords & documents',
    bg: '#fef2f2',
    border: '#fecaca',
    titleColor: '#991b1b',
    textColor: '#dc2626'
  },
  {
    icon: '👨‍👩‍👧‍👦',
    title: 'Family Sharing',
    description: 'Share tasks & passwords with family groups',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    titleColor: '#14532d',
    textColor: '#166534'
  },
  {
    icon: '📝',
    title: 'Quick List Item',
    description: 'Fast, simple to-do lists for quick notes',
    bg: '#f0f9ff',
    border: '#bae6fd',
    titleColor: '#0c4a6e',
    textColor: '#075985'
  },
  {
    icon: '📔',
    title: 'Daily Journal',
    description: 'Reflect on your day with mood tracking',
    bg: '#fef3c7',
    border: '#fde68a',
    titleColor: '#78350f',
    textColor: '#92400e'
  },
  {
    icon: '📊',
    title: 'Analytics',
    description: 'Track streaks, patterns & productivity',
    bg: '#ecfeff',
    border: '#a5f3fc',
    titleColor: '#164e63',
    textColor: '#0891b2'
  },
];

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const handleGetStarted = () => {
    onComplete(false);
  };

  return (
    <>
      <style>{`
        .onboarding-overlay {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          overflow: auto;
        }
        
        .onboarding-card {
          max-width: 600px;
          width: 100%;
          background: white;
          border-radius: 1.5rem;
          padding: 2rem 1.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          position: relative;
          max-height: 95vh;
          overflow-y: auto;
        }
        
        @media (min-width: 640px) {
          .onboarding-card {
            padding: 2.5rem;
            border-radius: 1.75rem;
          }
        }
        
        .onboarding-skip {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 0.8rem;
          cursor: pointer;
          padding: 0.5rem;
          font-weight: 600;
        }
        
        .onboarding-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        
        .onboarding-wave {
          font-size: 2.5rem;
          margin-bottom: 0.75rem;
        }
        
        @media (min-width: 640px) {
          .onboarding-wave {
            font-size: 3rem;
            margin-bottom: 1rem;
          }
        }
        
        .onboarding-title-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }
        
        .onboarding-lion {
          font-size: 2rem;
        }
        
        @media (min-width: 640px) {
          .onboarding-lion {
            font-size: 2.5rem;
          }
        }
        
        .onboarding-title {
          font-size: 1.5rem;
          margin: 0;
          background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
        }
        
        @media (min-width: 640px) {
          .onboarding-title {
            font-size: 2rem;
          }
        }
        
        .onboarding-tagline {
          font-size: 1rem;
          color: #14b8a6;
          font-style: italic;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        
        .onboarding-desc {
          font-size: 0.9rem;
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }
        
        @media (min-width: 640px) {
          .onboarding-desc {
            font-size: 1rem;
          }
        }
        
        .onboarding-features {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }
        
        @media (min-width: 480px) {
          .onboarding-features {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (min-width: 640px) {
          .onboarding-features {
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
          }
        }
        
        .feature-card {
          padding: 1rem;
          border-radius: 0.75rem;
          border-width: 2px;
          border-style: solid;
          text-align: left;
        }
        
        .feature-icon {
          font-size: 1.5rem;
          margin-bottom: 0.25rem;
        }
        
        .feature-title {
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
          font-weight: 600;
        }
        
        .feature-desc {
          font-size: 0.75rem;
          line-height: 1.4;
        }
        
        .onboarding-btn {
          width: 100%;
          padding: 0.875rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
          color: white;
          border: none;
          border-radius: 0.75rem;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(20, 184, 166, 0.4);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .onboarding-btn:active {
          transform: scale(0.98);
        }
        
        @media (min-width: 640px) {
          .onboarding-btn {
            padding: 1rem 2rem;
            font-size: 1.125rem;
          }
        }
      `}</style>
      
      <div className="onboarding-overlay">
        <div className="onboarding-card">
          <button className="onboarding-skip" onClick={handleGetStarted}>
            Skip →
          </button>

          <div className="onboarding-header">
            <div className="onboarding-wave">👋</div>
            <div className="onboarding-title-row">
              <span className="onboarding-lion">🦁</span>
              <h1 className="onboarding-title">Welcome to Leo!</h1>
            </div>
            <p className="onboarding-tagline">Plan with the strength of a lion 🦁✨</p>
            <p className="onboarding-desc">
              Your all-in-one productivity companion. Manage tasks, store passwords securely, 
              journal your thoughts, and share with family — all by voice or touch.
            </p>
          </div>

          <div className="onboarding-features">
            {FEATURES.map((feature, index) => (
              <div
                key={index}
                className="feature-card"
                style={{
                  background: feature.bg,
                  borderColor: feature.border,
                }}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title" style={{ color: feature.titleColor }}>
                  {feature.title}
                </h3>
                <p className="feature-desc" style={{ color: feature.textColor }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <button className="onboarding-btn" onClick={handleGetStarted}>
            Get Started →
          </button>
        </div>
      </div>
    </>
  );
};

export default OnboardingFlow;

