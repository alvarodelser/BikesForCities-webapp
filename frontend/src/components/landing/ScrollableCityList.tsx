import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  show: boolean;
  children: React.ReactNode;
  fadeColor?: string;
};

const ScrollableCityList: React.FC<Props> = ({ show, children }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    const container = scrollRef.current;
    if (!container) return;
    
    // Use a small threshold for smoother button appearance
    setCanScrollLeft(container.scrollLeft > 10);
    setCanScrollRight(
      container.scrollLeft + container.clientWidth < container.scrollWidth - 10
    );
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    
    // Small delay to ensure layout is complete
    const timeout = setTimeout(updateScrollButtons, 100);
    
    container.addEventListener("scroll", updateScrollButtons);
    window.addEventListener("resize", updateScrollButtons);
    
    return () => {
      clearTimeout(timeout);
      container.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [children, show]);

  const scroll = (dir: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ 
      left: dir === "left" ? -scrollAmount : scrollAmount, 
      behavior: "smooth" 
    });
  };

  if (!show) return null;

  return (
    <div className="relative w-full flex items-center group overflow-hidden h-full">
      {/* Left Arrow Overlay */}
      <div 
        className={`absolute left-0 z-20 flex items-center justify-center w-10 h-full transition-all duration-300 ${
          canScrollLeft ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
        }`}
      >
        <button
          onClick={() => scroll("left")}
          className="p-1 text-black/40 hover:text-black transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Scrollable Content with Masking Fade */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-6 overflow-x-auto scrollbar-none scroll-smooth px-10"
        style={{ 
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 60px, black calc(100% - 60px), transparent)',
          maskImage: 'linear-gradient(to right, transparent, black 60px, black calc(100% - 60px), transparent)'
        }}
      >
        {children}
      </div>

      {/* Right Arrow Overlay */}
      <div 
        className={`absolute right-0 z-20 flex items-center justify-center w-10 h-full transition-all duration-300 ${
          canScrollRight ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
        }`}
      >
        <button
          onClick={() => scroll("right")}
          className="p-1 text-black/40 hover:text-black transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default ScrollableCityList;