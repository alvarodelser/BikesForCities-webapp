import React from 'react';
import { useNavigate } from 'react-router';
import B4CLogo from '../../ui/B4CLogo';
import ShowcasePanel from './ShowcasePanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: number;
  headline: string;
  excerpt: string;
  source: string;
  date: string;
  category: string;
  comments: number;
  url: string;
}

// NOTE: Replace with API/CMS fetch in a future iteration.
export const STATIC_NEWS: NewsItem[] = [
  {
    id: 1,
    headline: 'Barcelona amplía su red de carriles bici en 40 km',
    excerpt: 'El ayuntamiento aprueba la mayor inversión en infraestructura ciclista de la última década, con nuevos ejes en Sant Martí y Eixample.',
    source: 'El País',
    date: '27 may.',
    category: 'Infraestructura',
    comments: 34,
    url: '#',
  },
  {
    id: 2,
    headline: 'El uso de la bici sube un 18% en ciudades medianas',
    excerpt: 'Los datos del último trimestre confirman el crecimiento sostenido.',
    source: 'Movilidad Sostenible',
    date: '22 may.',
    category: 'Datos',
    comments: 18,
    url: '#',
  },
  {
    id: 3,
    headline: 'Sevilla, referente europeo en infraestructura ciclista',
    excerpt: 'Un informe de la Comisión Europea la sitúa entre las diez mejores ciudades del continente.',
    source: 'La Vanguardia',
    date: '19 may.',
    category: 'Política',
    comments: 11,
    url: '#',
  },
];

// ─── Design tokens ────────────────────────────────────────────────────────────

const INK       = '#1a1a1a';
const INK_MID   = 'rgba(0,0,0,0.55)';
const INK_DIM   = 'rgba(0,0,0,0.35)';
const RULE = 'rgba(0,0,0,0.12)';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Kicker({ label }: { label: string }) {
  return (
    <p style={{
      fontSize: '0.52rem', letterSpacing: '0.16em', textTransform: 'uppercase',
      fontWeight: 700, color: INK_MID, margin: '0 0 5px',
      fontFamily: 'EB Garamond, Georgia, serif',
    }}>
      {label}
    </p>
  );
}

function CommentCount({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: INK_DIM, fontSize: '0.55rem' }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <rect x="0.5" y="0.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="0.9"/>
        <path d="M2.5 9L4 7.5h5.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
      </svg>
      {n}
    </span>
  );
}

// ─── Masthead ─────────────────────────────────────────────────────────────────

