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

import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VoiceCommandPrefillProvider, useVoiceCommandPrefill } from './contexts/VoiceCommandPrefillContext';
import TodayView from './TodayView';
import TasksAndEventsView from './TasksAndEventsView';
import JournalView from './JournalView';
import AnalyticsView from './AnalyticsView';
import SettingsView from './SettingsView';
import ItemsView from './ItemsView';
import SafeView from './SafeView';
import TimerView from './TimerView';
import ResolutionsView from './ResolutionsView';
import FloatingTimerButton from './components/FloatingTimerButton';
import FloatingGiftCardsButton from './components/FloatingGiftCardsButton';
import FloatingMilestonesButton from './components/FloatingMilestonesButton';
import FloatingPinnedButton from './components/FloatingPinnedButton';
import PinnedModal from './components/PinnedModal';
import GiftCardsModal from './components/GiftCardsModal';
import MilestonesModal from './components/MilestonesModal';
import AboutModal from './components/AboutModal';
import SettingsModal from './components/SettingsModal';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OnboardingFlow from './components/OnboardingFlow';
import AuthModal from './components/AuthModal';
import MobileBottomNav from './components/MobileBottomNav';
import MobileBottomSheet from './components/MobileBottomSheet';
import VoiceCommandButton from './components/VoiceCommand/VoiceCommandButton';
import { isFirstTimeUser, markOnboardingComplete } from './storage';
import { loadSampleTasks } from './utils/sampleData';
import TodoView from './TodoView';
import GroupsManager from './components/GroupsManager';
import { ParsedCommand } from './services/voice/types';
import { VoiceCommandLog } from './types/voice-command-db.types';

type View = 'today' | 'tasks-events' | 'items' | 'journal' | 'resolutions' | 'analytics' | 'settings' | 'safe' | 'todo' | 'groups';

/**
 * Main App Content Component
 * Separated from App to allow access to context hooks
 */
