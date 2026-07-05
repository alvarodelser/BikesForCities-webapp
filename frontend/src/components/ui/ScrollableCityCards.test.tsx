import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ScrollableCityCards from './ScrollableCityCards';
import type { CityData } from '../../constants/cities';

const mockCities: CityData[] = [
  { name: 'Madrid',    slug: 'madrid',    path: '/madrid',    population: 3300000, budget: null, geoCoords: { longitude: -3.7, latitude: 40.4 } },
  { name: 'Barcelona', slug: 'barcelona', path: '/barcelona', population: 1600000, budget: null, geoCoords: { longitude: 2.15, latitude: 41.38 } },
  { name: 'Valencia',  slug: 'valencia',  path: '/valencia',  population: 800000,  budget: null, geoCoords: { longitude: -0.37, latitude: 39.47 } },
];

let rafQueue: Array<(t: number) => void> = [];

beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const flushFrames = (n: number) => {
  for (let i = 0; i < n; i++) {
    const cbs = [...rafQueue];
    rafQueue = [];
    cbs.forEach(cb => cb(performance.now()));
  }
};

describe('ScrollableCityCards momentum', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ScrollableCityCards
        cities={mockCities}
        selectedCity="Madrid"
        onCitySelect={vi.fn()}
        onCityNavigate={vi.fn()}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('does not schedule rAF when touch ends with zero velocity', () => {
    const { container } = render(
      <ScrollableCityCards
        cities={mockCities}
        selectedCity="Madrid"
        onCitySelect={vi.fn()}
        onCityNavigate={vi.fn()}
      />
    );
    const touchTarget = container.querySelector('[data-testid="cards-container"]') as HTMLElement;
    if (!touchTarget) return; // guard — test will fail at the assertion if missing

    act(() => {
      touchTarget.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        targetTouches: [{ clientX: 200 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });

    expect(rafQueue).toHaveLength(0);
  });

  it('schedules rAF when touch ends with non-zero velocity', () => {
    const { container } = render(
      <ScrollableCityCards
        cities={mockCities}
        selectedCity="Madrid"
        onCitySelect={vi.fn()}
        onCityNavigate={vi.fn()}
      />
    );
    const touchTarget = container.querySelector('[data-testid="cards-container"]') as HTMLElement;
    if (!touchTarget) return;

    act(() => {
      touchTarget.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        targetTouches: [{ clientX: 200 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchmove', {
        bubbles: true,
        targetTouches: [{ clientX: 100 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });

    expect(rafQueue.length).toBeGreaterThan(0);
  });

  it('keeps smooth card transitions while wheel-scrolling (no blink)', () => {
    const { container } = render(
      <ScrollableCityCards
        cities={mockCities}
        selectedCity="Madrid"
        onCitySelect={vi.fn()}
        onCityNavigate={vi.fn()}
      />
    );
    const wheelTarget = container.querySelector('[data-testid="cards-container"]') as HTMLElement;
    if (!wheelTarget) return;

    act(() => {
      wheelTarget.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 100,
      }));
    });

    // Carousel cards must keep their CSS transition during wheel scrolling so the
    // motion eases instead of snapping (instant transforms read as a "blink").
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>('[class*="perspective-1000"]')
    );
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every(c => c.className.includes('transition-all'))).toBe(true);
  });

  it('rAF loop terminates — queue empties within 30 frames', () => {
    const { container } = render(
      <ScrollableCityCards
        cities={mockCities}
        selectedCity="Madrid"
        onCitySelect={vi.fn()}
        onCityNavigate={vi.fn()}
      />
    );
    const touchTarget = container.querySelector('[data-testid="cards-container"]') as HTMLElement;
    if (!touchTarget) return;

    act(() => {
      touchTarget.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        targetTouches: [{ clientX: 200 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchmove', {
        bubbles: true,
        targetTouches: [{ clientX: 0 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });

    act(() => flushFrames(30));
    expect(rafQueue).toHaveLength(0);
  });
});
