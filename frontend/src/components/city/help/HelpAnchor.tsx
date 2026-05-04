import {
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { useHelpContext } from './HelpContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HelpAnchorProps {
  id: string;
  title: string;
  kind?: 'mode-help' | 'map-help';
  defaultOpen?: boolean;
  children: ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HelpAnchor({
  id,
  title,
  kind = 'mode-help',
  defaultOpen = false,
  children,
}: HelpAnchorProps) {
  const helpCtx = useHelpContext();
  // Ref points at the <details> element so focus() can scroll & glow it.
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    // register expects RefObject<HTMLElement>; cast is safe — HTMLDetailsElement
    // extends HTMLElement.
    helpCtx.register(id, ref as React.RefObject<HTMLElement>, kind, title);
    return () => {
      helpCtx.unregister(id);
    };
  }, [id, kind, title, helpCtx]);

  return (
    <details
      ref={ref}
      open={defaultOpen}
      className="rounded-xl overflow-hidden border border-white/20 bg-white/5 transition-all duration-300"
    >
      <summary
        className={[
          'flex items-center justify-between gap-2 px-4 py-3 cursor-pointer select-none',
          'text-sm font-semibold tracking-wide',
          'hover:bg-white/10 transition-colors duration-200',
          // Remove default triangle marker
          'list-none [&::-webkit-details-marker]:hidden',
        ].join(' ')}
      >
        <span>{title}</span>
        {/* Custom chevron that rotates when open */}
        <span
          className="transition-transform duration-300 details-chevron text-white/60"
          aria-hidden="true"
        >
          <style>{`
            details[open] .details-chevron { transform: rotate(180deg); }
          `}</style>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 5.5L8 10.5L13 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-white/80">
        {children}
      </div>
    </details>
  );
}

export default HelpAnchor;
