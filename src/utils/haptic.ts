/**
 * Haptic Feedback Utility
 * 
 * Provides tactile feedback on mobile devices for key interactions.
 * Falls back gracefully on unsupported browsers.
 * 
 * Usage:
 * ```tsx
 * import { haptic } from '../utils/haptic';
 * 
 * // In event handlers:
 * const handleClick = () => {
 *   haptic.light();  // Light tap
 *   // ... action
 * };
 * 
 * const handleDelete = () => {
 *   haptic.heavy();  // Strong feedback for destructive actions
 *   // ... action
 * };
 * 
 * const handleSuccess = () => {
 *   haptic.success();  // Double tap for success
 *   // ... action
 * };
 * ```
 */

type HapticPattern = number | number[];

interface HapticFeedback {
  /** Light tap - for regular button presses */
  light: () => void;
  /** Medium tap - for selections, toggles */
  medium: () => void;
  /** Heavy tap - for destructive actions, confirmations */
  heavy: () => void;
  /** Success pattern - double tap for completion */
  success: () => void;
  /** Error pattern - triple short for errors */
  error: () => void;
  /** Warning pattern - single medium for warnings */
  warning: () => void;
  /** Selection changed - very light for list selections */
  selection: () => void;
  /** Custom pattern */
  custom: (pattern: HapticPattern) => void;
  /** Check if haptic is supported */
  isSupported: () => boolean;
}

const vibrate = (pattern: HapticPattern): void => {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silently fail if not supported
  }
};

const isSupported = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * Haptic feedback patterns
 * 
 * Patterns use milliseconds:
 * - Single number: vibrate for that duration
 * - Array: alternating vibrate/pause durations
 */
export const haptic: HapticFeedback = {
  /** Light tap (10ms) - regular interactions */
  light: () => vibrate(10),
  
  /** Medium tap (25ms) - toggles, selections */
  medium: () => vibrate(25),
  
  /** Heavy tap (50ms) - destructive actions */
  heavy: () => vibrate(50),
  
  /** Success (10ms, pause 50ms, 10ms) - double tap */
  success: () => vibrate([10, 50, 10]),
  
  /** Error (10ms, 30ms pause, 10ms, 30ms pause, 10ms) - triple short */
  error: () => vibrate([10, 30, 10, 30, 10]),
  
  /** Warning (30ms) - single medium */
  warning: () => vibrate(30),
  
  /** Selection (5ms) - very subtle */
  selection: () => vibrate(5),
  
  /** Custom pattern */
  custom: (pattern: HapticPattern) => vibrate(pattern),
  
  /** Check support */
  isSupported,
};

/**
 * Hook-style wrapper for haptic with auto-detection
 * Returns no-op functions if not supported
 */
export const useHaptic = (): HapticFeedback => {
  if (!isSupported()) {
    const noop = () => {};
    return {
      light: noop,
      medium: noop,
      heavy: noop,
      success: noop,
      error: noop,
      warning: noop,
      selection: noop,
      custom: noop,
      isSupported: () => false,
    };
  }
  return haptic;
};

export default haptic;
