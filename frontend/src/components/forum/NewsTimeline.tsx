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
  const dragOffsetRef = useRef(0); // Offset from cursor to thumb center
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(32);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compute proportional positions — newest at top (0%), oldest at bottom (100%)
  // items[0] is newest (feed is reversed: newest first)
  const dates = items.map(i => new Date(i.publication_dt).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 1;

  const dotPositions = items.map(item => {
    const itemDate = new Date(item.publication_dt).getTime();
    // Invert: newest → 0% (top), oldest → 100% (bottom)
    return ((maxDate - itemDate) / dateRange) * 100;
  });

  // Year labels: one per year, positioned where that year first appears on the track
  const yearLabels: { year: number; position: number }[] = [];
  const seenYears = new Set<number>();
  items.forEach((item, idx) => {
    const year = new Date(item.publication_dt).getFullYear();
    if (!seenYears.has(year)) {
      seenYears.add(year);
      yearLabels.push({ year, position: dotPositions[idx] });
    }
  });

  // Compute thumb height based on viewport vs document ratio
  const computeThumbHeight = useCallback(() => {
    if (!timelineRef.current) return 32;
    const trackHeight = timelineRef.current.clientHeight;
    const docHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    return Math.max(32, (viewportHeight / docHeight) * trackHeight);
  }, []);

  // Handle page scroll → update thumb position
  const handlePageScroll = useCallback(() => {
    if (!timelineRef.current) return;
    const trackHeight = timelineRef.current.clientHeight;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (docHeight === 0) return;

    const newThumbHeight = computeThumbHeight();
    setThumbHeight(newThumbHeight);

    const scrollFraction = window.scrollY / docHeight;
    const newThumbTop = scrollFraction * (trackHeight - newThumbHeight);

    setThumbTop(Math.max(0, newThumbTop));
  }, [computeThumbHeight]);

  // Handle window resize → recompute thumb height and position
  const handleResize = useCallback(() => {
    const newThumbHeight = computeThumbHeight();
    setThumbHeight(newThumbHeight);
    handlePageScroll();
  }, [computeThumbHeight, handlePageScroll]);

  // Handle thumb drag → update feed scroll
  const handleThumbPointerDown = (e: React.PointerEvent) => {
    if (!timelineRef.current) return;
    isDraggingRef.current = true;

    // Calculate offset from cursor to thumb center
    const trackRect = timelineRef.current.getBoundingClientRect();
    const thumbCenter = thumbTop + thumbHeight / 2;
    dragOffsetRef.current = (e.clientY - trackRect.top) - thumbCenter;

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || !timelineRef.current) return;

    const trackRect = timelineRef.current.getBoundingClientRect();
    const trackHeight = trackRect.height;

    // Position thumb so cursor stays on same point relative to thumb
    const thumbCenter = e.clientY - trackRect.top - dragOffsetRef.current;
    const dragY = thumbCenter - thumbHeight / 2;
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
    // Initialize thumb height on mount
    const initialThumbHeight = computeThumbHeight();
    setThumbHeight(initialThumbHeight);

    window.addEventListener('scroll', handlePageScroll);
    window.addEventListener('resize', handleResize);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('scroll', handlePageScroll);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePageScroll, handlePointerMove, handleResize, computeThumbHeight]);

  return (
    <div
      ref={timelineRef}
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        height: '100vh',
        width: '40px',
        zIndex: 10,
        background: 'none',
        paddingTop: '80px',
        paddingBottom: '80px',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        {/* Vertical track line with gradient fade at top and bottom */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '1px',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(59,32,18,0.25) 8%, rgba(59,32,18,0.25) 92%, transparent 100%)',
          }}
        />

        {/* Year labels to the left of the dot */}
        {yearLabels.map((label) => (
          <div
            key={label.year}
            style={{
              position: 'absolute',
              top: `${label.position}%`,
              left: 0,
              transform: 'translateY(-50%)',
              fontSize: '0.46rem',
              fontWeight: 'bold',
              color: 'rgba(59,32,18,0.38)',
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            {label.year}
          </div>
        ))}

        {/* Article dots */}
        {items.map((item, idx) => {
          const isActive = hoveredIdx === idx;
          return (
            <button
              key={item.id}
              onClick={() => handleDotClick(idx)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              title={item.headline}
              style={{
                position: 'absolute',
                top: `${dotPositions[idx]}%`,
                left: '50%',
                transform: `translateX(-50%) translateY(-50%) scale(${isActive ? 1.4 : 1})`,
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: isActive ? '#027A76' : 'rgba(59,32,18,0.28)',
                boxShadow: isActive ? '0 0 5px rgba(2,122,118,0.5)' : 'none',
                transition: 'background 150ms, box-shadow 150ms, transform 150ms',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
            />
          );
        })}

        {/* Draggable proportional thumb */}
        <div
          onPointerDown={handleThumbPointerDown}
          style={{
            position: 'absolute',
            top: `${thumbTop}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '10px',
            height: `${thumbHeight}px`,
            borderRadius: '5px',
            background: 'rgba(2,122,118,0.75)',
            boxShadow: '0 1px 4px rgba(2,122,118,0.3)',
            cursor: 'grab',
            pointerEvents: 'auto',
          }}
        />
      </div>
    </div>
  );
};

export default NewsTimeline;
