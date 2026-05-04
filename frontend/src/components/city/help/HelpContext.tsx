import {
  createContext,
  useContext,
  useRef,
  useCallback,
  type ReactNode,
  type RefObject,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HelpRegistration {
  id: string;
  ref: RefObject<HTMLElement>;
  kind: 'mode-help' | 'map-help';
  title: string;
}

export interface HelpRegistry {
  register(
    id: string,
    ref: RefObject<HTMLElement>,
    kind: 'mode-help' | 'map-help',
    title: string,
  ): void;
  unregister(id: string): void;
  focus(id: string): void;
  getAnchors(kind: 'map-help'): { id: string; title: string }[];
}

// ── Context ───────────────────────────────────────────────────────────────────

const GLOW_CLASS = 'help-anchor-glow';

const noop = () => {};
const noopRegistry: HelpRegistry = {
  register: noop,
  unregister: noop,
  focus: noop,
  getAnchors: () => [],
};

export const HelpContext = createContext<HelpRegistry>(noopRegistry);

export function useHelpContext(): HelpRegistry {
  return useContext(HelpContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface HelpProviderProps {
  children: ReactNode;
}

export function HelpProvider({ children }: HelpProviderProps) {
  // Use a ref so mutations don't trigger re-renders.
  const registrationsRef = useRef<Map<string, HelpRegistration>>(new Map());

  const register = useCallback(
    (
      id: string,
      ref: RefObject<HTMLElement>,
      kind: 'mode-help' | 'map-help',
      title: string,
    ) => {
      registrationsRef.current.set(id, { id, ref, kind, title });
    },
    [],
  );

  const unregister = useCallback((id: string) => {
    registrationsRef.current.delete(id);
  }, []);

  const focus = useCallback((id: string) => {
    const reg = registrationsRef.current.get(id);
    if (!reg?.ref.current) return;

    const el = reg.ref.current;

    // Open <details> if it's a details element or contains one
    const details = el instanceof HTMLDetailsElement ? el : el.closest('details');
    if (details instanceof HTMLDetailsElement) {
      details.open = true;
    }

    // Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Apply glow animation — remove first to allow retriggering
    el.classList.remove(GLOW_CLASS);
    // Force reflow so re-adding the class re-triggers the animation
    void el.offsetWidth;
    el.classList.add(GLOW_CLASS);

    // Remove the class after the animation completes (1.5s)
    setTimeout(() => {
      el.classList.remove(GLOW_CLASS);
    }, 1500);
  }, []);

  const getAnchors = useCallback(
    (kind: 'map-help'): { id: string; title: string }[] => {
      const result: { id: string; title: string }[] = [];
      registrationsRef.current.forEach((reg) => {
        if (reg.kind === kind) {
          result.push({ id: reg.id, title: reg.title });
        }
      });
      return result;
    },
    [],
  );

  const registry: HelpRegistry = {
    register,
    unregister,
    focus,
    getAnchors,
  };

  return (
    <HelpContext.Provider value={registry}>
      {/* Inject glow keyframe styles once */}
      <style>{`
        @keyframes helpAnchorGlow {
          0%   { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
          20%  { box-shadow: 0 0 12px 6px rgba(251,191,36,0.7); }
          60%  { box-shadow: 0 0 18px 8px rgba(251,191,36,0.5); }
          100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
        }
        .help-anchor-glow {
          animation: helpAnchorGlow 1.5s ease-out forwards;
        }
      `}</style>
      {children}
    </HelpContext.Provider>
  );
}
