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
  initializeSafeCategories,
  getDocumentVaults
} from './storage';
import { SafeEntry, Tag, DocumentVault } from './types';
import { CryptoKey } from './utils/encryption';
import MasterPasswordSetup from './components/MasterPasswordSetup';
import SafeLockScreen from './components/SafeLockScreen';
import SafeEntryList from './components/SafeEntryList';
import SafeEntryForm from './components/SafeEntryForm';
import SafeEntryDetail from './components/SafeEntryDetail';
import SafeImportExport from './components/SafeImportExport';
import ChangeMasterPasswordModal from './components/ChangeMasterPasswordModal';
import SafeTags from './components/SafeTags';
import SafeDocumentVault from './components/SafeDocumentVault';
import SafeDocumentVaultForm from './components/SafeDocumentVaultForm';
import ShareEntryModal from './components/ShareEntryModal';
import SharedWithMeView from './components/SharedWithMeView';
import SafeFilterSidebar, { SafeFilter } from './components/SafeFilterSidebar';
import DocumentFilterSidebar, { DocumentFilter } from './components/DocumentFilterSidebar';
import * as sharingService from './services/sharingService';
import getSupabaseClient from './lib/supabase';
import { loadUserGroupKeys } from './services/groupEncryptionService';
import { decryptData } from './utils/encryption';

const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const LOCK_WARNING_TIME = 60 * 1000; // 1 minute before lock

// Helper to get filter label for display
function getFilterLabel(filter: SafeFilter, tags: Tag[]): string {
  switch (filter.type) {
    case 'all': return 'All Entries';
    case 'favorites': return 'Favorites';
    case 'shared': return 'Shared with Me';
    case 'recent': return 'Recently Edited';
    case 'expiring': return 'Expiring Soon';
    case 'category':
    case 'tag': {
      const tag = tags.find(t => t.id === filter.value);
      return tag?.name || 'Unknown';
    }
    default: return 'All Entries';
  }
}

