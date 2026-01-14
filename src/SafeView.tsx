/**
 * Safe Section View
 * 
 * Main component for the password manager-like safe section.
 * Handles:
 * - Master password setup (first time)
 * - Lock/unlock state
 * - Auto-lock after inactivity
 * - Entry list and management
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { 
  hasMasterPassword, 
  setMasterPassword, 
  verifyMasterPassword, 
  getSafeEntriesCount,
  getEncryptionKey,
  getSafeEntries,
  getSafeTags,
  initializeSafeCategories
} from './storage';
import { SafeEntry, Tag } from './types';
import { CryptoKey } from './utils/encryption';
import MasterPasswordSetup from './components/MasterPasswordSetup';
import SafeLockScreen from './components/SafeLockScreen';
import SafeEntryList from './components/SafeEntryList';
import SafeEntryForm from './components/SafeEntryForm';
import SafeEntryDetail from './components/SafeEntryDetail';
import SafeImportExport from './components/SafeImportExport';
import ChangeMasterPasswordModal from './components/ChangeMasterPasswordModal';
import SafeTags from './components/SafeTags';

const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const LOCK_WARNING_TIME = 60 * 1000; // 1 minute before lock

const SafeView: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [entries, setEntries] = useState<SafeEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<SafeEntry | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [timeUntilLock, setTimeUntilLock] = useState<number | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showSafeTags, setShowSafeTags] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const justUnlockedRef = useRef<boolean>(false); // Track if we just unlocked to prevent immediate blur lock

  // Check if master password is set
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSetup = async () => {
      try {
        const hasPassword = await hasMasterPassword();
        setIsSetup(hasPassword);
        if (hasPassword) {
          const count = await getSafeEntriesCount();
          setEntryCount(count);
          await loadTags();
        }
      } catch (error) {
        console.error('[Safe] Error checking master password setup:', error);
        // If auth error, user will see the "Please sign in" message
        // Otherwise, set to false to show setup screen
        setIsSetup(false);
      }
    };

    checkSetup();
  }, [isAuthenticated]);

  // Load tags
  const loadTags = async () => {
    // Ensure all system categories exist (in case new ones were added)
    await initializeSafeCategories();
    const safeTags = await getSafeTags();
    setTags(safeTags);
  };

  // Handle master password setup
  const handleSetupComplete = async (password: string) => {
    try {
      const success = await setMasterPassword(password);
      if (success) {
        setIsSetup(true);
        // Derive key and unlock immediately after setup
        const key = await getEncryptionKey(password);
        setEncryptionKey(key);
        setIsLocked(false);
        await loadEntries();
        await loadTags();
        startInactivityTimer();
      }
    } catch (error) {
      console.error('Error setting up master password:', error);
      alert('Failed to set up master password. Please try again.');
    }
  };

  // Handle unlock
  const handleUnlock = async (password: string) => {
    setIsUnlocking(true);
    try {
      const isValid = await verifyMasterPassword(password);
      if (isValid) {
        const key = await getEncryptionKey(password);
        setEncryptionKey(key);
        setIsLocked(false);
        justUnlockedRef.current = true; // Mark that we just unlocked
        await loadEntries();
        await loadTags();
        startInactivityTimer();
        
        // Clear the "just unlocked" flag after 2 seconds to allow blur lock after that
        setTimeout(() => {
          justUnlockedRef.current = false;
        }, 2000);
      } else {
        alert('Incorrect password. Please try again.');
      }
    } catch (error) {
      console.error('[Safe] Error unlocking safe:', error);
      alert('Failed to unlock. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Load entries
  const loadEntries = async () => {
    const safeEntries = await getSafeEntries();
    setEntries(safeEntries);
    setEntryCount(safeEntries.length);
  };

  // Handle activity (reset inactivity timer)
  const handleActivity = () => {
    const now = Date.now();
    lastActivityRef.current = now;
    resetInactivityTimer();
  };

  // Start inactivity timer
  const startInactivityTimer = () => {
    resetInactivityTimer();
    
    // Set up activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  };

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    setTimeUntilLock(null);

    const timeoutMs = AUTO_LOCK_TIMEOUT;
    const warningTime = AUTO_LOCK_TIMEOUT - LOCK_WARNING_TIME;

    // Set warning timer (1 minute before lock)
    warningTimerRef.current = setTimeout(() => {
      const remaining = AUTO_LOCK_TIMEOUT - (Date.now() - lastActivityRef.current);
      const seconds = Math.ceil(remaining / 1000);
      setTimeUntilLock(seconds);
    }, warningTime);

    // Set lock timer
    inactivityTimerRef.current = setTimeout(() => {
      handleLock();
    }, timeoutMs);
  };

  // Handle lock
  const handleLock = () => {
    setEncryptionKey(null);
    setIsLocked(true);
    setSelectedEntry(null);
    setIsAdding(false);
    setIsEditing(false);
    setTimeUntilLock(null);
    justUnlockedRef.current = false;
    
    // Clear timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  };

  // Update countdown timer
  useEffect(() => {
    if (timeUntilLock !== null && timeUntilLock > 0) {
      const interval = setInterval(() => {
        const remaining = AUTO_LOCK_TIMEOUT - (Date.now() - lastActivityRef.current);
        const seconds = Math.ceil(remaining / 1000);
        if (seconds <= 0) {
          setTimeUntilLock(null);
        } else {
          setTimeUntilLock(seconds);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timeUntilLock]);

  // Handle window blur (lock on tab switch)
  // Only lock on blur if user has been active (to avoid locking immediately on mount)
  useEffect(() => {
    if (!isLocked && encryptionKey) {
      let blurHandler: (() => void) | null = null;
      let focusHandler: (() => void) | null = null;
      let blurLockTimer: ReturnType<typeof setTimeout> | null = null;
      
      // Wait a bit before enabling blur lock to avoid immediate lock on mount
      const timeout = setTimeout(() => {
        blurHandler = () => {
          // Don't lock if we just unlocked (within 2 seconds)
          if (justUnlockedRef.current) {
            return;
          }
          
          // Check if window actually lost focus (not just internal focus change)
          setTimeout(() => {
            if (!document.hasFocus()) {
              // Clear any existing blur lock timer
              if (blurLockTimer) {
                clearTimeout(blurLockTimer);
              }
              
              // Set 15-second delay before locking
              blurLockTimer = setTimeout(() => {
                // Double-check that window still doesn't have focus
                if (!document.hasFocus()) {
                  handleLock();
                }
                blurLockTimer = null;
              }, 15000); // 15 second delay
            } else {
              // Cancel any pending blur lock if focus is back
              if (blurLockTimer) {
                clearTimeout(blurLockTimer);
                blurLockTimer = null;
              }
            }
          }, 100); // Small delay to check actual focus state
        };
        
        // Also handle focus event to cancel pending blur lock
        focusHandler = () => {
          if (blurLockTimer) {
            clearTimeout(blurLockTimer);
            blurLockTimer = null;
          }
        };
        
        window.addEventListener('blur', blurHandler);
        window.addEventListener('focus', focusHandler);
      }, 2000); // 2 second delay to avoid immediate lock
      
      return () => {
        clearTimeout(timeout);
        if (blurHandler) {
          window.removeEventListener('blur', blurHandler);
        }
        if (focusHandler) {
          window.removeEventListener('focus', focusHandler);
        }
        if (blurLockTimer) {
          clearTimeout(blurLockTimer);
        }
      };
    }
  }, [isLocked, encryptionKey]);

  // Handle entry selection
  const handleEntrySelect = (entry: SafeEntry) => {
    setSelectedEntry(entry);
    setIsAdding(false);
    setIsEditing(false);
    handleActivity();
  };

  // Handle add new entry
  const handleAddNew = () => {
    setIsAdding(true);
    setIsEditing(false);
    setSelectedEntry(null);
    handleActivity();
  };

  // Handle edit entry
  const handleEdit = (entry: SafeEntry) => {
    setIsEditing(true);
    setIsAdding(false);
    setSelectedEntry(entry);
    handleActivity();
  };

  // Handle form close
  const handleFormClose = () => {
    setIsAdding(false);
    setIsEditing(false);
    setSelectedEntry(null);
    handleActivity();
  };

  // Handle entry saved
  const handleEntrySaved = async () => {
    await loadEntries();
    handleFormClose();
  };

  // Handle entry deleted
  const handleEntryDeleted = async () => {
    await loadEntries();
    setSelectedEntry(null);
    handleActivity();
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Please sign in to access the Safe section.</p>
      </div>
    );
  }

  if (isSetup === null) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  // First time setup
  if (!isSetup) {
    return (
      <MasterPasswordSetup 
        onComplete={handleSetupComplete}
      />
    );
  }

  // Locked state
  if (isLocked) {
    return (
      <SafeLockScreen
        entryCount={entryCount}
        onUnlock={handleUnlock}
        isUnlocking={isUnlocking}
      />
    );
  }

  // Unlocked state - show list or detail/form
  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Auto-lock warning */}
      {timeUntilLock !== null && timeUntilLock < 60 && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          backgroundColor: '#ef4444',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 1000,
          fontSize: '0.875rem'
        }}>
          Auto-locking in {timeUntilLock} seconds...
        </div>
      )}

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🦁</span>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>Leo's Safe</h1>
          </div>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8, fontSize: '0.875rem' }}>
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'} protected by Leo
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            gap: '0.25rem',
            backgroundColor: '#f3f4f6',
            borderRadius: '0.5rem',
            padding: '0.25rem'
          }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: viewMode === 'grid' ? '#3b82f6' : 'transparent',
                color: viewMode === 'grid' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
              title="Grid View"
            >
              ⊞ Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: viewMode === 'list' ? '#3b82f6' : 'transparent',
                color: viewMode === 'list' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
              title="List View"
            >
              ☰ List
            </button>
          </div>

          <button
            onClick={handleAddNew}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500
            }}
          >
            + Add Entry
          </button>
          <button
            onClick={() => setShowChangePassword(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500
            }}
          >
            🔐 Change Password
          </button>
          <button
            onClick={() => setShowImportExport(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            📥 Import/Export
          </button>
          <button
            onClick={() => setShowSafeTags(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            🏷️ Safe Tags
          </button>
          <button
            onClick={handleLock}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            🔒 Lock
          </button>
        </div>
      </div>

      {/* Content */}
      {isAdding || isEditing ? (
        <SafeEntryForm
          entry={isEditing ? selectedEntry : undefined}
          tags={tags}
          encryptionKey={encryptionKey!}
          onSave={handleEntrySaved}
          onCancel={handleFormClose}
        />
      ) : selectedEntry ? (
        <SafeEntryDetail
          entry={selectedEntry}
          tags={tags}
          encryptionKey={encryptionKey!}
          onEdit={handleEdit}
          onDelete={handleEntryDeleted}
          onBack={() => {
            setSelectedEntry(null);
            handleActivity();
          }}
        />
      ) : (
        <SafeEntryList
          entries={entries}
          tags={tags}
          encryptionKey={encryptionKey!}
          viewMode={viewMode}
          onEntrySelect={handleEntrySelect}
          onEntrySaved={loadEntries}
        />
      )}

      {/* Import/Export Modal */}
      {showImportExport && encryptionKey && (
        <SafeImportExport
          entries={entries}
          encryptionKey={encryptionKey}
          tags={tags}
          onImportComplete={async () => {
            await loadEntries();
            await loadTags();
          }}
          onClose={() => setShowImportExport(false)}
          onTagsRefresh={loadTags}
        />
      )}

      {/* Safe Tags Modal */}
      {showSafeTags && (
        <SafeTags
          onClose={() => setShowSafeTags(false)}
          onTagsChange={loadTags}
        />
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangeMasterPasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={async () => {
            // Reload entries after password change (they're re-encrypted)
            await loadEntries();
          }}
        />
      )}
    </div>
  );
};

export default SafeView;

