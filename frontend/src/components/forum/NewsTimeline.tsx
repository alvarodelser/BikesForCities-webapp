import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { NewsItem } from '../../types/news';

interface NewsTimelineProps {
  items: NewsItem[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onDotClick: (index: number) => void;
}

const NewsTimeline: React.FC<NewsTimelineProps> = ({
  items,
  scrollRef,
  onDotClick,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

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

  // Handle feed scroll → update thumb position
  const handleFeedScroll = useCallback(() => {
    if (!scrollRef.current || !timelineRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const scrollFraction = scrollHeight > clientHeight
      ? scrollTop / (scrollHeight - clientHeight)
      : 0;
    const trackHeight = timelineRef.current.clientHeight;
    setThumbTop(Math.max(0, scrollFraction * (trackHeight - 24))); // 24px thumb height
  }, [scrollRef]);

  // Handle thumb drag → update feed scroll
  const handleThumbPointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !timelineRef.current || !scrollRef.current) return;

    const trackRect = timelineRef.current.getBoundingClientRect();
    const trackHeight = trackRect.height;
    const dragY = e.clientY - trackRect.top;
    const fraction = Math.max(0, Math.min(1, dragY / trackHeight));

    const { scrollHeight, clientHeight } = scrollRef.current;
    scrollRef.current.scrollTop = fraction * (scrollHeight - clientHeight);
  }, [isDragging, scrollRef]);

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Handle dot click → jump feed to that article
  const handleDotClick = (index: number) => {
    onDotClick(index);
  };

  useEffect(() => {
    const feedDiv = scrollRef.current;
    if (feedDiv) {
      feedDiv.addEventListener('scroll', handleFeedScroll);
    }
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      if (feedDiv) feedDiv.removeEventListener('scroll', handleFeedScroll);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handleFeedScroll, handlePointerMove]);

  return (
    <div
      ref={timelineRef}
      className="sticky top-0 h-[calc(100vh-80px)] w-7 flex flex-col items-center bg-[var(--cream)] py-4"
    >
      <div className="relative flex-1 w-1 bg-[var(--blue-light)]">
        {/* Year labels */}
        {yearLabels.map((label) => (
          <div
            key={label.year}
            className="absolute left-3 text-xs text-[var(--black)] whitespace-nowrap"
            style={{ top: `${label.position}%` }}
          >
            {label.year}
          </div>
        ))}

        {/* Article dots */}
        {items.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => handleDotClick(idx)}
            className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--blue-dark)] hover:bg-[var(--green-dark)] transition-colors cursor-pointer"
            style={{ top: `${dotPositions[idx]}%` }}
            title={item.headline}
          />
        ))}

        {/* Draggable thumb */}
        <div
          ref={thumbRef}
          onPointerDown={handleThumbPointerDown}
          className="absolute left-1/2 -translate-x-1/2 w-5 h-6 rounded-full bg-[var(--green-dark)] cursor-grab active:cursor-grabbing transition-colors hover:bg-[var(--green)] shadow-sm"
          style={{ top: `${thumbTop}px` }}
        />
      </div>
    </div>
  );
};

export default NewsTimeline;
