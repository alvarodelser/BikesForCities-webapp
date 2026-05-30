import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import MapsPanel from './MapsPanel';

vi.mock('../../../services/api', () => ({
  fetchCities: vi.fn().mockResolvedValue([]),
}));

describe('MapsPanel', () => {
  it('renders section title', () => {
    render(<MemoryRouter><MapsPanel /></MemoryRouter>);
    expect(screen.getByText('Modelos de movilidad para tu ciudad')).toBeInTheDocument();
  });

  it('renders the traffic O/D map image with correct src and alt', () => {
    render(<MemoryRouter><MapsPanel /></MemoryRouter>);
    const img = screen.getByAltText('Mapa de flujos origen-destino de movilidad ciclista');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/landing/map_traffic_od.png');
  });

  it('renders the CTA button', () => {
    render(<MemoryRouter><MapsPanel /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /explorar mapas/i })).toBeInTheDocument();
  });
});
