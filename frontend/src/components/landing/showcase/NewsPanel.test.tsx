// src/components/landing/showcase/NewsPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router';
import NewsPanel from './NewsPanel';

describe('NewsPanel', () => {
  it('renders section title and body copy', () => {
    render(<MemoryRouter><NewsPanel /></MemoryRouter>);
    expect(screen.getByText('La actualidad ciclista, de un vistazo')).toBeInTheDocument();
  });

  it('renders the featured article headline', () => {
    render(<MemoryRouter><NewsPanel /></MemoryRouter>);
    expect(screen.getByText(/Barcelona amplía/)).toBeInTheDocument();
  });

  it('renders all three news cards', () => {
    render(<MemoryRouter><NewsPanel /></MemoryRouter>);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(3);
  });
});
