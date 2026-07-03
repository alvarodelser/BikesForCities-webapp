import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import RankingsPanel from './RankingsPanel';

vi.mock('../../../services/api', () => ({
  fetchCities: vi.fn().mockResolvedValue([
    { name: 'Sevilla',   slug: 'sevilla',   path: '/sevilla',   population: 700000,  budget: null, geoCoords: { longitude: 0, latitude: 0 }, coverage: 82 },
    { name: 'Madrid',    slug: 'madrid',    path: '/madrid',    population: 3400000, budget: null, geoCoords: { longitude: 0, latitude: 0 }, coverage: 55 },
    { name: 'Barcelona', slug: 'barcelona', path: '/barcelona', population: 1600000, budget: null, geoCoords: { longitude: 0, latitude: 0 }, coverage: 61 },
    { name: 'Teruel',    slug: 'teruel',    path: '/teruel',    population: 36000,   budget: null, geoCoords: { longitude: 0, latitude: 0 } }, // no coverage
  ]),
}));

describe('RankingsPanel', () => {
  it('renders the section title', () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    expect(screen.getByText('Visita nuestro ranking de ciudades')).toBeInTheDocument();
  });

  it('renders city labels on the ribbon after data loads', async () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Sevilla')).toBeInTheDocument();
      expect(screen.getByText('Madrid')).toBeInTheDocument();
      expect(screen.getByText('Barcelona')).toBeInTheDocument();
    });
  });

  it('omits cities without coverage', async () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Sevilla')).toBeInTheDocument();
    });
    expect(screen.queryByText('Teruel')).not.toBeInTheDocument();
  });

  it('renders the ribbon SVG with its animated parallels', async () => {
    render(<MemoryRouter><RankingsPanel /></MemoryRouter>);
    await waitFor(() => {
      expect(document.querySelector('svg')).toBeInTheDocument();
    });
    expect(document.querySelectorAll('.rr-pl').length).toBeGreaterThan(50);
  });
});
