import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileCompareRows } from './MobileCompareRows';
import type { CityData, Column } from './CityCompareTable';
import { BrowserRouter } from 'react-router';

const mockCities: CityData[] = [
  {
    path: '/barcelona',
    name: 'Barcelona',
    population: 1600000,
    coverage: 85,
    cyclingNetwork: 320,
    stations_count: 550,
    monthly_trips: 800000,
    service_name: 'Bicing',
    mayor: 'Ada Colau',
    mayor_party: 'PSC',
    available_modes: { infrastructure: true },
  },
];

const mockColumns: Column[] = [
  {
    key: 'population',
    label: 'Población',
    align: 'right',
    group: 'Base',
    render: (city) => city.population.toString(),
  },
  {
    key: 'coverage',
    label: 'Cobertura',
    align: 'right',
    group: 'Infraestructura',
    render: (city) => `${city.coverage}%`,
  },
];

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('MobileCompareRows', () => {
  it('renders city rows', () => {
    renderWithRouter(
      <MobileCompareRows
        cities={mockCities}
        selectedCityPaths={[]}
        onToggleCity={vi.fn()}
        visibleColumns={mockColumns}
      />
    );
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
  });

  it('renders all visible columns for each city', () => {
    renderWithRouter(
      <MobileCompareRows
        cities={mockCities}
        selectedCityPaths={[]}
        onToggleCity={vi.fn()}
        visibleColumns={mockColumns}
      />
    );
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('calls onToggleCity when a row is clicked', () => {
    const handleToggle = vi.fn();
    renderWithRouter(
      <MobileCompareRows
        cities={mockCities}
        selectedCityPaths={[]}
        onToggleCity={handleToggle}
        visibleColumns={mockColumns}
      />
    );
    const row = screen.getByText('Barcelona').closest('button');
    fireEvent.click(row!);
    expect(handleToggle).toHaveBeenCalledWith(mockCities[0]);
  });

  it('applies selection styling to selected cities', () => {
    renderWithRouter(
      <MobileCompareRows
        cities={mockCities}
        selectedCityPaths={['/barcelona']}
        onToggleCity={vi.fn()}
        visibleColumns={mockColumns}
      />
    );
    const row = screen.getByText('Barcelona').closest('button');
    expect(row).toHaveStyle({ backgroundColor: 'rgba(225, 172, 85, 0.45)' });
  });

  it('renders alternating row backgrounds for unselected cities', () => {
    const cities = [
      { ...mockCities[0], path: '/city1', name: 'City 1' },
      { ...mockCities[0], path: '/city2', name: 'City 2' },
    ];
    renderWithRouter(
      <MobileCompareRows
        cities={cities}
        selectedCityPaths={[]}
        onToggleCity={vi.fn()}
        visibleColumns={mockColumns}
      />
    );
    const rows = screen.getAllByText(/City \d/).map((el) => el.closest('button'));
    expect(rows[0]).toHaveStyle({ backgroundColor: 'rgba(255,255,255,0.02)' });
    expect(rows[1]).toHaveStyle({ backgroundColor: 'rgba(255,255,255,0.05)' });
  });
});
