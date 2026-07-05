import React, { useEffect, useState } from 'react';
import { RevealContext } from '../../contexts/RevealContext';
import AnimatedB4CLogo from './AnimatedB4CLogo';
import { getCities } from '../../services/citiesCache';

type Phase = 'drawing' | 'filling' | 'exiting' | 'done';

interface Props {
  children: React.ReactNode;
}

const INTRO_KEY = 'b4c_intro_seen';
const MIN_MS = 1700;   // last stroke: 1040ms delay + 550ms draw = 1590ms
const MAX_MS = 4500;
const FILL_MS = 650;   // dark-green circle expands
const EXIT_MS = 650;   // curtain slides up

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
      // Phase 1 → filling: dark green expands from center
      setPhase('filling');

      setTimeout(() => {
        // Phase 2 → exiting: curtain slides up; hero starts composing
        setPhase('exiting');
        setRevealed(true);

        setTimeout(() => {
          setPhase('done');
          markSeen();
        }, EXIT_MS);
      }, FILL_MS);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isFilled = phase === 'filling' || phase === 'exiting';

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
            overflow: 'hidden',
            // Curtain slides up when exiting
            transform: phase === 'exiting' ? 'translateY(-100%)' : 'translateY(0)',
            transition: phase === 'exiting'
              ? `transform ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1)`
              : undefined,
          }}
        >
          {/* Dark-green fill that expands radially from center */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--blue-dark)',
              clipPath: isFilled
                ? 'circle(150% at 50% 50%)'
                : 'circle(0% at 50% 50%)',
              transition: phase === 'filling'
                ? `clip-path ${FILL_MS}ms cubic-bezier(0.22,1,0.36,1)`
                : undefined,
            }}
          />

          {/* Bicycle — color flips to cream as dark fill covers it */}
          <AnimatedB4CLogo
            style={{
              position: 'relative',
              zIndex: 1,
              width: '110px',
              color: isFilled ? 'var(--cream)' : 'var(--blue-dark)',
              transition: 'color 250ms ease-in',
            }}
          />
        </div>
      )}
    </RevealContext.Provider>
  );
};

export default LandingReveal;
