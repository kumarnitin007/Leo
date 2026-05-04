/**
 * MobileHeaderContext — lets the active page override the global mobile top bar
 * rendered by `<MobileContextHeader />` (App.tsx).
 *
 * Why this exists:
 *   Several pages have *sub-pages* that should change the title and back button
 *   on the global mobile header. For example:
 *     - Settings → Profile  ⇒ top bar should read "‹ 👤 Profile" with the back
 *       arrow returning to the Settings menu (not the Home view).
 *     - Vault    → Account Detail  ⇒ similar pattern when we add it.
 *
 *   Rather than build per-page custom headers (causing the duplicate-title
 *   issue we just fixed), each page can call `useMobileHeader()` and push an
 *   override while a sub-page is active, then clear it when leaving.
 *
 * Falls back to the default per-`currentView` config in MobileContextHeader
 * whenever `override` is null.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export interface MobileHeaderOverride {
  /** Title shown in the top bar (e.g. "Profile"). */
  title: string;
  /** Optional emoji/icon shown next to the title. */
  icon?: string;
  /** Optional small subtitle below the title. */
  subtitle?: string;
  /**
   * Override the back button behaviour (e.g. go back to the Settings menu
   * instead of the Home view). When omitted, the default `onBack` (which
   * returns to Home) is used.
   */
  onBack?: () => void;
}

interface MobileHeaderContextValue {
  override: MobileHeaderOverride | null;
  setOverride: (o: MobileHeaderOverride | null) => void;
}

const MobileHeaderContext = createContext<MobileHeaderContextValue>({
  override: null,
  setOverride: () => {},
});

export const MobileHeaderProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [override, setOverrideState] = useState<MobileHeaderOverride | null>(null);

  // Stable callback to avoid re-render thrash when consumers call it from
  // useEffect.
  const setOverride = useCallback((o: MobileHeaderOverride | null) => {
    setOverrideState(o);
  }, []);

  const value = useMemo(
    () => ({ override, setOverride }),
    [override, setOverride],
  );

  return (
    <MobileHeaderContext.Provider value={value}>
      {children}
    </MobileHeaderContext.Provider>
  );
};

export function useMobileHeader(): MobileHeaderContextValue {
  return useContext(MobileHeaderContext);
}