function Masthead() {
  return (
    <div style={{ padding: '10px 14px 0', fontFamily: 'EB Garamond, Georgia, serif' }}>
      <div style={{ borderTop: `1px solid ${RULE}`, marginBottom: 6 }} />

      {/* Logo left · title centred · date right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <B4CLogo style={{ height: 30, width: 'auto', color: INK, opacity: 0.8, justifySelf: 'start' }} />
        <h2 style={{
          fontSize: '1.45rem', fontWeight: 400, letterSpacing: '0.02em',
          color: INK, margin: 0, lineHeight: 1,
          fontFamily: 'EB Garamond, Georgia, serif',
        }}>
          Bikes for Cities
        </h2>
        <p style={{ fontSize: '0.5rem', color: INK_DIM, margin: 0, whiteSpace: 'nowrap', justifySelf: 'end' }}>
          Mayo 2026 · Nº 24
        </p>
      </div>

      <div style={{ borderBottom: `1px solid ${RULE}` }} />
    </div>
  );
}

// ─── Featured story (left column) ────────────────────────────────────────────

function FeaturedStory({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', flexDirection: 'column',
        padding: '12px 14px 12px 14px',
        textDecoration: 'none',
        height: '100%', boxSizing: 'border-box',
        borderRight: `1px solid ${RULE}`,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.025)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Kicker label={item.category} />

      <p style={{
        fontSize: '1.15rem', fontWeight: 400, lineHeight: 1.2,
        color: INK, margin: '0 0 8px',
        fontFamily: 'EB Garamond, Georgia, serif',
        letterSpacing: '-0.01em',
      }}>
        {item.headline}
      </p>

      <div style={{ height: 1, background: RULE, margin: '0 0 8px' }} />

      <p style={{
        fontSize: '0.75rem', lineHeight: 1.55, color: INK_MID,
        margin: '0 0 auto',
        fontFamily: 'EB Garamond, Georgia, serif',
      }}>
        {item.excerpt}
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 10, paddingTop: 8, borderTop: `1px solid ${RULE}`,
      }}>
        <span style={{ fontSize: '0.55rem', color: INK_DIM, fontStyle: 'italic', fontFamily: 'EB Garamond, Georgia, serif' }}>
          {item.source} — {item.date}
        </span>
        <CommentCount n={item.comments} />
      </div>
    </a>
  );
}

// ─── Secondary story ─────────────────────────────────────────────────────────

function SecondaryStory({ item, withRule }: { item: NewsItem; withRule: boolean }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', flexDirection: 'column',
        padding: '10px 12px',
        textDecoration: 'none', flex: 1,
        borderBottom: withRule ? `1px solid ${RULE}` : 'none',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.025)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Kicker label={item.category} />
      <p style={{
        fontSize: '0.88rem', fontWeight: 400, lineHeight: 1.3,
        color: INK, margin: '0 0 auto',
        fontFamily: 'EB Garamond, Georgia, serif',
      }}>
        {item.headline}
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 8,
      }}>
        <span style={{ fontSize: '0.52rem', color: INK_DIM, fontStyle: 'italic', fontFamily: 'EB Garamond, Georgia, serif' }}>
          {item.source} — {item.date}
        </span>
        <CommentCount n={item.comments} />
      </div>
    </a>
  );
}

// ─── Newspaper graphic ────────────────────────────────────────────────────────

function NewsGraphic() {
  const [lead, ...rest] = STATIC_NEWS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'relative' }}>
      {/* Watermark overlay — blocks clicks and marks content as in progress */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'default', pointerEvents: 'all',
      }}>
        <span style={{
          transform: 'rotate(-25deg)',
          fontSize: '1.35rem', fontWeight: 700,
          color: 'rgba(0,0,0,0.38)',
          textTransform: 'uppercase', letterSpacing: '0.22em',
          userSelect: 'none', whiteSpace: 'nowrap',
          border: '2.5px solid rgba(0,0,0,0.28)',
          padding: '7px 16px', borderRadius: 4,
          fontFamily: 'EB Garamond, Georgia, serif',
        }}>
          En desarrollo
        </span>
      </div>
      <Masthead />
      <div style={{
        display: 'grid',
        gridTemplateColumns: '3fr 2fr',
        flex: 1,
        minHeight: 0,
        marginTop: 4,
      }}>
        <FeaturedStory item={lead} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rest.map((item, i) => (
            <SecondaryStory key={item.id} item={item} withRule={i < rest.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

const NewsPanel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ShowcasePanel
      flip
      graphic={<NewsGraphic />}
      graphicCardStyle={{
        padding: 0,
        minHeight: 320,
        justifyContent: 'flex-start',
        borderRadius: 20,
        border: `1.5px solid rgba(0,0,0,0.18)`,
        overflow: 'hidden',
        boxShadow: '0 6px 28px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)',
      }}
      eyebrow="Comunidad · participación"
      title="Una plataforma para coincidir"
      body="Las últimas noticias sobre movilidad ciclista en España. Infraestructura, política, datos y experiencias de ciudades que ya están cambiando. Esta sección está en desarrollo."
      ctaLabel="Únete a la conversación →"
      onCta={() => navigate('/about')}
      ctaDisabled
    />
  );
};

export default NewsPanel;
