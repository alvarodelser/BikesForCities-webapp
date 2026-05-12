import React from 'react';
import { NewsItem } from '../../types/news';

interface NewsCardProps {
  item: NewsItem;
}

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const dateStr = new Date(item.publication_dt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 border-b border-[var(--blue-light)] hover:border-l-4 hover:border-l-[var(--green-dark)] transition-colors duration-150"
    >
      <h3
        className="font-heading text-lg font-bold text-[var(--blue-dark)] leading-tight mb-1"
      >
        {item.headline}
      </h3>
      <p className="text-sm text-[var(--black)] opacity-60">
        {item.source} · {dateStr}
      </p>
    </a>
  );
};

export default NewsCard;
