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

describe('FilterCard — per-option methodology', () => {
  it('shows the active option text in metodología when help is open', () => {
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

  it('does not show other options text before toggle', () => {
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

  it('shows "Ver otros (2)" toggle button', () => {
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
    expect(screen.getByRole('button', { name: /ver otros \(2\)/i })).toBeInTheDocument();
  });

  it('expands other options on toggle click', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /ver otros/i }));
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    expect(screen.getByText('Population text.')).toBeInTheDocument();
  });

  it('collapses other options when toggle clicked again', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /ver otros/i }));
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ocultar otras opciones/i }));
    expect(screen.queryByText('Stations text.')).not.toBeInTheDocument();
  });

  it('shows all options equally when no activeValue', () => {
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
    expect(screen.getByText('GPS text.')).toBeInTheDocument();
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    expect(screen.getByText('Population text.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver otros/i })).not.toBeInTheDocument();
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

  it('collapses others when help is closed and reopened', () => {
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
    // Open help, expand others
    openHelp();
    fireEvent.click(screen.getByRole('button', { name: /ver otros/i }));
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    // Close help
    fireEvent.click(screen.getByRole('button', { name: /cerrar información/i }));
    // Reopen help — others should be collapsed again
    openHelp();
    expect(screen.queryByText('Stations text.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver otros \(2\)/i })).toBeInTheDocument();
  });
});
