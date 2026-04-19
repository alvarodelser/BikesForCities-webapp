import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { ChevronDown, ChevronUp, Menu, X } from "lucide-react";
import Link from "../ui/Link";
import ScrollableCityList from "../landing/ScrollableCityList";
import B4CLogo from '../ui/B4CLogo';
import type { CityData } from "../../constants/cities";
import { fetchCities } from "../../services/api";
import { useViewport } from "../../hooks/useViewport";

type NavbarProps = {
  omit?: string;
};

const navLinks = [
  { name: "Inicio", to: "/" },
  { name: "Compara", to: "/compare" },
  { name: "Acerca de", to: "/about" },
];

const Navbar: React.FC<NavbarProps> = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentMode = searchParams.get('mode');
  const { isMobile } = useViewport();

  const [showCities, setShowCities] = useState(false);
  const [cities, setCities] = useState<CityData[]>([]);
  const [scrolled, setScrolled] = useState(false);

  // Mobile state
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [mobileCitiesOpen, setMobileCitiesOpen] = useState(false);

  const navRef = useRef<HTMLElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchCities().then(data => setCities(data)).catch(console.error);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // set initial state
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Close menus on route change
  useEffect(() => {
    setShowCities(false);
    setBurgerOpen(false);
    setMobileCitiesOpen(false);
  }, [location.pathname]);

  // Outside click handler — closes both desktop dropdown and mobile menus
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setShowCities(false);
        setBurgerOpen(false);
        setMobileCitiesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCities(false);
        setBurgerOpen(false);
        setMobileCitiesOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (showCities) {
      timerRef.current = setTimeout(() => {
        setShowCities(false);
      }, 2000);
    }
  };

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="absolute left-0 right-0 z-[2000] flex justify-center w-full pointer-events-none top-6 px-4">
        <nav
          ref={navRef}
          className="pointer-events-auto backdrop-blur-md shadow-lg transition-all duration-500 ease-in-out flex flex-col items-center overflow-hidden border w-full bg-[var(--cream)]/85 border-black/5 rounded-[32px] max-w-[800px]"
        >
          {/* Pill header row: logo + burger */}
          <div className="flex items-center justify-between px-6 h-[60px] w-full">
            {/* Left: Logo */}
            <Link
              to="/"
              onClick={() => { setBurgerOpen(false); setMobileCitiesOpen(false); }}
              className="flex items-center shrink-0 group"
            >
              <B4CLogo
                className="object-contain transition-all duration-500 text-[var(--green-dark)] group-hover:text-[var(--green)] h-[28px]"
              />
            </Link>

            {/* Right: Burger button */}
            <button
              aria-label={burgerOpen ? "Cerrar menú" : "Abrir menú"}
              onClick={() => {
                setBurgerOpen(prev => {
                  if (prev) setMobileCitiesOpen(false);
                  return !prev;
                });
              }}
              className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-black/5 transition-colors cursor-pointer text-[var(--green-dark)]"
            >
              {burgerOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* Expanded menu panel */}
          <div
            className={`w-full transition-all duration-500 ease-in-out overflow-hidden
              ${burgerOpen ? 'max-h-[calc(100vh-80px)] opacity-100 border-t border-black/5' : 'max-h-0 opacity-0'}
            `}
          >
            <div className="flex flex-col px-4 pb-4 pt-2 gap-1">
              {(() => {
                const renderMobileLink = (link: { name: string; to: string }) => {
                  const isActive = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => { setBurgerOpen(false); setMobileCitiesOpen(false); }}
                      className={`flex items-center font-[800] text-base min-h-[44px] px-3 rounded-2xl hover:bg-black/5 transition-colors
                        text-[var(--green-dark)]
                      `}
                    >
                      {link.name}
                    </Link>
                  );
                };

                return (
                  <>
                    {/* Inicio (first navLink) */}
                    {navLinks.slice(0, 1).map(renderMobileLink)}

                    {/* Ciudades ▾ */}
                    <button
                      onClick={() => setMobileCitiesOpen(prev => !prev)}
                      className={`flex items-center gap-1 font-[800] text-base min-h-[44px] px-3 rounded-2xl hover:bg-black/5 transition-colors cursor-pointer w-full text-left
                        text-[var(--green-dark)]
                      `}
                    >
                      Ciudades
                      {mobileCitiesOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {/* Cities sublist */}
                    <div
                      className={`transition-all duration-500 ease-in-out overflow-hidden
                        ${mobileCitiesOpen ? 'max-h-[240px] opacity-100' : 'max-h-0 opacity-0'}
                      `}
                    >
                      <div className="overflow-y-auto max-h-[240px] flex flex-col pl-4 gap-0.5 py-1">
                        {cities.map((city) => (
                          <Link
                            key={city.path}
                            to={currentMode ? `${city.path}?mode=${currentMode}` : city.path}
                            onClick={() => { setBurgerOpen(false); setMobileCitiesOpen(false); }}
                            className="flex items-center font-[500] text-sm min-h-[36px] px-3 rounded-xl hover:bg-black/5 transition-colors text-[var(--green-dark)]"
                          >
                            {city.name}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Compara, Acerca de, … (remaining navLinks) */}
                    {navLinks.slice(1).map(renderMobileLink)}
                  </>
                );
              })()}
            </div>
          </div>
        </nav>
      </div>
    );
  }

  // ── Desktop layout (unchanged) ─────────────────────────────────────────────
  return (
    <div
      className={`fixed left-0 right-0 z-[2000] flex justify-center w-full pointer-events-none transition-all duration-500 ease-in-out
        ${scrolled ? 'top-6 px-4' : 'top-0 px-0'}
      `}
    >
      <nav
        ref={navRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`pointer-events-auto backdrop-blur-md shadow-lg transition-all duration-500 ease-in-out flex flex-col items-center overflow-hidden border w-full
          ${scrolled
            ? 'bg-[var(--cream)]/85 border-black/5 rounded-[32px] max-w-[800px]'
            : 'bg-[var(--cream)]/95 border-black/5 rounded-none max-w-full'
          }
        `}
      >
        {/* Main navigation row */}
        <div
          className={`flex items-center justify-between px-8 gap-8 md:gap-16 w-full transition-all duration-500
              ${scrolled ? 'h-[60px] max-w-[800px]' : 'h-[72px] max-w-full'}
            `}
        >
          {/* Left: Logo */}
          <Link to="/" onClick={() => setShowCities(false)} className="flex items-center shrink-0 group">
            <B4CLogo
              className={`object-contain transition-all duration-500 text-[var(--green-dark)] group-hover:text-[var(--green)] ${scrolled ? 'h-[28px]' : 'h-[34px]'}`}
            />
          </Link>

          {/* Right: Navigation Links */}
          <div className="flex items-center gap-6 md:gap-10 shrink-0">
            <Link
              to="/"
              onClick={() => setShowCities(false)}
              className={`font-[800] transition-all duration-500 ${scrolled ? 'text-sm' : 'text-base'} text-[var(--green-dark)]`}
            >
              Inicio
            </Link>

            <Link
              onClick={() => setShowCities(!showCities)}
              className={`font-[800] flex items-center gap-[2px] transition-all duration-500 ${scrolled ? 'text-sm' : 'text-base'} text-[var(--green-dark)]`}
            >
              Ciudades
              {showCities ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </Link>

            {navLinks.filter(l => l.name !== "Inicio").map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setShowCities(false)}
                   className={`font-[800] transition-all duration-500 ${scrolled ? 'text-sm' : 'text-base'} text-[var(--green-dark)]`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Dropdown row: cities */}
        <div
          className={`w-full transition-all duration-500 ease-in-out relative z-0 flex justify-center
            ${showCities ? 'max-h-[80px] opacity-100 border-t border-black/5' : 'max-h-0 opacity-0'}
          `}
        >
          <div className="flex items-center justify-center h-[60px] w-full px-8 max-w-[800px]">
            <ScrollableCityList show={showCities}>
              {cities.map((city) => (
                <Link
                  key={city.path}
                  to={currentMode ? `${city.path}?mode=${currentMode}` : city.path}
                  onClick={() => setShowCities(false)}
                  className="text-xs font-[500] whitespace-nowrap snap-start px-3 py-1.5 rounded-full hover:bg-black/5 transition-colors text-[var(--green-dark)]"
                >
                  {city.name}
                </Link>
              ))}
            </ScrollableCityList>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
