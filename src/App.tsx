/**
 * Main App Component
 * 
 * Root component that manages:
 * - Navigation between different views
 * - Theme and user context providers
 * - About and Settings modals
 * - View state management
 * 
 * The app uses context providers for theme and user settings
 * which allows all child components to access and modify
 * these settings consistently.
 */

import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MobileHeaderProvider } from './contexts/MobileHeaderContext';
import { VoiceCommandPrefillProvider, useVoiceCommandPrefill } from './contexts/VoiceCommandPrefillContext';
import { useUserLevel } from './hooks/useUserLevel';

// Auto-retry dynamic imports: on chunk 404 (stale deploy), reload once
function lazyWithRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err: any) => {
      const key = 'chunk_reload_ts';
      const last = Number(sessionStorage.getItem(key) || '0');
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
      throw err;
    }),
  );
}

// Lazy-loaded views for code splitting (PERF-001)
const TodayView = lazyWithRetry(() => import('./TodayView'));
const TasksAndEventsView = lazyWithRetry(() => import('./TasksAndEventsView'));
const JournalView = lazyWithRetry(() => import('./JournalView'));
const AnalyticsView = lazyWithRetry(() => import('./AnalyticsView'));
const SettingsView = lazyWithRetry(() => import('./SettingsView'));
const ItemsView = lazyWithRetry(() => import('./ItemsView'));
const SafeView = lazyWithRetry(() => import('./SafeView'));
const TimerView = lazyWithRetry(() => import('./TimerView'));
const ResolutionsView = lazyWithRetry(() => import('./ResolutionsView'));
const TodoView = lazyWithRetry(() => import('./TodoView'));
const SmartView = lazyWithRetry(() => import('./SmartView'));
const GroupsManager = lazyWithRetry(() => import('./components/GroupsManager'));
const VoiceCommandHistory = lazyWithRetry(() => import('./components/VoiceCommand/VoiceCommandHistory'));
const AIHistoryView = lazyWithRetry(() => import('./components/ai/AIHistoryView'));

// Eagerly loaded components (small, frequently used)
import SpeedDialFAB from './components/SpeedDialFAB';
import PinnedModal from './components/PinnedModal';
import GiftCardsModal from './components/GiftCardsModal';
import MilestonesModal from './components/MilestonesModal';
import AboutModal from './components/AboutModal';
import SettingsModal from './components/SettingsModal';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OnboardingFlow from './components/OnboardingFlow';
import AuthModal from './components/AuthModal';
import FeaturesPage from './components/FeaturesPage';
import MobileBottomNav from './components/MobileBottomNav';
import MobileBottomSheet from './components/MobileBottomSheet';
import MobileContextHeader from './components/MobileContextHeader';
import VoiceCommandButton from './components/VoiceCommand/VoiceCommandButton';
import { isFirstTimeUser, markOnboardingComplete } from './storage';
import { loadSampleTasks } from './utils/sampleData';
import { ParsedCommand } from './services/voice/types';
import DemoBanner from './components/DemoBanner';
import { VoiceCommandLog } from './types/voice-command-db.types';

// Loading fallback for lazy-loaded views
const ViewLoader: React.FC = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
    color: '#6b7280'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🦁</div>
      <div>Loading...</div>
    </div>
  </div>
);

// Error boundary: catches chunk-load failures and offers manual reload
class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '50vh', color: '#374151',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>New version available</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              The app was updated since your last visit. A quick reload will fix this.
            </div>
            <button
              onClick={() => {
                sessionStorage.setItem('chunk_reload_ts', String(Date.now()));
                window.location.reload();
              }}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: '1px solid #111', background: '#111', color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type View = 'today' | 'tasks-events' | 'items' | 'journal' | 'resolutions' | 'analytics' | 'settings' | 'safe' | 'todo' | 'groups' | 'smart' | 'history' | 'voice-pending' | 'ai-history';

/**
 * Main App Content Component
 * Separated from App to allow access to context hooks
 */
