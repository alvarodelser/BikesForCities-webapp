import React, { useRef, useMemo } from 'react';
import { getNews } from '../services/newsService';
import NewsCard from '../components/forum/NewsCard';
import NewsSearch from '../components/forum/NewsSearch';
import NewsTimeline from '../components/forum/NewsTimeline';

const ForumPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const pageRef = useRef<HTMLDivElement>(null);

  const allNews = useMemo(() => getNews(), []);

  const filteredNews = useMemo(() => {
    if (!searchQuery.trim()) return allNews;

    const query = searchQuery.toLowerCase();
    return allNews.filter(item =>
      item.headline.toLowerCase().includes(query) ||
      (item.summary && item.summary.toLowerCase().includes(query))
    );
  }, [searchQuery, allNews]);

  const handleDotClick = (index: number) => {
    if (!pageRef.current) return;

    const cards = pageRef.current.querySelectorAll('[data-news-id]');
    if (cards[index]) {
      const card = cards[index] as HTMLElement;
      const cardTop = card.getBoundingClientRect().top;
      const pageTop = pageRef.current.getBoundingClientRect().top;
      window.scrollBy({
        top: cardTop - pageTop - 120, // Account for navbar + search bar
        behavior: 'smooth'
      });
    }
  };

  return (
    <div ref={pageRef} className="scrollbar-hide">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-[var(--cream)]">
        <NewsSearch value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Feed content */}
      <div className="pr-8 max-w-4xl mx-auto">
        {filteredNews.length > 0 ? (
          filteredNews.map((item) => (
            <div key={item.id} data-news-id={item.id}>
              <NewsCard item={item} />
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-[var(--black)] opacity-50">
            No hay noticias que coincidan con tu búsqueda.
          </div>
        )}
      </div>

      {/* Right: Fixed Timeline */}
      <NewsTimeline
        items={filteredNews}
        onDotClick={handleDotClick}
      />
    </div>
  );
};

export default ForumPage;
