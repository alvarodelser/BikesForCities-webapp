import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FilterCard } from './TrafficStats';
import { Network } from 'lucide-react';

const OPTIONS = [
  { value: 'real', label: 'GPS real' },
  { value: 'station_based', label: 'Estaciones' },
  { value: 'buildings_population', label: 'Población' },
];

const PER_OPTION = {
  real: 'GPS text.',
  station_based: 'Stations text.',
  buildings_population: 'Population text.',
};

function openHelp() {
  fireEvent.click(screen.getByRole('button', { name: /mostrar información/i }));
}

describe('FilterCard — per-option methodology accordion', () => {
  it('shows active option text expanded when help is open', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    expect(screen.getByText('GPS text.')).toBeInTheDocument();
  });

  it('does not show other options text by default', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    expect(screen.queryByText('Stations text.')).not.toBeInTheDocument();
    expect(screen.queryByText('Population text.')).not.toBeInTheDocument();
  });

  it('shows chevron buttons for non-active options', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    expect(screen.getByRole('button', { name: /expandir estaciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expandir población/i })).toBeInTheDocument();
  });

  it('expands an individual other option on click', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    fireEvent.click(screen.getByRole('button', { name: /expandir estaciones/i }));
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    expect(screen.queryByText('Population text.')).not.toBeInTheDocument();
  });

  it('collapses an expanded other option when clicked again', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    fireEvent.click(screen.getByRole('button', { name: /expandir estaciones/i }));
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /colapsar estaciones/i }));
    expect(screen.queryByText('Stations text.')).not.toBeInTheDocument();
  });

  it('shows all options collapsed when no activeValue', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue={undefined}
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    expect(screen.queryByText('GPS text.')).not.toBeInTheDocument();
    expect(screen.queryByText('Stations text.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expandir gps real/i })).toBeInTheDocument();
  });

  it('falls back to flat text when only helpComoSeRecogieron is provided', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpComoSeRecogieron="Flat fallback text."
      />,
    );
    openHelp();
    expect(screen.getByText('Flat fallback text.')).toBeInTheDocument();
  });

  it('collapses expanded others when help is closed and reopened', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    fireEvent.click(screen.getByRole('button', { name: /expandir estaciones/i }));
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cerrar información/i }));
    openHelp();
    expect(screen.queryByText('Stations text.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expandir estaciones/i })).toBeInTheDocument();
  });
});
