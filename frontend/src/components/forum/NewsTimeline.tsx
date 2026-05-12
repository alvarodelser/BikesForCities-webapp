import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { NewsItem } from '../../types/news';

interface NewsTimelineProps {
  items: NewsItem[];
  onDotClick: (index: number) => void;
}

const NewsTimeline: React.FC<NewsTimelineProps> = ({
  items,
  onDotClick,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(64);

  // Compute proportional positions for dots and year labels
  const dates = items.map(i => new Date(i.publication_dt).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 1;

  const dotPositions = items.map(item => {
    const itemDate = new Date(item.publication_dt).getTime();
    return ((itemDate - minDate) / dateRange) * 100;
  });

  // Year labels: map unique years to their first position
  const yearLabels: { year: number; position: number }[] = [];
  const seenYears = new Set<number>();
  items.forEach((item, idx) => {
    const year = new Date(item.publication_dt).getFullYear();
    if (!seenYears.has(year)) {
      seenYears.add(year);
      yearLabels.push({ year, position: dotPositions[idx] });
    }
  });

  // Handle page scroll → update thumb position
  const handlePageScroll = useCallback(() => {
    if (!timelineRef.current) return;
    const trackHeight = timelineRef.current.clientHeight;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (docHeight === 0) return;

    const scrollFraction = window.scrollY / docHeight;
    const newThumbTop = scrollFraction * (trackHeight - thumbHeight);

    setThumbTop(Math.max(0, newThumbTop));
  }, [thumbHeight]);

  // Handle thumb drag → update feed scroll
  const handleThumbPointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || !timelineRef.current) return;

    const trackRect = timelineRef.current.getBoundingClientRect();
    const trackHeight = trackRect.height;
    const dragY = e.clientY - trackRect.top;
    const constrainedY = Math.max(0, Math.min(dragY, trackHeight - thumbHeight));
    const fraction = trackHeight > thumbHeight ? constrainedY / (trackHeight - thumbHeight) : 0;

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: fraction * docHeight, behavior: 'auto' });
  }, [thumbHeight]);

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Handle dot click → jump feed to that article
  const handleDotClick = (index: number) => {
    onDotClick(index);
  };

  useEffect(() => {
    window.addEventListener('scroll', handlePageScroll);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('scroll', handlePageScroll);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePageScroll, handlePointerMove]);

  return (
    <div
      ref={timelineRef}
      className="fixed right-0 top-0 h-screen w-20 flex flex-col items-center bg-[var(--cream)] py-20 pointer-events-none z-40 select-none"
      style={{ paddingTop: '80px' }}
    >
      <div className="relative flex-1 w-full flex items-center justify-center">
        {/* Vertical track line */}
        <div className="absolute h-full w-0.5 bg-[var(--blue-light)] left-1/2 -translate-x-1/2" />

        {/* Year labels on the left */}
        {yearLabels.map((label) => (
          <div
            key={label.year}
            className="absolute left-0 text-xs text-[var(--black)] font-bold pl-1"
            style={{ top: `${label.position}%`, transform: 'translateY(-50%)' }}
          >
            {label.year}
          </div>
        ))}

        {/* Article dots */}
        {items.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => handleDotClick(idx)}
            className="absolute w-2.5 h-2.5 rounded-full bg-[var(--blue-dark)] hover:bg-[var(--green-dark)] transition-colors cursor-pointer pointer-events-auto left-1/2 -translate-x-1/2 hover:scale-150"
            style={{ top: `${dotPositions[idx]}%` }}
            title={item.headline}
          />
        ))}

        {/* Draggable thumb */}
        <div
          onPointerDown={handleThumbPointerDown}
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[var(--green-dark)] cursor-grab active:cursor-grabbing transition-colors hover:bg-[var(--green)] shadow-lg pointer-events-auto"
          style={{ top: `${thumbTop}px`, height: `${thumbHeight}px`, width: '18px' }}
        />
      </div>
    </div>
  );
};

export default NewsTimeline;
