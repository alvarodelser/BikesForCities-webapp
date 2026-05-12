import React, { useState } from 'react';
import type { NewsItem } from '../../types/news';

interface NewsCardProps {
  item: NewsItem;
}

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const [hovered, setHovered] = useState(false);

  const dateStr = new Date(item.publication_dt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const baseBoxShadow = '0 2px 16px rgba(139, 99, 64, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.7)';
  const hoveredBoxShadow = '0 6px 24px rgba(139, 99, 64, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.7)';

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'block',
        padding: '24px',
        background: 'rgba(255, 248, 235, 0.52)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.65)',
        borderRadius: '12px',
        boxShadow: hovered ? hoveredBoxShadow : baseBoxShadow,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 150ms, box-shadow 150ms',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
          borderRadius: '12px 12px 0 0',
        }}
      />
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <h3
            style={{
              color: '#3B2012',
              marginBottom: '8px',
            }}
            className="font-heading text-base font-bold leading-snug"
          >
            {item.headline}
          </h3>
          <p style={{
            color: 'rgba(59, 32, 18, 0.5)',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {item.source} — {dateStr}
          </p>
        </div>
      </div>
    </a>
  );
};

export default NewsCard;