const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('today');
  const [key, setKey] = useState(0); // Used to force refresh of views
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false); // Disabled - go directly to login
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFeaturesPage, setShowFeaturesPage] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [showGiftCardsModal, setShowGiftCardsModal] = useState(false);
  const [showMilestonesModal, setShowMilestonesModal] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [tasksEventsInitialTab, setTasksEventsInitialTab] = useState<'tasks' | 'events' | 'routines' | 'items' | 'resolutions'>('tasks');
  const [showVoiceAddModal, setShowVoiceAddModal] = useState(false);
  const [journalPrefillContent, setJournalPrefillContent] = useState<string | undefined>();
  const [journalPrefillMood, setJournalPrefillMood] = useState<'great' | 'good' | 'okay' | 'bad' | 'terrible' | undefined>();
  const { theme } = useTheme();
  const { avatar, username } = useUser();
  const { features, loading: levelLoading } = useUserLevel();
  const { user, loading: authLoading, isAuthenticated, error: authError } = useAuth();

  // Clear localStorage and test Supabase connection on mount
  useEffect(() => {
    const initialize = async () => {
      // Clear old localStorage data (user must use Supabase now)
      const { clearLocalStorage } = await import('./storage');
      clearLocalStorage();
      
      // Keep-alive ping to prevent Supabase from pausing (free tier)
      if (isAuthenticated) {
        const { checkAndPingKeepAlive } = await import('./services/keepAliveService');
        checkAndPingKeepAlive().catch(err => console.warn('Keep-alive ping failed:', err));
      }
      
      // Initialize notifications
      if (isAuthenticated) {
        const { initializeNotifications } = await import('./services/notificationService');
        initializeNotifications().catch(err => console.warn('Notification init failed:', err));
      }
      
      // Uncomment to test Supabase connection (verbose logging)
      // if (import.meta.env.DEV) {
      //   const { testSupabaseConnection } = await import('./utils/testSupabase');
      //   await testSupabaseConnection();
      // }
    };
    
    initialize();
  }, [isAuthenticated]);

  // Show auth modal if user is not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !showOnboarding) {
      setShowAuthModal(true);
    }
  }, [authLoading, isAuthenticated, showOnboarding]);

  // Refresh the current view when switching back to it
  const handleNavigate = (view: View | string) => {
    // Handle aliases for tasks-events view with specific tabs
    if (view === 'configure' || view === 'tasks') {
      setTasksEventsInitialTab('tasks');
      setCurrentView('tasks-events');
    } else if (view === 'events') {
      setTasksEventsInitialTab('events');
      setCurrentView('tasks-events');
    } else if (view === 'routines') {
      setTasksEventsInitialTab('routines');
      setCurrentView('tasks-events');
    } else {
      setCurrentView(view as View);
    }
    setKey(prev => prev + 1); // Force re-render of the view
  };

  // Handle voice command prefill and navigate to appropriate view
  const handleVoicePrefillAndNavigate = useCallback((parsed: ParsedCommand) => {
    const intentType = parsed.intent.type;
    const getEntity = (type: string) => parsed.entities.find(e => e.type === type);
    
    // Map intent to view and prefill data
    switch (intentType) {
      case 'CREATE_JOURNAL': {
        // Extract mood from transcript
        const transcript = parsed.transcript.toLowerCase();
        let mood: typeof journalPrefillMood = undefined;
        if (/great|amazing|fantastic|wonderful/.test(transcript)) mood = 'great';
        else if (/good|happy|fine|nice/.test(transcript)) mood = 'good';
        else if (/okay|ok|alright|so-so|meh/.test(transcript)) mood = 'okay';
        else if (/bad|sad|down|upset/.test(transcript)) mood = 'bad';
        else if (/terrible|awful|horrible|depressed/.test(transcript)) mood = 'terrible';
        
        setJournalPrefillMood(mood);
        // Extract content from entities if available, otherwise use transcript
        const titleEntity = getEntity('TITLE');
        let content = titleEntity ? String(titleEntity.normalizedValue || titleEntity.value) : parsed.transcript;
        
        // Remove trigger phrases and use rest as content
        const journalPrefixes = ['journal', 'note to self', 'write in my journal', 'dear diary', 'today', 'create journal', 'new journal'];
        for (const prefix of journalPrefixes) {
          const lowerContent = content.toLowerCase();
          if (lowerContent.startsWith(prefix)) {
            content = content.substring(prefix.length).replace(/^[:\s,]+/, '').trim();
            break;
          }
        }
        // Ensure we have content - if empty after processing, use the original transcript
        if (!content || content.trim().length === 0) {
          content = parsed.transcript;
        }
        setJournalPrefillContent(content.trim());
        handleNavigate('journal');
        break;
      }
      case 'CREATE_TASK':
      case 'CREATE_EVENT':
        // Navigate to tasks-events with the initial tab
        setTasksEventsInitialTab(intentType === 'CREATE_TASK' ? 'tasks' : 'events');
        // TODO: Add prefill data to TasksAndEventsView
        handleNavigate('tasks-events');
        break;
      case 'CREATE_TODO':
        handleNavigate('todo');
        break;
      case 'CREATE_ITEM':
        setTasksEventsInitialTab('items');
        handleNavigate('tasks-events');
        break;
      case 'CREATE_ROUTINE':
        setTasksEventsInitialTab('routines');
        handleNavigate('tasks-events');
        break;
      case 'CREATE_MILESTONE':
        setShowMilestonesModal(true);
        break;
      default:
        // Default to today view
        handleNavigate('today');
    }
  }, []);

  // Handle creating from voice history
  const handleCreateFromVoiceHistory = useCallback((command: VoiceCommandLog) => {
    // Convert VoiceCommandLog to ParsedCommand-like structure for navigation
    const intentType = command.intentType;
    
    switch (intentType) {
      case 'CREATE_JOURNAL':
        setJournalPrefillContent(command.rawTranscript || '');
        handleNavigate('journal');
        break;
      case 'CREATE_TASK':
      case 'CREATE_EVENT':
        setTasksEventsInitialTab(intentType === 'CREATE_TASK' ? 'tasks' : 'events');
        handleNavigate('tasks-events');
        break;
      case 'CREATE_TODO':
        handleNavigate('todo');
        break;
      default:
        handleNavigate('today');
    }
  }, []);

  // Handle onboarding completion
  const handleOnboardingComplete = async (loadSamples: boolean) => {
    markOnboardingComplete();
    setShowOnboarding(false);
    
    // After onboarding, show auth modal if not signed in
    if (!isAuthenticated) {
      setShowAuthModal(true);
    }
    
    // Note: Sample tasks loading not supported in Supabase mode
    // Users should create tasks manually or import from file
    if (loadSamples) {
      alert('Sample tasks loading is not available. Please create your own tasks or use the import feature!');
    }
  };

  // Check authentication and show auth modal if needed (disabled for now - manual trigger only)
  // useEffect(() => {
  //   if (!authLoading && !isAuthenticated && !showOnboarding) {
  //     const timer = setTimeout(() => {
  //       setShowAuthModal(true);
  //     }, 500);
  //     return () => clearTimeout(timer);
  //   }
  // }, [authLoading, isAuthenticated, showOnboarding]);

  // Listen for storage changes (e.g., from another tab)
  // Only refresh on specific key changes to avoid unnecessary refreshes
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const handleStorageChange = (e: StorageEvent) => {
      // Only refresh if it's a meaningful change from another tab
      // Storage events only fire for OTHER tabs/windows, not the current one
      if (e.key && (
        e.key.includes('user-settings') || 
        e.key.includes('theme') ||
        e.key.includes('onboarding')
      )) {
        // Clear any pending refresh
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // Debounce rapid changes (increased to 500ms to reduce unnecessary refreshes)
        timeoutId = setTimeout(() => {
          setKey(prev => prev + 1);
          timeoutId = null;
        }, 500);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'today':
        return <TodayView key={`today-${key}`} onNavigate={handleNavigate} />;
      case 'tasks-events':
        return <TasksAndEventsView key={`tasks-events-${key}`} onNavigate={handleNavigate} initialTab={tasksEventsInitialTab} />;
      case 'items':
        return <ItemsView key={`items-${key}`} onNavigate={handleNavigate} />;
      case 'journal':
        return (
          <JournalView 
            key={`journal-${key}`}
            prefillContent={journalPrefillContent}
            prefillMood={journalPrefillMood}
            onPrefillUsed={() => {
              setJournalPrefillContent(undefined);
              setJournalPrefillMood(undefined);
            }}
          />
        );
      case 'resolutions':
        return <ResolutionsView key={`resolutions-${key}`} />;
      case 'analytics':
        return <AnalyticsView key={`analytics-${key}`} />;
      case 'settings':
        return <SettingsView key={`settings-${key}`} />;
      case 'safe':
        return <SafeView key={`safe-${key}`} />;
      case 'todo':
        return <TodoView key={`todo-${key}`} />;
      case 'groups':
        return <GroupsManager key={`groups-${key}`} onClose={() => handleNavigate('today')} />;
      case 'smart':
        return (
          <SmartView
            key={`smart-${key}`}
            onNavigate={handleNavigate}
            onVoicePrefillAndNavigate={handleVoicePrefillAndNavigate}
            onCreateFromVoiceHistory={handleCreateFromVoiceHistory}
            userId={user?.id}
          />
        );
      case 'history':
        return (
          <VoiceCommandHistory 
            key={`history-${key}`} 
            listMode="all"
            onBack={() => handleNavigate('smart')} 
            onCreateFromCommand={handleCreateFromVoiceHistory}
            userId={user?.id}
          />
        );
      case 'voice-pending':
        return (
          <VoiceCommandHistory 
            key={`voice-pending-${key}`} 
            listMode="pending"
            onBack={() => handleNavigate('smart')} 
            onOpenFullHistory={() => handleNavigate('history')}
            onCreateFromCommand={handleCreateFromVoiceHistory}
            userId={user?.id}
          />
        );
      case 'ai-history':
        return <AIHistoryView key={`ai-history-${key}`} onBack={() => handleNavigate('settings')} />;
      default:
        return <TodayView key={`today-${key}`} onNavigate={handleNavigate} />;
    }
  };

  // Show error message if auth failed
  if (authError && !authLoading) {
    return (
      <div 
        className="app" 
        style={{ 
          background: `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh'
        }}
      >
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '500px',
          margin: '1rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>Connection Error</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            {authError}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                background: theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Try Again
            </button>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '1.5rem' }}>
            If this problem persists, please contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="app" 
      style={{ 
        background: `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`
      }}
    >
      <header className="header">
        <div className="header-top-row">
          <div className="header-left">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🦁</span>
                <h1 style={{ margin: 0 }}>Leo Planner</h1>
              </div>
              <p style={{ 
                fontSize: '0.75rem', 
                margin: 0, 
                opacity: 0.85,
                fontStyle: 'italic',
                paddingLeft: '2.25rem'
              }}>
                Plan with the strength of a lion
              </p>
            </div>
            <div className="user-badge" title={username}>
              <span className="user-avatar">{avatar.emoji}</span>
              <span className="user-name">{username}</span>
            </div>
          </div>
          {features.isDemo && (
            <DemoBanner levelIcon={features.levelIcon} levelName={features.levelName} />
          )}
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={() => handleNavigate('analytics')}
              title="Analytics & Reports"
              style={{ color: currentView === 'analytics' ? theme.colors.primary : theme.colors.primary }}
            >
              📊
            </button>
            <button
              className="icon-button"
              onClick={() => handleNavigate('settings')}
              title="Settings & Configuration"
              style={{ color: theme.colors.primary }}
            >
              ⚙️
            </button>
            <button
              className="icon-button"
              onClick={() => setShowAbout(true)}
              title="About Leo Planner"
              style={{ color: theme.colors.primary }}
            >
              ℹ️
            </button>
            {isAuthenticated && user ? (
              <button
                className="icon-button"
                onClick={async () => {
                  if (confirm('Are you sure you want to sign out?')) {
                    const { signOut } = await import('./lib/supabase');
                    await signOut();
                  }
                }}
                title={`Sign Out (${user.email || 'User'})`}
                style={{ color: theme.colors.primary }}
              >
                🚪
              </button>
            ) : !authLoading ? (
              <button
                className="icon-button"
                onClick={() => setShowAuthModal(true)}
                title="Sign In / Sign Up"
                style={{ color: theme.colors.primary }}
              >
                🔑
              </button>
            ) : null}
          </div>
        </div>
        <div className="header-nav-row">
          <nav className="nav">
            <button
              className={`nav-button ${currentView === 'today' ? 'active' : ''}`}
              onClick={() => handleNavigate('today')}
              title="Home"
              style={currentView === 'today' ? { backgroundColor: theme.colors.primary } : {}}
            >
              <span className="nav-icon">🏠</span>
              <span className="nav-text">Home</span>
            </button>
            <button
              className={`nav-button ${currentView === 'tasks-events' ? 'active' : ''}`}
              onClick={() => handleNavigate('tasks-events')}
              title="Tasks & Events"
              style={currentView === 'tasks-events' ? { backgroundColor: theme.colors.primary } : {}}
            >
              <span className="nav-icon">➕</span>
              <span className="nav-text">New</span>
            </button>
            <button
              className={`nav-button ${currentView === 'journal' ? 'active' : ''}`}
              onClick={() => handleNavigate('journal')}
              title="Journal"
              style={currentView === 'journal' ? { backgroundColor: theme.colors.primary } : {}}
            >
              <span className="nav-icon">📔</span>
              <span className="nav-text">Journal</span>
            </button>
            {!features.isDemo && (
              <button
                className={`nav-button ${currentView === 'smart' ? 'active' : ''}`}
                onClick={() => handleNavigate('smart')}
                title="Smart Features - Voice & Image Scanning"
                style={currentView === 'smart' ? { backgroundColor: theme.colors.primary } : {}}
              >
                <span className="nav-icon">✨</span>
                <span className="nav-text">Smart</span>
              </button>
            )}
            {features.canUseSafe && (
              <button
                className={`nav-button ${currentView === 'safe' ? 'active' : ''}`}
                onClick={() => handleNavigate('safe')}
                title="Vault - Encrypted Password Manager & Financial Records"
                style={currentView === 'safe' ? { backgroundColor: theme.colors.primary } : {}}
              >
                <span className="nav-icon">🔒</span>
                <span className="nav-text">Vault</span>
              </button>
            )}
          </nav>
          <div className="header-right-desktop">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div className="user-badge" title={username}>
                <span className="user-avatar">{avatar.emoji}</span>
                <span className="user-name">{username}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="icon-button"
                  onClick={() => handleNavigate('analytics')}
                  title="Analytics & Reports"
                  style={{ color: theme.colors.primary }}
                >
                  📊
                </button>
                <button
                  className="icon-button"
                  onClick={() => handleNavigate('settings')}
                  title="Settings & Configuration"
                  style={{ color: theme.colors.primary }}
                >
                  ⚙️
                </button>
                <button
                  className="icon-button"
                  onClick={() => setShowAbout(true)}
                  title="About Leo Planner"
                  style={{ color: theme.colors.primary }}
                >
                  ℹ️
                </button>
                {isAuthenticated && user ? (
                  <button
                    className="icon-button"
                    onClick={async () => {
                      if (confirm('Are you sure you want to sign out?')) {
                        const { signOut } = await import('./lib/supabase');
                        await signOut();
                      }
                    }}
                    title={`Sign Out (${user.email || 'User'})`}
                    style={{ color: theme.colors.primary }}
                  >
                    🚪
                  </button>
                ) : !authLoading ? (
                  <button
                    className="icon-button"
                    onClick={() => setShowAuthModal(true)}
                    title="Sign In / Sign Up"
                    style={{ color: theme.colors.primary }}
                  >
                    🔑
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="header-mic-row">
          <VoiceCommandButton 
            onPrefillAndNavigate={handleVoicePrefillAndNavigate}
            onCreateFromHistory={handleCreateFromVoiceHistory}
            userId={user?.id}
            onNavigateToHistory={() => handleNavigate('history')}
          />
        </div>
      </header>
      {/* Mobile Context Header - only visible on mobile */}
      <MobileContextHeader 
        currentView={currentView}
        showBack={currentView !== 'today'}
        onBack={() => handleNavigate('today')}
      />

      <main className="main-content">
        <ChunkErrorBoundary>
          <Suspense fallback={<ViewLoader />}>
            {renderView()}
          </Suspense>
        </ChunkErrorBoundary>
      </main>

      {/* Modals */}
      <AboutModal show={showAbout} onClose={() => setShowAbout(false)} />
      <SettingsModal show={showSettings} onClose={() => setShowSettings(false)} />
      
      {/* Authentication Modal */}
      {showAuthModal && !showFeaturesPage && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            setKey(prev => prev + 1);
          }}
          onShowFeatures={() => {
            setShowAuthModal(false);
            setShowFeaturesPage(true);
          }}
        />
      )}

      {/* Features Page */}
      {showFeaturesPage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          <FeaturesPage
            onBackToLogin={() => {
              setShowFeaturesPage(false);
              setShowAuthModal(true);
            }}
          />
        </div>
      )}
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Onboarding Flow */}
      {showOnboarding && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}

      {/* SpeedDial FAB - Consolidates Timer, Gift Cards, Milestones, Pinned */}
      <SpeedDialFAB
        actions={[
          { id: 'timer', icon: '⏱️', label: 'Timer', onClick: () => setShowTimerModal(true) },
          { id: 'giftcards', icon: '🎁', label: 'Gift Cards', onClick: () => setShowGiftCardsModal(true) },
          { id: 'milestones', icon: '🎯', label: 'Milestones', onClick: () => setShowMilestonesModal(true) },
          { id: 'pinned', icon: '📌', label: 'Pinned', onClick: () => setShowPinnedModal(true) },
        ]}
      />

      {/* Timer Modal */}
      {showTimerModal && (
        <div className="modal-overlay active" onClick={() => setShowTimerModal(false)}>
          <div className="modal timer-modal" onClick={(e) => e.stopPropagation()}>
            <Suspense fallback={<ViewLoader />}>
              <TimerView key={`timer-${key}`} onClose={() => setShowTimerModal(false)} />
            </Suspense>
          </div>
        </div>
      )}

      {/* Gift Cards Modal */}
      {showGiftCardsModal && (
        <div className="modal-overlay active" onClick={() => setShowGiftCardsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <GiftCardsModal onClose={() => setShowGiftCardsModal(false)} onNavigate={(v) => { setShowGiftCardsModal(false); handleNavigate(v); }} />
          </div>
        </div>
      )}

      {/* Milestones Modal */}
      {showMilestonesModal && (
        <div className="modal-overlay active" onClick={() => setShowMilestonesModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <MilestonesModal onClose={() => setShowMilestonesModal(false)} onNavigate={(v) => { setShowMilestonesModal(false); handleNavigate(v); }} />
          </div>
        </div>
      )}

      {/* Pinned Modal */}
      {showPinnedModal && (
        <div className="modal-overlay active" onClick={() => setShowPinnedModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <PinnedModal onClose={() => setShowPinnedModal(false)} onNavigate={(v) => { setShowPinnedModal(false); handleNavigate(v); }} />
          </div>
        </div>
      )}

      {/* Voice Add Modal (for mobile "+" menu) */}
      {showVoiceAddModal && (
        <VoiceCommandButton 
          isModalMode={true}
          onClose={() => setShowVoiceAddModal(false)}
          onSuccess={(msg) => {
            setShowVoiceAddModal(false);
            setKey(prev => prev + 1);
          }}
          onPrefillAndNavigate={(parsed) => {
            setShowVoiceAddModal(false);
            handleVoicePrefillAndNavigate(parsed);
          }}
          onCreateFromHistory={(cmd) => {
            setShowVoiceAddModal(false);
            handleCreateFromVoiceHistory(cmd);
          }}
          userId={user?.id}
          onNavigateToHistory={() => {
            setShowVoiceAddModal(false);
            handleNavigate('history');
          }}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        onAddClick={() => setShowAddSheet(true)}
        onMoreClick={() => setShowMoreSheet(true)}
      />

      {/* Mobile Add Bottom Sheet */}
      <MobileBottomSheet
        isOpen={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title={features.isDemo ? "View Demo (Read-Only)" : "Add New"}
        options={[
          features.canUseAI && {
            icon: '✨',
            label: 'Smart Scan',
            description: 'AI-powered image analysis',
            onClick: () => handleNavigate('smart'),
          },
          features.canAddTodos && {
            icon: '📝',
            label: 'My Lists',
            description: 'Quick grouped to-do items',
            onClick: () => handleNavigate('todo'),
            primary: true,
          },
          features.canAddTasks && {
            icon: '✅',
            label: 'Task',
            description: 'Scheduled task or habit',
            onClick: () => {
              setTasksEventsInitialTab('tasks');
              handleNavigate('tasks-events');
            },
          },
          features.canAddEvents && {
            icon: '📅',
            label: 'Event',
            description: 'Calendar event or reminder',
            onClick: () => {
              setTasksEventsInitialTab('events');
              handleNavigate('tasks-events');
            },
          },
          features.canAddItems && {
            icon: '📦',
            label: 'Item',
            description: 'Track an item or resource',
            onClick: () => handleNavigate('items'),
          },
          features.canAddTasks && {
            icon: '🔄',
            label: 'Routine',
            description: 'Recurring habit or routine',
            onClick: () => {
              setTasksEventsInitialTab('routines');
              handleNavigate('tasks-events');
            },
          },
          !features.isDemo && {
            icon: '🎯',
            label: 'Resolution',
            description: 'Goal or resolution',
            onClick: () => {
              setTasksEventsInitialTab('resolutions');
              handleNavigate('tasks-events');
            },
          },
        ].filter(Boolean)}
      />

      {/* Mobile More Bottom Sheet */}
      <MobileBottomSheet
        isOpen={showMoreSheet}
        onClose={() => setShowMoreSheet(false)}
        title="More Options"
        options={[
          {
            icon: '✅',
            label: 'My Lists',
            description: 'Manage your to-do items',
            onClick: () => handleNavigate('todo'),
          },
          {
            icon: '🤖',
            label: 'AI History',
            description: 'View AI spending & transactions',
            onClick: () => handleNavigate('ai-history'),
          },
          {
            icon: '⏱️',
            label: 'Timer',
            description: 'Focus timer and stopwatch',
            onClick: () => setShowTimerModal(true),
          },
          {
            icon: '🎁',
            label: 'Gift Cards',
            description: 'Manage gift cards',
            onClick: () => setShowGiftCardsModal(true),
          },
          {
            icon: '🏆',
            label: 'Milestones',
            description: 'Track important milestones',
            onClick: () => setShowMilestonesModal(true),
          },
          {
            icon: '📌',
            label: 'Pinned',
            description: 'Quick access items',
            onClick: () => setShowPinnedModal(true),
          },
          {
            icon: '📊',
            label: 'Analytics',
            description: 'Reports & insights',
            onClick: () => handleNavigate('analytics'),
          },
          {
            icon: '⚙️',
            label: 'Settings',
            description: 'App settings and preferences',
            onClick: () => handleNavigate('settings'),
          },
          {
            icon: 'ℹ️',
            label: 'About',
            description: 'About Leo Planner',
            onClick: () => setShowAbout(true),
          },
          ...(isAuthenticated ? [{
            icon: '🚪',
            label: 'Sign Out',
            description: `Signed in as ${user?.email || 'User'}`,
            onClick: async () => {
              if (confirm('Are you sure you want to sign out?')) {
                const { signOut } = await import('./lib/supabase');
                await signOut();
              }
            },
          }] : [{
            icon: '🔑',
            label: 'Sign In',
            description: 'Sign in to sync your data',
            onClick: () => setShowAuthModal(true),
          }]),
        ]}
      />
    </div>
  );
};

/**
 * App Wrapper Component
 * Wraps the app with necessary providers
 */
const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <UserProvider>
          <MobileHeaderProvider>
            <AppContent />
          </MobileHeaderProvider>
        </UserProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;

