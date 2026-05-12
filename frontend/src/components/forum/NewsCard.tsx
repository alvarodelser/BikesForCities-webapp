import React from 'react';
import type { NewsItem } from '../../types/news';

interface NewsCardProps {
  item: NewsItem;
}

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const dateStr = new Date(item.publication_dt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block py-6 border-b border-[var(--blue-light)]/30 hover:bg-[var(--blue-light)]/5 transition-colors duration-150 group"
    >
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <h3
            className="font-heading text-base font-bold text-[var(--blue-dark)] leading-snug mb-2 group-hover:text-[var(--green-dark)] transition-colors"
          >
            {item.headline}
          </h3>
          <p className="text-xs text-[var(--black)] opacity-50 uppercase tracking-wide">
            {item.source} — {dateStr}
          </p>
        </div>
      </div>
    </a>
  );
};

export default NewsCard;
