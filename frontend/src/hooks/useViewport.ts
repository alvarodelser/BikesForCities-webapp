import { useEffect, useState } from 'react';

export type ViewportTier = 'mobile' | 'desktop' | 'ultrawide';

export interface Viewport {
  tier: ViewportTier;
  isMobile: boolean;
  isDesktop: boolean;
  isUltrawide: boolean;
}

const DESKTOP_Q = '(min-width: 768px)';
const ULTRA_Q = '(min-width: 1920px)';

function tierFrom(desktop: boolean, ultra: boolean): ViewportTier {
  if (ultra) return 'ultrawide';
  if (desktop) return 'desktop';
  return 'mobile';
}

function readTier(): ViewportTier {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop';
  return tierFrom(
    window.matchMedia(DESKTOP_Q).matches,
    window.matchMedia(ULTRA_Q).matches,
  );
}

export function useViewport(): Viewport {
  const [tier, setTier] = useState<ViewportTier>(readTier);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const desktopMQ = window.matchMedia(DESKTOP_Q);
    const ultraMQ = window.matchMedia(ULTRA_Q);
    const update = () => setTier(tierFrom(desktopMQ.matches, ultraMQ.matches));
    desktopMQ.addEventListener('change', update);
    ultraMQ.addEventListener('change', update);
    update();
    return () => {
      desktopMQ.removeEventListener('change', update);
      ultraMQ.removeEventListener('change', update);
    };
  }, []);

  return {
    tier,
    isMobile: tier === 'mobile',
    isDesktop: tier === 'desktop',
    isUltrawide: tier === 'ultrawide',
  };
}
