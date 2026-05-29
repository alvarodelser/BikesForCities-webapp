import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MemoryRouter } from 'react-router';
import RankingsPanel from './RankingsPanel';

beforeAll(() => {
  // ResponsiveChart reads el.clientWidth — stub to a non-zero value
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return 300; },
  });

  global.ResizeObserver = vi.fn().mockImplementation((cb: ResizeObserverCallback) => ({
    observe: () => cb([], {} as ResizeObserver),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

vi.mock('../../../services/api', () => ({
  fetchCities: vi.fn().mockResolvedValue([
    { name: 'Sevilla',   slug: 'sevilla',   path: '/sevilla',   population: 700000,  budget: null, geoCoords: { longitude: 0, latitude: 0 }, cyclingNetwork: 180 },
    { name: 'Madrid',    slug: 'madrid',    path: '/madrid',    population: 3400000, budget: null, geoCoords: { longitude: 0, latitude: 0 }, cyclingNetwork: 120 },
    { name: 'Barcelona', slug: 'barcelona', path: '/barcelona', population: 1600000, budget: null, geoCoords: { longitude: 0, latitude: 0 }, cyclingNetwork: 95  },
  ]),
}));

describe('RankingsPanel', () => {
  it('renders the section title', () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    expect(screen.getByText('Visita nuestro ranking de ciudades')).toBeInTheDocument();
  });

  it('renders city names after data loads', async () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Sevilla')).toBeInTheDocument();
      expect(screen.getByText('Madrid')).toBeInTheDocument();
    });
  });

  it('renders the chart SVG', async () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    await waitFor(() => {
      expect(document.querySelector('svg')).toBeInTheDocument();
    });
  });
});
