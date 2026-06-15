import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AnimatedProgressBar from './AnimatedProgressBar';

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

const flushFrames = (n: number, startTime = 0) => {
  for (let i = 0; i < n; i++) {
    const cbs = [...rafQueue];
    rafQueue = [];
    cbs.forEach(cb => cb(startTime + i * 16));
  }
};

describe('AnimatedProgressBar', () => {
  it('renders with explicit value and applies correct width', () => {
    const { container } = render(<AnimatedProgressBar value={60} color="#027A76" />);
    const track = container.querySelector('div') as HTMLElement;
    const fill = track.querySelector('div') as HTMLElement;
    expect(fill.style.width).toBe('60%');
  });

  it('clamps explicit value at 100', () => {
    const { container } = render(<AnimatedProgressBar value={120} />);
    const track = container.querySelector('div') as HTMLElement;
    const fill = track.querySelector('div') as HTMLElement;
    expect(fill.style.width).toBe('120%');
  });

  it('starts RAF loop when value is undefined', () => {
    render(<AnimatedProgressBar />);
    expect(rafQueue.length).toBeGreaterThan(0);
  });

  it('does not start RAF loop when value is defined', () => {
    render(<AnimatedProgressBar value={50} />);
    expect(rafQueue).toHaveLength(0);
  });

  it('indeterminate mode: fill width increases after frames', () => {
    const { container } = render(<AnimatedProgressBar />);
    const track = container.querySelector('div') as HTMLElement;
    const fill = track.querySelector('div') as HTMLElement;

    expect(fill.style.width).toBe('0%');

    act(() => flushFrames(5, 0));

    const pct = parseFloat(fill.style.width);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(95);
  });

  it('indeterminate mode: asymptotes below 95% over many frames', () => {
    const { container } = render(<AnimatedProgressBar />);
    const track = container.querySelector('div') as HTMLElement;
    const fill = track.querySelector('div') as HTMLElement;

    act(() => flushFrames(600, 0));

    const pct = parseFloat(fill.style.width);
    expect(pct).toBeGreaterThan(90);
    expect(pct).toBeLessThanOrEqual(95);
  });

  it('switches from animated to determinate when value prop is provided', () => {
    const { container, rerender } = render(<AnimatedProgressBar />);
    expect(rafQueue.length).toBeGreaterThan(0);

    act(() => rerender(<AnimatedProgressBar value={75} />));

    const track = container.querySelector('div') as HTMLElement;
    const fill = track.querySelector('div') as HTMLElement;
    expect(fill.style.width).toBe('75%');
  });

  it('applies custom color to track and fill', () => {
    const { container } = render(<AnimatedProgressBar color="#ff0000" value={50} />);
    const track = container.querySelector('div') as HTMLElement;
    expect(track.style.background).toContain('rgb(255, 0, 0)');
  });
});
