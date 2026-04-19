import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ColumnGroupPicker } from './ColumnGroupPicker';
import { Network, Activity, Users } from 'lucide-react';

const mockGroups = [
  { id: 'Infraestructura', label: 'Infraestructura', icon: Network },
  { id: 'Servicio Bici', label: 'Servicio Bici', icon: Activity },
  { id: 'Ayuntamiento', label: 'Ayuntamiento', icon: Users },
];

describe('ColumnGroupPicker', () => {
  it('renders all group pills', () => {
    const handleToggle = vi.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set(['Infraestructura'])}
        onToggle={handleToggle}
      />
    );
    expect(screen.getByText('Infraestructura')).toBeInTheDocument();
    expect(screen.getByText('Servicio Bici')).toBeInTheDocument();
    expect(screen.getByText('Ayuntamiento')).toBeInTheDocument();
  });

  it('renders Base pill as read-only', () => {
    const handleToggle = vi.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set([])}
        onToggle={handleToggle}
      />
    );
    const basePill = screen.getByText('Base');
    expect(basePill).toBeInTheDocument();
    expect(basePill.closest('div')).toHaveClass('opacity-50');
  });

  it('calls onToggle when a group pill is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set([])}
        onToggle={handleToggle}
      />
    );
    const infraPill = screen.getByText('Infraestructura').closest('button');
    fireEvent.click(infraPill!);
    expect(handleToggle).toHaveBeenCalledWith('Infraestructura');
  });

  it('applies active styling to expanded groups', () => {
    const handleToggle = vi.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set(['Infraestructura'])}
        onToggle={handleToggle}
      />
    );
    const infraPill = screen.getByText('Infraestructura').closest('button');
    expect(infraPill).toHaveClass('bg-white/20');
  });

  it('applies inactive styling to collapsed groups', () => {
    const handleToggle = vi.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set([])}
        onToggle={handleToggle}
      />
    );
    const infraPill = screen.getByText('Infraestructura').closest('button');
    expect(infraPill).toHaveClass('bg-white/10');
  });
});
