import React from 'react';
import { useViewport } from '../../../hooks/useViewport';

interface ShowcasePanelProps {
  flip?: boolean;
  graphic: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}

const CARD_STYLE: React.CSSProperties = {
  borderRadius: 20,
  background: 'var(--cream)',
  boxShadow: [
    'inset 0 2px 8px rgba(0,56,73,0.06)',
    'inset 0 0 0 1.5px rgba(0,56,73,0.08)',
    '0 4px 20px rgba(0,56,73,0.05)',
  ].join(', '),
  padding: '24px 22px 20px',
  minHeight: 190,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  overflow: 'hidden',
};

const ShowcasePanel: React.FC<ShowcasePanelProps> = ({
  flip = false,
  graphic,
  eyebrow,
  title,
  body,
  ctaLabel,
  onCta,
}) => {
  const { isMobile } = useViewport();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : flip ? 'row-reverse' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        padding: isMobile ? '28px 20px' : '44px 52px',
        gap: isMobile ? 20 : 40,
        background: 'var(--cream)',
        borderTop: '1px solid rgba(0,56,73,0.07)',
      }}
    >
      {/* Graphic card */}
      <div
        style={{
          ...CARD_STYLE,
          flex: isMobile ? '0 0 auto' : '0 0 46%',
          minHeight: isMobile ? 180 : 190,
          width: isMobile ? '100%' : undefined,
        }}
      >
        {graphic}
      </div>

      {/* Text block */}
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--green-dark)',
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          {eyebrow}
        </p>
        <h3
          className="font-heading font-bold"
          style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
            lineHeight: 1.25,
            color: 'var(--blue-dark)',
            marginBottom: 10,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: '0.85rem',
            lineHeight: 1.7,
            color: 'var(--blue)',
            opacity: 0.85,
          }}
        >
          {body}
        </p>
        <button
          type="button"
          aria-label={`${ctaLabel} — ${title}`}
          onClick={onCta}
          style={{
            display: 'inline-block',
            marginTop: 18,
            fontSize: '0.68rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 700,
            padding: '8px 18px',
            borderRadius: 20,
            background: 'var(--blue-dark)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default ShowcasePanel;