const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('today');
  const [key, setKey] = useState(0); // Used to force refresh of views
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(isFirstTimeUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
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
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  
  const { theme } = useTheme();
  const { avatar, username } = useUser();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // Clear localStorage and test Supabase connection on mount
  useEffect(() => {
    const initialize = async () => {
      // Clear old localStorage data (user must use Supabase now)
      const { clearLocalStorage } = await import('./storage');
      clearLocalStorage();
      
      // Uncomment to test Supabase connection (verbose logging)
      // if (import.meta.env.DEV) {
      //   const { testSupabaseConnection } = await import('./utils/testSupabase');
      //   await testSupabaseConnection();
      // }
    };
    
    initialize();
  }, []);

  // Show auth modal if user is not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !showOnboarding) {
      setShowAuthModal(true);
    }
  }, [authLoading, isAuthenticated, showOnboarding]);

  // Refresh the current view when switching back to it
  const handleNavigate = (view: View) => {
    setCurrentView(view);
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
        // Remove trigger phrases and use rest as content
        let content = parsed.transcript;
        const journalPrefixes = ['journal', 'note to self', 'write in my journal', 'dear diary', 'today'];
        for (const prefix of journalPrefixes) {
          if (content.toLowerCase().startsWith(prefix)) {
            content = content.substring(prefix.length).replace(/^[:\s,]+/, '').trim();
            break;
          }
        }
        setJournalPrefillContent(content);
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
      default:
        return <TodayView key={`today-${key}`} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div 
      className="app" 
      style={{ 
        background: `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`
      }}
    >
      <header className="header">
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
        <nav className="nav">
          <button
            className={`nav-button ${currentView === 'today' ? 'active' : ''}`}
            onClick={() => handleNavigate('today')}
            title="Dashboard View"
            style={currentView === 'today' ? { backgroundColor: theme.colors.primary } : {}}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-text">Dashboard</span>
          </button>
          <button
            className={`nav-button ${currentView === 'tasks-events' ? 'active' : ''}`}
            onClick={() => handleNavigate('tasks-events')}
            title="Tasks, Events & Routines"
            style={currentView === 'tasks-events' ? { backgroundColor: theme.colors.primary } : {}}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-text">New</span>
          </button>
          <button
            className={`nav-button ${currentView === 'journal' ? 'active' : ''}`}
            onClick={() => handleNavigate('journal')}
            title="Daily Journal & Reflections"
            style={currentView === 'journal' ? { backgroundColor: theme.colors.primary } : {}}
          >
            <span className="nav-icon">📔</span>
            <span className="nav-text">Journal</span>
          </button>
          <button
            className={`nav-button ${currentView === 'analytics' ? 'active' : ''}`}
            onClick={() => handleNavigate('analytics')}
            title="Analytics & Reports"
            style={currentView === 'analytics' ? { backgroundColor: theme.colors.primary } : {}}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Analytics</span>
          </button>
          <button
            className={`nav-button ${currentView === 'safe' ? 'active' : ''}`}
            onClick={() => handleNavigate('safe')}
            title="Safe - Encrypted Password Manager"
            style={currentView === 'safe' ? { backgroundColor: theme.colors.primary } : {}}
          >
            <span className="nav-icon">🔒</span>
            <span className="nav-text">Safe</span>
          </button>
        </nav>
        <div className="header-actions">
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
      </header>
      <main className="main-content">
        {renderView()}
      </main>

      {/* Modals */}
      <AboutModal show={showAbout} onClose={() => setShowAbout(false)} />
      <SettingsModal show={showSettings} onClose={() => setShowSettings(false)} />
      
      {/* Authentication Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            setKey(prev => prev + 1);
          }}
        />
      )}
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Onboarding Flow */}
      {showOnboarding && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}

      {/* Floating Timer Button */}
      <FloatingTimerButton onClick={() => setShowTimerModal(true)} />

      {/* Floating Gift Cards Button */}
      <FloatingGiftCardsButton onClick={() => setShowGiftCardsModal(true)} />

      {/* Floating Milestones Button */}
      <FloatingMilestonesButton onClick={() => setShowMilestonesModal(true)} />

  {/* Floating Pinned Button */}
  <FloatingPinnedButton onClick={() => setShowPinnedModal(true)} />

        {/* Voice Command Floating Button (bottom-right) - hidden on mobile */}
        <div className="floating-voice-button-desktop">
          <VoiceCommandButton 
            onPrefillAndNavigate={handleVoicePrefillAndNavigate}
            onCreateFromHistory={handleCreateFromVoiceHistory}
            userId={user?.id}
          />
        </div>

      {/* Timer Modal */}
      {showTimerModal && (
        <div className="modal-overlay active" onClick={() => setShowTimerModal(false)}>
          <div className="modal timer-modal" onClick={(e) => e.stopPropagation()}>
            <TimerView key={`timer-${key}`} onClose={() => setShowTimerModal(false)} />
          </div>
        </div>
      )}

      {/* Gift Cards Modal */}
      {showGiftCardsModal && (
        <div className="modal-overlay active" onClick={() => setShowGiftCardsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <GiftCardsModal onClose={() => setShowGiftCardsModal(false)} />
          </div>
        </div>
      )}

      {/* Milestones Modal */}
      {showMilestonesModal && (
        <div className="modal-overlay active" onClick={() => setShowMilestonesModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <MilestonesModal onClose={() => setShowMilestonesModal(false)} />
          </div>
        </div>
      )}

      {/* Pinned Modal */}
      {showPinnedModal && (
        <div className="modal-overlay active" onClick={() => setShowPinnedModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <PinnedModal onClose={() => setShowPinnedModal(false)} />
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
        title="Add New"
        options={[
          {
            icon: '🎙️',
            label: 'Voice Input',
            description: 'Add via voice command',
            onClick: () => setShowVoiceAddModal(true),
            primary: true,
          },
          {
            icon: '📝',
            label: 'To-Do List',
            description: 'Quick grouped to-do items',
            onClick: () => handleNavigate('todo'),
            primary: true,
          },
          {
            icon: '✅',
            label: 'Task',
            description: 'Scheduled task or habit',
            onClick: () => {
              setTasksEventsInitialTab('tasks');
              handleNavigate('tasks-events');
            },
          },
          {
            icon: '📅',
            label: 'Event',
            description: 'Calendar event or reminder',
            onClick: () => {
              setTasksEventsInitialTab('events');
              handleNavigate('tasks-events');
            },
          },
          {
            icon: '📦',
            label: 'Item',
            description: 'Track an item or resource',
            onClick: () => handleNavigate('items'),
          },
          {
            icon: '🔄',
            label: 'Routine',
            description: 'Recurring habit or routine',
            onClick: () => {
              setTasksEventsInitialTab('routines');
              handleNavigate('tasks-events');
            },
          },
          {
            icon: '🎯',
            label: 'Resolution',
            description: 'Goal or resolution',
            onClick: () => {
              setTasksEventsInitialTab('resolutions');
              handleNavigate('tasks-events');
            },
          },
        ]}
      />

      {/* Mobile More Bottom Sheet */}
      <MobileBottomSheet
        isOpen={showMoreSheet}
        onClose={() => setShowMoreSheet(false)}
        title="More Options"
        options={[
          {
            icon: '✅',
            label: 'To-Do List',
            description: 'Manage your to-do items',
            onClick: () => handleNavigate('todo'),
          },
          {
            icon: '👨‍👩‍👧‍👦',
            label: 'Groups',
            description: 'Manage family & sharing groups',
            onClick: () => handleNavigate('groups'),
          },
          {
            icon: '📊',
            label: 'Analytics',
            description: 'View your progress and stats',
            onClick: () => handleNavigate('analytics'),
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
    <ThemeProvider>
      <AuthProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;

