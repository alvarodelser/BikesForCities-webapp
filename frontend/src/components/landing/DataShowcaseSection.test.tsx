import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MemoryRouter } from 'react-router';
import DataShowcaseSection from './DataShowcaseSection';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return 300; },
  });
  global.ResizeObserver = vi.fn().mockImplementation((cb: ResizeObserverCallback) => ({
    observe: () => cb([], {} as ResizeObserver),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return false; },
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
});

vi.mock('../../services/api', () => ({
  fetchCities: vi.fn().mockResolvedValue([]),
}));

describe('DataShowcaseSection', () => {
  it('renders the section title', () => {
    render(<MemoryRouter><DataShowcaseSection /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Los datos están/i })).toBeInTheDocument();
  });

  it('renders all three audience pills', () => {
    render(<MemoryRouter><DataShowcaseSection /></MemoryRouter>);
    expect(screen.getByText('Ciudadanos')).toBeInTheDocument();
    expect(screen.getByText('Asociaciones')).toBeInTheDocument();
    expect(screen.getByText('Ayuntamientos')).toBeInTheDocument();
  });

  it('renders all three panel titles', () => {
    render(<MemoryRouter><DataShowcaseSection /></MemoryRouter>);
    expect(screen.getByText('Visita nuestro ranking de ciudades')).toBeInTheDocument();
    expect(screen.getByText('La actualidad ciclista, de un vistazo')).toBeInTheDocument();
    expect(screen.getByText('Modelos de movilidad para tu ciudad')).toBeInTheDocument();
  });
});
