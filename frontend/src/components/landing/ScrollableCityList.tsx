import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  show: boolean;
  children: React.ReactNode;
  fadeColor?: string;
};

const ScrollableCityList: React.FC<Props> = ({ show, children, fadeColor = "var(--cream)" }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
  
    const scroll = (dir: "left" | "right") => {
      const offset = dir === "left" ? -400 : 400;
      scrollRef.current?.scrollBy({ left: offset, behavior: "smooth" });
    };
    const updateScrollButtons = () => {
        const container = scrollRef.current;
        if (!container) return;
      
        setCanScrollLeft(container.scrollLeft > 0);
        setCanScrollRight(
          container.scrollLeft + container.clientWidth < container.scrollWidth - 1
        );
      };
      useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;
      
        // Initially scroll to show the first city item, not the left spacer
        container.scrollLeft = 400; // Width of the left spacer
      
        const timeout = setTimeout(updateScrollButtons, 0);
      
        container.addEventListener("scroll", updateScrollButtons);
        window.addEventListener("resize", updateScrollButtons);
      
        return () => {
          clearTimeout(timeout);
          container.removeEventListener("scroll", updateScrollButtons);
          window.removeEventListener("resize", updateScrollButtons);
        };
      }, [children]); 
  
    if (!show) return null;
  
    return (
      <div className="relative h-[50px] flex items-center overflow-hidden">
        {/* Fades */}
      <div 
        className="absolute left-[30px] top-0 h-full w-[40px] z-10 pointer-events-none transition-opacity duration-300" 
        style={{ 
          background: `linear-gradient(to right, ${fadeColor} 0%, color-mix(in srgb, ${fadeColor}, transparent 70%) 4px, transparent 8px)`,
          opacity: canScrollLeft ? 1 : 0 
        }}
      />
      <div 
        className="absolute right-[30px] top-0 h-full w-[40px] z-10 pointer-events-none transition-opacity duration-300"
        style={{ 
          background: `linear-gradient(to left, ${fadeColor} 0%, color-mix(in srgb, ${fadeColor}, transparent 70%) 4px, transparent 8px)`,
          opacity: canScrollRight ? 1 : 0
        }}
      />

        {/* Left Arrow */}
        <div className="h-full flex items-center z-10">
            <ChevronLeft
            onClick={() => canScrollLeft && scroll("left")}
            className={`w-5 h-5 cursor-pointer transition-colors ${
            canScrollLeft
                ? "hover:text-[var(--yellow)] text-black"
                : "opacity-10 pointer-events-none"
            }`}
            />
        </div>
  
        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          className="flex gap-[100px] mx-[10px] overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
          style={{ scrollBehavior: "smooth" }}
        >
          {/* Invisible spacer at the beginning */}
          <div className="w-[20px] flex-shrink-0"></div>
          {children}
          {/* Invisible spacer at the end */}
          <div className="w-[20px] flex-shrink-0"></div>
        </div>
  
        {/* Right Arrow */}
        <div className="h-full flex items-center z-10">
            <ChevronRight
            onClick={() => canScrollRight && scroll("right")}
            className={`w-5 h-5 cursor-pointer transition-colors ${
            canScrollRight
                ? "hover:text-[var(--yellow)] text-black"
                : "opacity-10 pointer-events-none"
            }`}
            />
        </div>
      </div>
    );
  };
  
  export default ScrollableCityList;