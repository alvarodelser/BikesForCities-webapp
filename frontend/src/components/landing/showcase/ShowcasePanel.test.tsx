import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShowcasePanel from './ShowcasePanel';

function mockMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return false; },
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
}

describe('ShowcasePanel', () => {
  beforeEach(() => {
    mockMatchMedia();
  });

  const baseProps = {
    graphic: <div data-testid="graphic">chart</div>,
    eyebrow: 'Rankings · ciudades',
    title: 'Visita nuestro ranking',
    body: 'Cuerpo del panel.',
    ctaLabel: 'Ver ranking →',
    onCta: vi.fn(),
  };

  it('renders eyebrow, title, body and CTA', () => {
    render(<ShowcasePanel {...baseProps} />);
    expect(screen.getByText('Rankings · ciudades')).toBeInTheDocument();
    expect(screen.getByText('Visita nuestro ranking')).toBeInTheDocument();
    expect(screen.getByText('Cuerpo del panel.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver ranking →' })).toBeInTheDocument();
  });

  it('renders the graphic slot', () => {
    render(<ShowcasePanel {...baseProps} />);
    expect(screen.getByTestId('graphic')).toBeInTheDocument();
  });
});