const SafeView: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { user } = useAuth();
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [groupKeys, setGroupKeys] = useState<Map<string, CryptoKey>>(new Map()); // NEW: Store group encryption keys
  const [entries, setEntries] = useState<SafeEntry[]>([]);
  const [documents, setDocuments] = useState<DocumentVault[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<SafeEntry | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [timeUntilLock, setTimeUntilLock] = useState<number | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showSafeTags, setShowSafeTags] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'entries' | 'documents'>('entries');
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentVault | null>(null);
  
  // Sharing state
  const [showSharedWithMe, setShowSharedWithMe] = useState(false);
  const [shareEntry, setShareEntry] = useState<{ id: string; title: string; type: 'safe_entry' | 'document' } | null>(null);
  
  // Filter sidebar state
  const [activeFilter, setActiveFilter] = useState<SafeFilter>({ type: 'all' });
  const [activeDocFilter, setActiveDocFilter] = useState<DocumentFilter>({ type: 'all' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(true); // Mobile: show filters first
  const [showMobileDocFilters, setShowMobileDocFilters] = useState(true); // Mobile: show doc filters first
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Track window resize for mobile detection
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
        await loadDocuments();
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
        
        // NEW: Load user's group encryption keys
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log(`[Safe] 🔑 Starting group key loading for user: ${user.id}`);
          try {
            const loadedGroupKeys = await loadUserGroupKeys(user.id, key);
            setGroupKeys(loadedGroupKeys);
            console.log(`[Safe] ✅ Loaded ${loadedGroupKeys.size} group encryption keys:`, Array.from(loadedGroupKeys.keys()));
            
            // Check if user is in groups but missing keys (e.g., accepted invitation but no key yet)
            console.log('[Safe] 🔍 Checking for missing group keys...');
            const { data: memberGroups, error: memberError } = await supabase
              .from('myday_group_members')
              .select('group_id, role')
              .eq('user_id', user.id);
            
            if (memberError) {
              console.error('[Safe] ❌ Error fetching group memberships:', memberError);
            } else {
              console.log(`[Safe] 👥 User is member of ${memberGroups?.length || 0} groups:`, memberGroups);
              
              const memberGroupIds = (memberGroups || []).map(g => g.group_id);
              const missingKeyGroups = memberGroupIds.filter(gid => !loadedGroupKeys.has(gid));
              
              if (missingKeyGroups.length > 0) {
                console.warn(`[Safe] ⚠️ MISSING KEYS for ${missingKeyGroups.length} groups:`, missingKeyGroups);
                console.warn('[Safe] 💡 These groups need encryption keys. User should request access from group owner.');
                // TODO: Show UI notification to user that they need group owner to re-share
              } else {
                console.log('[Safe] ✅ All group keys present');
              }
            }
          } catch (error) {
            console.error('[Safe] ❌ Failed to load group keys:', error);
            // Continue without group keys - user can still access personal entries
          }
        }
        
        await loadEntries();
        await loadDocuments();
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

  // Load entries (including shared entries)
  const loadEntries = async () => {
    console.log('[SafeView] 📂 Loading entries...');
    const safeEntries = await getSafeEntries();
    console.log(`[SafeView] ✅ Loaded ${safeEntries.length} own entries`);
    
    // Try to load shared entries
    let allEntries = [...safeEntries];
    try {
      console.log('[SafeView] 🔗 Fetching shared entry references...');
      const sharedEntryRefs = await sharingService.getEntriesSharedWithMe();
      console.log(`[SafeView] 📥 Found ${sharedEntryRefs.length} shared entry references:`, sharedEntryRefs);
      
      if (sharedEntryRefs.length > 0) {
        const supabase = getSupabaseClient();
        if (supabase) {
          // Get sharer display names
          const sharerIds = [...new Set(sharedEntryRefs.map(s => s.sharedBy))];
          const sharerNames: Record<string, string> = {};
          
          const { data: membersData } = await supabase
            .from('myday_group_members')
            .select('user_id, display_name')
            .in('user_id', sharerIds);
          
          (membersData || []).forEach(m => {
            if (m.display_name) sharerNames[m.user_id] = m.display_name;
          });
          
          // NEW: Map shared entries and decrypt with group keys
          console.log('[SafeView] 🔐 Starting decryption of shared entries...');
          console.log(`[SafeView] 🔑 Available group keys:`, Array.from(groupKeys.keys()));
          
          const sharedEntriesMapped: SafeEntry[] = await Promise.all(
            sharedEntryRefs.map(async (shareRef, index) => {
              console.log(`[SafeView] 🔍 Processing shared entry ${index + 1}/${sharedEntryRefs.length}:`, {
                entryId: shareRef.safeEntryId,
                groupId: shareRef.groupId,
                hasEncryptedData: !!shareRef.groupEncryptedData,
                hasIV: !!shareRef.groupEncryptedDataIv,
                title: shareRef.entryTitle
              });
              
              let decryptedData: any = null;
              
              // Try to decrypt if we have group key and encrypted data
              if (shareRef.groupEncryptedData && shareRef.groupEncryptedDataIv) {
                const groupKey = groupKeys.get(shareRef.groupId);
                if (groupKey) {
                  console.log(`[SafeView] 🔓 Attempting to decrypt entry ${shareRef.safeEntryId} with group key for ${shareRef.groupId}`);
                  try {
                    const decryptedJson = await decryptData(
                      shareRef.groupEncryptedData,
                      shareRef.groupEncryptedDataIv,
                      groupKey
                    );
                    decryptedData = JSON.parse(decryptedJson);
                    console.log(`[SafeView] ✅ Successfully decrypted entry ${shareRef.safeEntryId}:`, {
                      hasUsername: !!decryptedData.username,
                      hasPassword: !!decryptedData.password,
                      hasNotes: !!decryptedData.notes
                    });
                  } catch (error) {
                    console.error(`[SafeView] ❌ Failed to decrypt entry ${shareRef.safeEntryId}:`, error);
                  }
                } else {
                  console.warn(`[SafeView] ⚠️ No group key available for group ${shareRef.groupId} (entry: ${shareRef.safeEntryId})`);
                }
              } else {
                console.warn(`[SafeView] ⚠️ Entry ${shareRef.safeEntryId} missing encrypted data or IV:`, {
                  hasData: !!shareRef.groupEncryptedData,
                  hasIV: !!shareRef.groupEncryptedDataIv
                });
              }
              
              return {
                id: shareRef.safeEntryId,
                title: shareRef.entryTitle || 'Shared Entry',
                url: decryptedData?.url || '',
                categoryTagId: shareRef.entryCategory || '',
                tags: shareRef.entryTags || [],
                isFavorite: false,
                expiresAt: null,
                encryptedData: shareRef.groupEncryptedData || '', // Store encrypted for potential re-encryption
                encryptedDataIv: shareRef.groupEncryptedDataIv || '',
                decryptedData: decryptedData, // NEW: Include decrypted data if available
                createdAt: shareRef.sharedAt,
                updatedAt: shareRef.sharedAt,
                lastAccessedAt: null,
                isShared: true,
                sharedBy: sharerNames[shareRef.sharedBy] || 'Someone',
                sharedAt: shareRef.sharedAt,
                shareMode: shareRef.shareMode,
              };
            })
          );
          
          allEntries = [...safeEntries, ...sharedEntriesMapped];
          const decryptedCount = sharedEntriesMapped.filter(e => e.decryptedData).length;
          console.log(`[SafeView] 📊 Summary:`, {
            ownEntries: safeEntries.length,
            sharedEntries: sharedEntriesMapped.length,
            decryptedShared: decryptedCount,
            failedToDecrypt: sharedEntriesMapped.length - decryptedCount,
            totalEntries: allEntries.length
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load shared entries:', err);
    }
    
    setEntries(allEntries);
    setEntryCount(safeEntries.length); // Only count own entries
  };

  // Load documents
  const loadDocuments = async () => {
    const docs = await getDocumentVaults();
    setDocuments(docs);
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

  // Calculate entry counts for filters
  const entryCounts = React.useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const counts = {
      all: entries.length,
      favorites: entries.filter(e => e.isFavorite).length,
      shared: entries.filter(e => e.isShared).length,
      recent: entries.filter(e => new Date(e.updatedAt) >= sevenDaysAgo).length,
      expiring: entries.filter(e => {
        if (!e.expiresAt) return false;
        const expDate = new Date(e.expiresAt);
        return expDate <= thirtyDaysFromNow && expDate >= now;
      }).length,
      byTag: {} as Record<string, number>,
    };
    
    // Count by tags and categories
    tags.forEach(tag => {
      counts.byTag[tag.id] = entries.filter(e => 
        e.categoryTagId === tag.id || (e.tags && e.tags.includes(tag.id))
      ).length;
    });
    
    return counts;
  }, [entries, tags]);
  
  // Filter entries based on active filter
  const filteredEntries = React.useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    switch (activeFilter.type) {
      case 'all':
        return entries;
      case 'favorites':
        return entries.filter(e => e.isFavorite);
      case 'shared':
        return entries.filter(e => e.isShared);
      case 'recent':
        return entries.filter(e => new Date(e.updatedAt) >= sevenDaysAgo);
      case 'expiring':
        return entries.filter(e => {
          if (!e.expiresAt) return false;
          const expDate = new Date(e.expiresAt);
          return expDate <= thirtyDaysFromNow && expDate >= now;
        });
      case 'category':
        return entries.filter(e => e.categoryTagId === activeFilter.value);
      case 'tag':
        return entries.filter(e => e.tags && e.tags.includes(activeFilter.value!));
      default:
        return entries;
    }
  }, [entries, activeFilter]);
  
  // Calculate document filter counts
  const docEntryCounts = React.useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const counts = {
      all: documents.length,
      favorites: documents.filter(d => d.isFavorite).length,
      expiring: documents.filter(d => {
        if (!d.expiryDate) return false;
        const expDate = new Date(d.expiryDate);
        return expDate <= thirtyDaysFromNow && expDate >= now;
      }).length,
      recent: documents.filter(d => new Date(d.updatedAt) >= sevenDaysAgo).length,
      byDocType: {} as Record<string, number>,
      byProvider: {} as Record<string, number>,
      byTag: {} as Record<string, number>,
    };
    
    documents.forEach(doc => {
      counts.byDocType[doc.documentType] = (counts.byDocType[doc.documentType] || 0) + 1;
      counts.byProvider[doc.provider] = (counts.byProvider[doc.provider] || 0) + 1;
      (doc.tags || []).forEach(tagId => {
        counts.byTag[tagId] = (counts.byTag[tagId] || 0) + 1;
      });
    });
    
    return counts;
  }, [documents]);
  
  // Filter documents based on active filter
  const filteredDocuments = React.useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    switch (activeDocFilter.type) {
      case 'all':
        return documents;
      case 'favorites':
        return documents.filter(d => d.isFavorite);
      case 'expiring':
        return documents.filter(d => {
          if (!d.expiryDate) return false;
          const expDate = new Date(d.expiryDate);
          return expDate <= thirtyDaysFromNow && expDate >= now;
        });
      case 'recent':
        return documents.filter(d => new Date(d.updatedAt) >= sevenDaysAgo);
      case 'docType':
        return documents.filter(d => d.documentType === activeDocFilter.value);
      case 'provider':
        return documents.filter(d => d.provider === activeDocFilter.value);
      case 'tag':
        return documents.filter(d => d.tags && d.tags.includes(activeDocFilter.value!));
      default:
        return documents;
    }
  }, [documents, activeDocFilter]);
  
  // Helper to get document filter label
  const getDocFilterLabel = (filter: DocumentFilter): string => {
    switch (filter.type) {
      case 'all': return 'All Documents';
      case 'favorites': return 'Favorites';
      case 'expiring': return 'Expiring Soon';
      case 'recent': return 'Recently Updated';
      case 'docType': return filter.value || 'Type';
      case 'provider': return filter.value || 'Provider';
      case 'tag': {
        const tag = tags.find(t => t.id === filter.value);
        return tag?.name || 'Tag';
      }
      default: return 'All Documents';
    }
  };

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
    // SECURITY: Demo detection uses localStorage flags only (set by server-side demo login)
    // Never expose demo credentials in client-side code
    const isLocalDemoFlag = localStorage.getItem('myday-demo') === 'true';
    const demoProfile = localStorage.getItem('myday-demo-profile');
    const isDemoUser = isLocalDemoFlag || (demoProfile !== null);
    
    // Demo safe password only from localStorage (set by server during demo login)
    const demoSafePassword = localStorage.getItem('myday-demo-safe-password') || null;

    return (
      <SafeLockScreen
        entryCount={entryCount}
        onUnlock={handleUnlock}
        isUnlocking={isUnlocking}
        isDemoUser={isDemoUser}
        demoSafePassword={demoSafePassword}
        onOpenChangePassword={() => setShowChangePassword(true)}
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
      <div className="safe-desktop-header" style={{ 
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
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'}, {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowSharedWithMe(true)}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: '#14b8a6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            🔗 Shared With Me
          </button>
          <button
            onClick={() => {
              console.log('Change password button clicked');
              setShowChangePassword(true);
            }}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            🔐 Change Password
          </button>
          <button
            onClick={() => setShowImportExport(true)}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            📥 Import/Export
          </button>
          <button
            onClick={() => setShowSafeTags(true)}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            🏷️ Tags
          </button>
          <button
            onClick={handleLock}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            🔒 Lock
          </button>
        </div>
      </div>

      {/* Tab Navigation - Mobile-friendly */}
      <div className="safe-tabs-wrapper" style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <button
          onClick={() => setActiveTab('entries')}
          className="safe-tab"
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            backgroundColor: activeTab === 'entries' ? '#3b82f6' : 'rgba(255,255,255,0.5)',
            color: activeTab === 'entries' ? 'white' : '#6b7280',
            border: activeTab === 'entries' ? 'none' : '2px solid rgba(0,0,0,0.1)',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>🔐</span>
          <span>Passwords</span>
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className="safe-tab"
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            backgroundColor: activeTab === 'documents' ? '#3b82f6' : 'rgba(255,255,255,0.5)',
            color: activeTab === 'documents' ? 'white' : '#6b7280',
            border: activeTab === 'documents' ? 'none' : '2px solid rgba(0,0,0,0.1)',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>📄</span>
          <span>Documents</span>
        </button>
      </div>

      {/* Add Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end',
        marginBottom: '1.5rem'
      }}>
        <button
          onClick={activeTab === 'entries' ? () => setIsAdding(true) : () => setShowDocumentForm(true)}
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
          + Add New
        </button>
      </div>

      {/* Content with Sidebar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Mobile: Show filters first, then entries */}
        {isMobile && activeTab === 'entries' && !isAdding && !isEditing && showMobileFilters ? (
          <SafeFilterSidebar
            tags={tags}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            entryCounts={entryCounts}
            isMobile={true}
            onFilterSelected={() => setShowMobileFilters(false)}
          />
        ) : (
          <>
            {/* Desktop: Filter Sidebar - only show for entries tab when not adding/editing */}
            {!isMobile && activeTab === 'entries' && !isAdding && !isEditing && (
              <SafeFilterSidebar
                tags={tags}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                entryCounts={entryCounts}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            )}
            
            {/* Main Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {activeTab === 'entries' ? (
                isAdding || isEditing ? (
                  <SafeEntryForm
                    entry={isEditing ? selectedEntry : undefined}
                    tags={tags}
                    encryptionKey={encryptionKey!}
                    onSave={async () => {
                      await loadEntries();
                      setIsAdding(false);
                      setIsEditing(false);
                      setSelectedEntry(null);
                    }}
                    onCancel={() => {
                      setIsAdding(false);
                      setIsEditing(false);
                      setSelectedEntry(null);
                    }}
                  />
                ) : (
                  <>
                    {/* Mobile: Back to filters button */}
                    {isMobile && (
                      <button
                        onClick={() => setShowMobileFilters(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.75rem 1rem',
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          color: '#3b82f6',
                          marginBottom: '1rem',
                          width: '100%',
                        }}
                      >
                        <span>‹ Back to Filters</span>
                        <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.8rem' }}>
                          {getFilterLabel(activeFilter, tags)} ({filteredEntries.length})
                        </span>
                      </button>
                    )}
                    {/* Desktop: Active filter indicator */}
                    {!isMobile && activeFilter.type !== 'all' && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                      }}>
                        <span>Showing: <strong>{getFilterLabel(activeFilter, tags)}</strong></span>
                        <span style={{ color: '#6b7280' }}>({filteredEntries.length} entries)</span>
                        <button
                          onClick={() => setActiveFilter({ type: 'all' })}
                          style={{
                            marginLeft: 'auto',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#3b82f6',
                            fontSize: '0.85rem',
                          }}
                        >
                          Clear filter
                        </button>
                      </div>
                    )}
                    <SafeEntryList
                      entries={filteredEntries}
                      tags={tags}
                      encryptionKey={encryptionKey!}
                      onEntrySelect={(entry) => {
                        setSelectedEntry(entry);
                        setIsAdding(false);
                        setIsEditing(false);
                      }}
                      onEntrySaved={loadEntries}
                      onShare={(entry) => setShareEntry({ id: entry.id, title: entry.title, type: 'safe_entry' })}
                    />
                    {selectedEntry && (
                      <SafeEntryDetail
                        entry={selectedEntry}
                        tags={tags}
                        encryptionKey={encryptionKey!}
                        onEdit={() => setIsEditing(true)}
                        onDelete={async () => {
                          await loadEntries();
                          setSelectedEntry(null);
                        }}
                        onClose={() => {
                          setSelectedEntry(null);
                          handleActivity();
                        }}
                      />
                    )}
                  </>
                )
              ) : (
                /* Documents Tab with Filter Sidebar */
                isMobile && showMobileDocFilters && !showDocumentForm && !editingDocument ? (
                  <DocumentFilterSidebar
                    tags={tags}
                    activeFilter={activeDocFilter}
                    onFilterChange={setActiveDocFilter}
                    entryCounts={docEntryCounts}
                    isMobile={true}
                    onFilterSelected={() => setShowMobileDocFilters(false)}
                  />
                ) : (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', width: '100%' }}>
                    {/* Desktop: Document Filter Sidebar */}
                    {!isMobile && !showDocumentForm && !editingDocument && (
                      <DocumentFilterSidebar
                        tags={tags}
                        activeFilter={activeDocFilter}
                        onFilterChange={setActiveDocFilter}
                        entryCounts={docEntryCounts}
                      />
                    )}
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Mobile: Back to filters button */}
                      {isMobile && !showDocumentForm && !editingDocument && (
                        <button
                          onClick={() => setShowMobileDocFilters(true)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1rem',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            color: '#3b82f6',
                            marginBottom: '1rem',
                            width: '100%',
                          }}
                        >
                          <span>‹ Back to Filters</span>
                          <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.8rem' }}>
                            {getDocFilterLabel(activeDocFilter)} ({filteredDocuments.length})
                          </span>
                        </button>
                      )}
                      
                      {showDocumentForm || editingDocument ? (
                        <SafeDocumentVaultForm
                          document={editingDocument || undefined}
                          tags={tags}
                          encryptionKey={encryptionKey!}
                          onSave={async () => {
                            await loadDocuments();
                            setShowDocumentForm(false);
                            setEditingDocument(null);
                          }}
                          onCancel={() => {
                            setShowDocumentForm(false);
                            setEditingDocument(null);
                          }}
                        />
                      ) : (
                        <>
                          {/* Active filter indicator */}
                          {!isMobile && activeDocFilter.type !== 'all' && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.5rem 1rem',
                              background: 'rgba(59, 130, 246, 0.1)',
                              borderRadius: '0.5rem',
                              marginBottom: '1rem',
                              fontSize: '0.85rem',
                            }}>
                              <span>Showing: <strong>{getDocFilterLabel(activeDocFilter)}</strong></span>
                              <span style={{ color: '#6b7280' }}>({filteredDocuments.length} documents)</span>
                              <button
                                onClick={() => setActiveDocFilter({ type: 'all' })}
                                style={{
                                  marginLeft: 'auto',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#3b82f6',
                                  fontSize: '0.85rem',
                                }}
                              >
                                Clear filter
                              </button>
                            </div>
                          )}
                          <SafeDocumentVault
                            documents={filteredDocuments}
                            tags={tags}
                            encryptionKey={encryptionKey!}
                            onDocumentSaved={loadDocuments}
                            onAddDocument={() => setShowDocumentForm(true)}
                            onEditDocument={(doc) => setEditingDocument(doc)}
                            onShare={(doc) => setShareEntry({ id: doc.id, title: doc.title, type: 'document' })}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>

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
        <>
          {console.log('Rendering ChangeMasterPasswordModal')}
          <ChangeMasterPasswordModal
            onClose={() => setShowChangePassword(false)}
            onSuccess={async () => {
              // Reload entries after password change (they're re-encrypted)
              await loadEntries();
            }}
          />
        </>
      )}

      {/* Shared With Me Modal */}
      {showSharedWithMe && (
        <SharedWithMeView
          onClose={() => setShowSharedWithMe(false)}
          onCopyEntry={(entryId, entryType) => {
            // TODO: Implement copy functionality
            // This would decrypt the shared entry and create a copy in user's own safe
            alert('Copy feature coming soon! You would need the sharer\'s encryption key to decrypt and copy.');
          }}
        />
      )}

      {/* Share Entry Modal */}
      {shareEntry && (
        <ShareEntryModal
          entryId={shareEntry.id}
          entryTitle={shareEntry.title}
          entryType={shareEntry.type}
          encryptionKey={encryptionKey}
          groupKeys={groupKeys}
          onClose={() => setShareEntry(null)}
          onShared={() => {
            setShareEntry(null);
            loadEntries(); // Reload to reflect sharing status
          }}
        />
      )}
    </div>
  );
};

export default SafeView;

