import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useViewport } from './useViewport';

type Listener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(initial: Record<string, boolean>) {
  const listeners: Record<string, Set<Listener>> = {};
  const state = { ...initial };
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: state[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: (_e: string, l: Listener) => {
      (listeners[query] ??= new Set()).add(l);
    },
    removeEventListener: (_e: string, l: Listener) => {
      listeners[query]?.delete(l);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
  return {
    set(query: string, matches: boolean) {
      state[query] = matches;
      listeners[query]?.forEach((l) =>
        l({ matches } as MediaQueryListEvent),
      );
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useViewport', () => {
  it('returns mobile below 768px', () => {
    mockMatchMedia({ '(min-width: 768px)': false, '(min-width: 1920px)': false });
    const { result } = renderHook(() => useViewport());
    expect(result.current.tier).toBe('mobile');
    expect(result.current.isMobile).toBe(true);
  });

  it('returns desktop between 768 and 1920', () => {
    mockMatchMedia({ '(min-width: 768px)': true, '(min-width: 1920px)': false });
    const { result } = renderHook(() => useViewport());
    expect(result.current.tier).toBe('desktop');
    expect(result.current.isDesktop).toBe(true);
  });

  it('returns ultrawide above 1920px', () => {
    mockMatchMedia({ '(min-width: 768px)': true, '(min-width: 1920px)': true });
    const { result } = renderHook(() => useViewport());
    expect(result.current.tier).toBe('ultrawide');
    expect(result.current.isUltrawide).toBe(true);
  });

  it('updates on media-query change', () => {
    const mm = mockMatchMedia({ '(min-width: 768px)': false, '(min-width: 1920px)': false });
    const { result } = renderHook(() => useViewport());
    expect(result.current.tier).toBe('mobile');
    act(() => mm.set('(min-width: 768px)', true));
    expect(result.current.tier).toBe('desktop');
  });
});
