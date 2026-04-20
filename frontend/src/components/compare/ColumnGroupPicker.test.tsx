import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ColumnGroupPicker } from './ColumnGroupPicker';
import type { ColumnGroup } from './CityCompareTable';
import { Network, Activity, Users } from 'lucide-react';

const mockGroups: ColumnGroup[] = [
  { id: 'Infraestructura', label: 'Infraestructura', icon: Network },
  { id: 'Servicio Bici', label: 'Servicio Bici', icon: Activity },
  { id: 'Ayuntamiento', label: 'Ayuntamiento', icon: Users },
];

describe('ColumnGroupPicker', () => {
  it('renders all group buttons', () => {
    const handleSelect = vi.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        activeGroup="Infraestructura"
        onSelect={handleSelect}
      />
    );
    expect(screen.getByText('Infraestructura')).toBeInTheDocument();
    expect(screen.getByText('Servicio Bici')).toBeInTheDocument();
    expect(screen.getByText('Ayuntamiento')).toBeInTheDocument();
  });

  it('calls onSelect when a group button is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        activeGroup="Infraestructura"
        onSelect={handleSelect}
      />
    );
    const serviceButton = screen.getByText('Servicio Bici').closest('button');
    fireEvent.click(serviceButton!);
    expect(handleSelect).toHaveBeenCalledWith('Servicio Bici');
  });

  it('applies active styling and underline to the active group', () => {
    const handleSelect = vi.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        activeGroup="Infraestructura"
        onSelect={handleSelect}
      />
    );
    const infraButton = screen.getByText('Infraestructura').closest('button');
    expect(infraButton).toHaveClass('text-white');
    
    // Check for the underline span
    const underline = infraButton?.querySelector('span.absolute.bottom-0');
    expect(underline).toBeInTheDocument();
    expect(underline).toHaveClass('bg-[var(--green-light)]');
  });

  it('applies inactive styling to other groups', () => {
    const handleSelect = vi.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        activeGroup="Infraestructura"
        onSelect={handleSelect}
      />
    );
    const serviceButton = screen.getByText('Servicio Bici').closest('button');
    expect(serviceButton).toHaveClass('text-white/40');
    
    const underline = serviceButton?.querySelector('span.absolute.bottom-0');
    expect(underline).not.toBeInTheDocument();
  });
});
