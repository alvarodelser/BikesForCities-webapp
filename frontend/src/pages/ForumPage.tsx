import React, { useRef, useMemo } from 'react';
import { getNews } from '../services/newsService';
import NewsCard from '../components/forum/NewsCard';
import NewsSearch from '../components/forum/NewsSearch';
import NewsTimeline from '../components/forum/NewsTimeline';

const ForumPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const feedRef = useRef<HTMLDivElement>(null);

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
    const feedDiv = feedRef.current;
    if (!feedDiv) return;

    const cards = feedDiv.querySelectorAll('[data-news-id]');
    if (cards[index]) {
      const card = cards[index] as HTMLElement;
      const feedTop = feedDiv.getBoundingClientRect().top;
      const cardTop = card.getBoundingClientRect().top;
      const scrollOffset = cardTop - feedTop;
      feedDiv.scrollTop += scrollOffset - 20; // 20px padding
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-[var(--cream)]">
      {/* Left: Feed */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <NewsSearch value={searchQuery} onChange={setSearchQuery} />
        <div
          ref={feedRef}
          className="flex-1 overflow-y-scroll"
        >
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
      </div>

      {/* Right: Timeline */}
      <NewsTimeline
        items={filteredNews}
        scrollRef={feedRef}
        onDotClick={handleDotClick}
      />
    </div>
  );
};

export default ForumPage;
