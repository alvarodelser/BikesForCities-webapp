// src/components/landing/showcase/NewsPanel.tsx
import React from 'react';
import { useNavigate } from 'react-router';
import ShowcasePanel from './ShowcasePanel';

interface NewsItem {
  id: number;
  headline: string;
  source: string;
  date: string;
  url: string;
  featured: boolean;
}

const STATIC_NEWS: NewsItem[] = [
  {
    id: 1,
    headline: 'Barcelona amplía su red de carriles bici en 40 km durante 2025',
    source: 'El País',
    date: 'hace 2 días',
    url: '#',
    featured: true,
  },
  {
    id: 2,
    headline: 'El uso de la bici sube un 18% en ciudades medianas',
    source: 'Movilidad Sostenible',
    date: 'hace 5 días',
    url: '#',
    featured: false,
  },
  {
    id: 3,
    headline: 'Sevilla, referente europeo en infraestructura ciclista',
    source: 'La Vanguardia',
    date: 'hace 1 semana',
    url: '#',
    featured: false,
  },
];

// NOTE: Replace STATIC_NEWS with an API/CMS fetch in a future iteration.

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        borderRadius: 10,
        background: 'rgba(0,56,73,0.04)',
        border: '1px solid rgba(0,56,73,0.08)',
        padding: '8px 9px',
        overflow: 'hidden',
        position: 'relative',
        textDecoration: 'none',
        transition: 'background 0.2s',
        gridColumn: item.featured ? '1 / -1' : undefined,
        minHeight: item.featured ? 72 : 56,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,56,73,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,56,73,0.04)')}
    >
      {item.featured && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '45%',
            background: 'linear-gradient(135deg, rgba(58,108,127,0.18), rgba(2,122,118,0.12))',
            borderRadius: '8px 8px 0 0',
          }}
        />
      )}
      <p
        style={{
          fontSize: '0.52rem',
          fontWeight: 700,
          lineHeight: 1.35,
          color: 'var(--blue-dark)',
          position: 'relative',
          zIndex: 1,
          margin: 0,
        }}
      >
        {item.headline}
      </p>
      <p
        style={{
          fontSize: '0.42rem',
          color: 'var(--blue)',
          opacity: 0.5,
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          position: 'relative',
          zIndex: 1,
          margin: 0,
        }}
      >
        {item.source} · {item.date}
      </p>
    </a>
  );
}

function NewsGraphic() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 7,
        width: '100%',
        height: 150,
      }}
    >
      {STATIC_NEWS.map(item => (
        <NewsCard key={item.id} item={item} />
      ))}
    </div>
  );
}

const NewsPanel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ShowcasePanel
      flip
      graphic={<NewsGraphic />}
      eyebrow="Actualidad · prensa"
      title="La actualidad ciclista, de un vistazo"
      body="Un panel tipo periódico con las últimas noticias sobre movilidad sostenible en España. Artículos reales, organizados por relevancia, clicables."
      ctaLabel="Leer más →"
      onCta={() => navigate('/about')}
    />
  );
};

export default NewsPanel;
