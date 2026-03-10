/**
 * Features Page - Showcase app features before login
 * Responsive design: compact cards on mobile, detailed grid on desktop
 */

import React from 'react';

interface FeaturesPageProps {
  onBackToLogin: () => void;
}

const FEATURES = [
  {
    icon: '📋',
    title: 'Smart Tasks',
    description: 'Organize daily tasks with priorities, tags, and recurring schedules',
    color: '#3B82F6',
  },
  {
    icon: '🔒',
    title: 'Password Safe',
    description: 'AES-256 encrypted vault for passwords, notes, and sensitive documents',
    color: '#10B981',
  },
  {
    icon: '🏦',
    title: 'Financial Tracker',
    description: 'Track FDs, bank accounts, bills, and set savings goals',
    color: '#8B5CF6',
  },
  {
    icon: '📅',
    title: 'Calendar & Events',
    description: 'Plan events, set reminders, and never miss important dates',
    color: '#F59E0B',
  },
  {
    icon: '📓',
    title: 'Daily Journal',
    description: 'Capture thoughts, mood, and reflections with rich formatting',
    color: '#EC4899',
  },
  {
    icon: '⏱️',
    title: 'Focus Timer',
    description: 'Pomodoro-style timer to boost productivity and track focus time',
    color: '#EF4444',
  },
  {
    icon: '🎯',
    title: 'Goals & Resolutions',
    description: 'Set yearly goals with milestones and track your progress',
    color: '#06B6D4',
  },
  {
    icon: '👨‍👩‍👧‍👦',
    title: 'Family Sharing',
    description: 'Share financial info securely with family via encrypted group chat',
    color: '#0D9488',
  },
  {
    icon: '🌙',
    title: 'Dark Mode',
    description: 'Easy on the eyes with automatic or manual dark theme',
    color: '#6366F1',
  },
  {
    icon: '📱',
    title: 'Mobile First',
    description: 'Fully responsive design that works great on any device',
    color: '#14B8A6',
  },
];

const FeaturesPage: React.FC<FeaturesPageProps> = ({ onBackToLogin }) => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: isMobile ? '1rem' : '2rem',
      boxSizing: 'border-box',
    }}>
      {/* Back Button - Fixed at top */}
      <button
        onClick={onBackToLogin}
        style={{
          position: 'fixed',
          top: isMobile ? '0.75rem' : '1.5rem',
          left: isMobile ? '0.75rem' : '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: isMobile ? '0.5rem 1rem' : '0.75rem 1.5rem',
          background: 'rgba(255,255,255,0.95)',
          border: 'none',
          borderRadius: '2rem',
          cursor: 'pointer',
          fontSize: isMobile ? '0.9rem' : '1rem',
          fontWeight: 600,
          color: '#667eea',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          zIndex: 100,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
        }}
      >
        ← {isMobile ? 'Login' : 'Back to Login'}
      </button>

      {/* Header */}
      <div style={{
        textAlign: 'center',
        color: '#fff',
        marginTop: isMobile ? '3.5rem' : '1rem',
        marginBottom: isMobile ? '1.5rem' : '2rem',
      }}>
        <div style={{ fontSize: isMobile ? '3rem' : '4rem', marginBottom: '0.5rem' }}>🦁</div>
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? '1.75rem' : '2.5rem',
          fontWeight: 800,
          textShadow: '0 2px 10px rgba(0,0,0,0.2)',
        }}>
          Leo - Your Life Organizer
        </h1>
        <p style={{
          margin: '0.5rem 0 0 0',
          fontSize: isMobile ? '1rem' : '1.25rem',
          opacity: 0.9,
        }}>
          Everything you need to organize your day, secure your data, and track your goals
        </p>
      </div>

      {/* Features Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: isMobile ? '0.75rem' : '1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
        paddingBottom: isMobile ? '5rem' : '2rem',
      }}>
        {FEATURES.map((feature, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: isMobile ? '0.75rem' : '1rem',
              padding: isMobile ? '1rem' : '1.5rem',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: isMobile ? 'center' : 'flex-start',
              gap: isMobile ? '1rem' : '0',
              flexDirection: isMobile ? 'row' : 'column',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isMobile) {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isMobile) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
              }
            }}
          >
            {/* Icon */}
            <div style={{
              width: isMobile ? '48px' : '56px',
              height: isMobile ? '48px' : '56px',
              borderRadius: '12px',
              background: `${feature.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '1.5rem' : '2rem',
              flexShrink: 0,
            }}>
              {feature.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
              <h3 style={{
                margin: isMobile ? '0' : '1rem 0 0.5rem 0',
                fontSize: isMobile ? '1rem' : '1.15rem',
                fontWeight: 700,
                color: '#1F2937',
              }}>
                {feature.title}
              </h3>
              {!isMobile && (
                <p style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: '#6B7280',
                  lineHeight: 1.5,
                }}>
                  {feature.description}
                </p>
              )}
            </div>

            {/* Mobile: Show description as subtitle */}
            {isMobile && (
              <div style={{
                position: 'absolute',
                display: 'none', // Hidden on mobile for compact view
              }}>
                {feature.description}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: Fixed bottom CTA */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '1rem',
          background: 'linear-gradient(to top, rgba(102,126,234,1) 0%, rgba(102,126,234,0.95) 80%, transparent 100%)',
          paddingTop: '2rem',
        }}>
          <button
            onClick={onBackToLogin}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#fff',
              border: 'none',
              borderRadius: '0.75rem',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#667eea',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            }}
          >
            Get Started →
          </button>
        </div>
      )}

      {/* Desktop: Bottom CTA */}
      {!isMobile && (
        <div style={{
          textAlign: 'center',
          marginTop: '2rem',
        }}>
          <button
            onClick={onBackToLogin}
            style={{
              padding: '1rem 3rem',
              background: '#fff',
              border: 'none',
              borderRadius: '2rem',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#667eea',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Get Started - It's Free →
          </button>
        </div>
      )}
    </div>
  );
};

export default FeaturesPage;
