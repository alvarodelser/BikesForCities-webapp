import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  children: React.ReactNode;
  label?: string;
  fadeColor?: string;
};

const ScrollableCardList: React.FC<Props> = ({ children, label }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const scroll = (dir: "left" | "right") => {
    const offset = dir === "left" ? -400 : 400;
    scrollRef.current?.scrollBy({ left: offset, behavior: "smooth" });
  };

  const updateScrollButtons = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    setCanScrollLeft(container.scrollLeft > 10);
    setCanScrollRight(
      container.scrollLeft + container.clientWidth < container.scrollWidth - 10
    );
  }, []);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollRef.current;
    if (!container) return;
    setIsDragging(true);
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const container = scrollRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 2; // scroll-fast factor
    container.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    updateScrollButtons();
    container.addEventListener("scroll", updateScrollButtons);
    window.addEventListener("resize", updateScrollButtons);

    return () => {
      container.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [children, updateScrollButtons]);

  return (
    <div className="w-full relative group/list">
      {label && (
        <h3 className="text-xl font-bold text-[var(--black)] mb-6 px-4">{label}</h3>
      )}
      
      <div className="relative flex items-center">
        {/* Left Arrow */}
        <button
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          className={`absolute left-0 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-lg transition-all
            ${canScrollLeft ? "opacity-100 translate-x-2 hover:bg-white/40" : "opacity-0 -translate-x-4 pointer-events-none"}
          `}
        >
          <ChevronLeft className="w-6 h-6 text-[var(--black)]" />
        </button>

        {/* Scrollable Content with Masking Fade */}
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`
            flex gap-6 overflow-x-auto no-scrollbar py-4 px-10 select-none
            ${isDragging ? "cursor-grabbing" : "cursor-grab"}
          `}
          style={{ 
            scrollBehavior: isDragging ? "auto" : "smooth",
            WebkitOverflowScrolling: "touch",
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 60px, black calc(100% - 60px), transparent)',
            maskImage: 'linear-gradient(to right, transparent, black 60px, black calc(100% - 60px), transparent)'
          }}
        >
          {children}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          className={`absolute right-0 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-lg transition-all
            ${canScrollRight ? "opacity-100 -translate-x-2 hover:bg-white/40" : "opacity-0 translate-x-4 pointer-events-none"}
          `}
        >
          <ChevronRight className="w-6 h-6 text-[var(--black)]" />
        </button>
      </div>
    </div>
  );
};

export default ScrollableCardList;
