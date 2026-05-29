// src/components/landing/showcase/MapsPanel.test.tsx
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

  it('renders all three mode labels', () => {
    render(<MemoryRouter><MapsPanel /></MemoryRouter>);
    expect(screen.getByText('Infraestructura')).toBeInTheDocument();
    expect(screen.getByText('Accidentes')).toBeInTheDocument();
    expect(screen.getByText('Tráfico')).toBeInTheDocument();
  });
});
