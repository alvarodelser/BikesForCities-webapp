import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GlassCard from '../../components/ui/GlassCard';

describe('GlassCard Component', () => {
  // Basic Rendering Tests
  describe('Basic Rendering', () => {
    it('renders children correctly', () => {
      render(<GlassCard>Test Content</GlassCard>);
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('applies default variant when no variant specified', () => {
      const { container } = render(<GlassCard>Default Variant</GlassCard>);
      const card = container.firstChild;
      expect(card).toHaveClass('bg-white/10');
      expect(card).toHaveClass('backdrop-blur-md');
      expect(card).toHaveClass('border-2');
      expect(card).toHaveClass('border-white/20');
    });
  });

  // Variant Tests
  describe('Variants', () => {
    it('renders default variant correctly', () => {
      const { container } = render(<GlassCard variant="default">Default</GlassCard>);
      const card = container.firstChild;
      expect(card).toHaveClass('bg-white/10');
      expect(card).toHaveClass('border-2');
    });

    it('renders inset variant correctly', () => {
      const { container } = render(<GlassCard variant="inset">Inset</GlassCard>);
      const card = container.firstChild;
      expect(card).toHaveClass('border-2');
      expect(card).toHaveClass('border-white/20');
    });
  });

  // Layout Tests
  describe('Layout', () => {
    it('applies flex layout by default', () => {
      const { container } = render(
        <GlassCard>
          <div>Item 1</div>
          <div>Item 2</div>
        </GlassCard>
      );
      const contentWrapper = container.querySelector('.flex');
      expect(contentWrapper).toHaveClass('flex');
      expect(contentWrapper).toHaveClass('items-center');
      expect(contentWrapper).toHaveClass('gap-4');
    });

    it('applies block layout when specified', () => {
      const { container } = render(
        <GlassCard layout="block">Block Layout</GlassCard>
      );
      const contentWrapper = container.querySelector('.relative.z-10');
      expect(contentWrapper).not.toHaveClass('flex');
      expect(contentWrapper).not.toHaveClass('items-center');
      expect(contentWrapper).not.toHaveClass('gap-4');
    });
  });

  // Background Color Tests
  describe('Background Color', () => {
    it('applies custom background color', () => {
      const { container } = render(
        <GlassCard backgroundColor="rgba(0,0,0,0.5)">Colored Background</GlassCard>
      );
      const card = container.firstChild;
      expect(card).toHaveStyle('background-color: rgba(0,0,0,0.5)');
    });
  });

  // Hover Tests
  describe('Hover Effects', () => {
    it('applies hover effects when hover prop is true', () => {
      const { container } = render(
        <GlassCard hover>Hoverable Card</GlassCard>
      );
      const card = container.firstChild;
      expect(card).toHaveClass('hover:bg-white/15');
      expect(card).toHaveClass('hover:scale-[1.02]');
    });

    it('does not apply hover effects when hover prop is false', () => {
      const { container } = render(
        <GlassCard hover={false}>Non-Hoverable Card</GlassCard>
      );
      const card = container.firstChild;
      expect(card).not.toHaveClass('hover:bg-white/15');
      expect(card).not.toHaveClass('hover:scale-[1.02]');
    });

    it('applies custom hover border color', () => {
      const { container } = render(
        <GlassCard 
          hover 
          hoverBorderColor="rgba(255,0,0,0.5)"
        >
          Custom Hover Border
        </GlassCard>
      );
      const card = container.firstChild;
      expect(card).toHaveStyle('--hover-border-color: rgba(255,0,0,0.5)');
    });
  });

  // Click Interaction Tests
  describe('Click Interactions', () => {
    it('calls onClick handler when clicked', () => {
      const mockClickHandler = vi.fn();
      render(
        <GlassCard onClick={mockClickHandler}>Clickable Card</GlassCard>
      );
      const card = screen.getByText('Clickable Card');
      fireEvent.click(card);
      expect(mockClickHandler).toHaveBeenCalledTimes(1);
    });
  });

  // Reflection and Highlight Tests
  describe('Reflection and Highlight', () => {
    it('renders reflection for default variant', () => {
      const { container } = render(<GlassCard>Reflective Card</GlassCard>);
      const reflection = container.querySelector('.bg-gradient-to-b');
      expect(reflection).toBeInTheDocument();
    });

    it('does not render reflection for inset variant', () => {
      const { container } = render(<GlassCard variant="inset">Inset Card</GlassCard>);
      const reflection = container.querySelector('.bg-gradient-to-b');
      expect(reflection).not.toBeInTheDocument();
    });
  });
});
});