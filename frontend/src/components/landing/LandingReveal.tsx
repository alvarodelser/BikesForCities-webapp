import React, { useEffect, useState } from 'react';
import { RevealContext } from '../../contexts/RevealContext';
import AnimatedB4CLogo from './AnimatedB4CLogo';
import { getCities } from '../../services/citiesCache';

type Phase = 'drawing' | 'exiting' | 'done';

interface Props {
  children: React.ReactNode;
}

const INTRO_KEY = 'b4c_intro_seen';
const MIN_MS = 900;
const MAX_MS = 3500;
const EXIT_MS = 700;

function alreadySeen(): boolean {
  try { return !!sessionStorage.getItem(INTRO_KEY); } catch { return true; }
}
function markSeen(): void {
  try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ }
}

const LandingReveal: React.FC<Props> = ({ children }) => {
  const skip = alreadySeen();
  const [phase, setPhase] = useState<Phase>(skip ? 'done' : 'drawing');
  const [revealed, setRevealed] = useState(skip);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (skip) return;
    if (prefersReduced) {
      setPhase('done');
      setRevealed(true);
      markSeen();
      return;
    }

    const minTimer = new Promise<void>(r => setTimeout(r, MIN_MS));
    const maxTimer = new Promise<void>(r => setTimeout(r, MAX_MS));
    const dataReady = getCities().catch(() => {});
    const fontsReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();

    const gate = Promise.race([
      Promise.all([minTimer, dataReady, fontsReady]),
      maxTimer,
    ]);

    gate.then(() => {
      setPhase('exiting');
      setTimeout(() => {
        setPhase('done');
        setRevealed(true);
        markSeen();
      }, EXIT_MS);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RevealContext.Provider value={{ revealed }}>
      {children}
      {phase !== 'done' && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--cream)',
            pointerEvents: phase === 'exiting' ? 'none' : undefined,
            opacity: phase === 'exiting' ? 0 : 1,
            transform: phase === 'exiting' ? 'translateY(-12px)' : 'translateY(0)',
            transition: phase === 'exiting'
              ? `opacity ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1), transform ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1)`
              : undefined,
          }}
        >
          <AnimatedB4CLogo
            style={{
              width: '110px',
              color: 'var(--blue-dark)',
              opacity: phase === 'exiting' ? 0 : 1,
              transform: phase === 'exiting' ? 'translateY(-30px) scale(0.35)' : 'none',
              transition: phase === 'exiting'
                ? `opacity 350ms ease-in, transform 500ms cubic-bezier(0.22,1,0.36,1)`
                : undefined,
            }}
          />
        </div>
      )}
    </RevealContext.Provider>
  );
};

export default LandingReveal;
