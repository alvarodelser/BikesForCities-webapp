import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MobileTabs from './MobileTabs';

function setMobile() {
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

describe('MobileTabs', () => {
  beforeEach(() => {
    setMobile();
    window.location.hash = '';
  });

  it('renders only the active tab on mobile', () => {
    render(
      <MobileTabs defaultTab="a">
        <MobileTabs.Tab id="a" label="A">content-a</MobileTabs.Tab>
        <MobileTabs.Tab id="b" label="B">content-b</MobileTabs.Tab>
      </MobileTabs>,
    );
    expect(screen.getByText('content-a')).toBeInTheDocument();
    expect(screen.queryByText('content-b')).not.toBeInTheDocument();
  });

  it('switches tab on click and updates hash', () => {
    render(
      <MobileTabs defaultTab="a">
        <MobileTabs.Tab id="a" label="A">content-a</MobileTabs.Tab>
        <MobileTabs.Tab id="b" label="B">content-b</MobileTabs.Tab>
      </MobileTabs>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('content-b')).toBeInTheDocument();
    expect(window.location.hash).toBe('#tab=b');
  });

  it('reads initial tab from hash', () => {
    window.location.hash = '#tab=b';
    render(
      <MobileTabs defaultTab="a">
        <MobileTabs.Tab id="a" label="A">content-a</MobileTabs.Tab>
        <MobileTabs.Tab id="b" label="B">content-b</MobileTabs.Tab>
      </MobileTabs>,
    );
    expect(screen.getByText('content-b')).toBeInTheDocument();
  });
});
