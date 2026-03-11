/**
 * useSafeSession Hook
 * 
 * Manages Safe session state with "Stay unlocked" option.
 * Reduces friction by allowing users to stay unlocked for the session.
 * 
 * Security notes:
 * - Session key stored in sessionStorage (cleared on tab close)
 * - Auto-locks after configurable timeout (default 15 min of inactivity)
 * - Manual lock always available
 * - Activity resets timeout (mouse move, keyboard, touch)
 * 
 * Usage:
 * ```tsx
 * const { 
 *   isUnlocked, 
 *   unlock, 
 *   lock, 
 *   stayUnlocked, 
 *   setStayUnlocked,
 *   remainingTime 
 * } = useSafeSession();
 * 
 * // In SafeLockScreen:
 * <Checkbox 
 *   label="Stay unlocked for this session" 
 *   checked={stayUnlocked}
 *   onChange={(e) => setStayUnlocked(e.target.checked)}
 * />
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const SESSION_KEY = 'safe-session-unlocked';
const STAY_UNLOCKED_KEY = 'safe-stay-unlocked';
const LAST_ACTIVITY_KEY = 'safe-last-activity';
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface UseSafeSessionOptions {
  timeoutMs?: number;
  onAutoLock?: () => void;
}

export interface SafeSessionState {
  isUnlocked: boolean;
  stayUnlocked: boolean;
  remainingTime: number | null;
  setStayUnlocked: (value: boolean) => void;
  unlock: () => void;
  lock: () => void;
  resetActivity: () => void;
}

export const useSafeSession = (options: UseSafeSessionOptions = {}): SafeSessionState => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onAutoLock } = options;
  
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [stayUnlocked, setStayUnlockedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STAY_UNLOCKED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update last activity timestamp
  const resetActivity = useCallback(() => {
    try {
      sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Unlock the Safe
  const unlock = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, 'true');
      resetActivity();
      setIsUnlocked(true);
    } catch {
      // Ignore storage errors
    }
  }, [resetActivity]);

  // Lock the Safe
  const lock = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      setIsUnlocked(false);
      setRemainingTime(null);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Set stay unlocked preference
  const setStayUnlocked = useCallback((value: boolean) => {
    try {
      if (value) {
        localStorage.setItem(STAY_UNLOCKED_KEY, 'true');
      } else {
        localStorage.removeItem(STAY_UNLOCKED_KEY);
      }
      setStayUnlockedState(value);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Check for timeout
  const checkTimeout = useCallback(() => {
    if (!isUnlocked || stayUnlocked) {
      setRemainingTime(null);
      return;
    }

    try {
      const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);
      if (!lastActivity) {
        resetActivity();
        return;
      }

      const elapsed = Date.now() - parseInt(lastActivity, 10);
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        console.log('[SafeSession] Auto-locking due to inactivity');
        lock();
        onAutoLock?.();
      } else {
        setRemainingTime(remaining);
      }
    } catch {
      // Ignore storage errors
    }
  }, [isUnlocked, stayUnlocked, timeoutMs, resetActivity, lock, onAutoLock]);

  // Activity listeners
  useEffect(() => {
    if (!isUnlocked || stayUnlocked) return;

    const handleActivity = () => resetActivity();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [isUnlocked, stayUnlocked, resetActivity]);

  // Timeout checker
  useEffect(() => {
    if (!isUnlocked) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Check immediately
    checkTimeout();

    // Then check every 10 seconds
    checkIntervalRef.current = setInterval(checkTimeout, 10000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isUnlocked, checkTimeout]);

  return {
    isUnlocked,
    stayUnlocked,
    remainingTime,
    setStayUnlocked,
    unlock,
    lock,
    resetActivity,
  };
};

/**
 * Format remaining time for display
 */
export const formatRemainingTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

export default useSafeSession;
