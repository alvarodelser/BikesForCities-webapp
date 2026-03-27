import React, { useState, useEffect } from "react";
import { useLocation } from "react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "../ui/Link";
import ScrollableCityList from "../landing/ScrollableCityList";
import logoImage from '../../assets/logo.svg';
import type { CityData } from "../../constants/cities";
import { fetchCities } from "../../services/api";

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
  const [showCities, setShowCities] = useState(false);
  const [cities, setCities] = useState<CityData[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [openedAtTop, setOpenedAtTop] = useState(false);

  React.useEffect(() => {
    fetchCities().then(data => setCities(data)).catch(console.error);
  }, []);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div
      className={`fixed left-0 right-0 z-50 flex justify-center w-full pointer-events-none transition-all duration-500 ease-in-out
        ${scrolled && (!showCities || !openedAtTop) ? 'top-6 px-4' : 'top-0 px-0'}
      `}
    >
      <nav
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`pointer-events-auto backdrop-blur-md shadow-lg transition-all duration-500 ease-in-out flex flex-col items-center overflow-hidden border w-full
          ${scrolled && (!showCities || !openedAtTop)
            ? 'bg-[var(--cream)]/85 border-black/5 rounded-[32px] max-w-[800px]'
            : 'bg-[var(--cream)]/95 border-black/5 rounded-none max-w-full'
          }
          ${showCities && openedAtTop ? '!max-w-full !rounded-none !top-0' : ''}
        `}
      >
        {/* Main navigation row */}
          <div
            className={`flex items-center justify-between px-8 gap-8 md:gap-16 w-full transition-all duration-500
              ${scrolled && (!showCities || !openedAtTop)
                ? 'h-[60px] max-w-[800px]'
                : 'h-[72px] max-w-full'
              }
              ${showCities && openedAtTop ? '!max-w-full' : ''}
            `}
          >
          {/* Left: Logo */}
          <Link to="/" onClick={() => setShowCities(false)} className="flex items-center shrink-0">
            <img
              src={logoImage}
              alt="BikesForCities Logo"
              className={`object-contain transition-all duration-500 ${scrolled ? 'h-[28px]' : 'h-[34px]'}`}
            />
          </Link>

          {/* Right: Navigation Links */}
          <div className="flex items-center gap-6 md:gap-10 shrink-0">
            <Link
              to="/"
              onClick={() => setShowCities(false)}
              className={`font-[800] transition-all duration-500 ${scrolled ? 'text-sm' : 'text-base'} ${location.pathname === '/' ? 'text-[var(--green)]' : ''}`}
            >
              Inicio
            </Link>

            <Link
              onClick={() => {
                if (!showCities) setOpenedAtTop(!scrolled);
                setShowCities(!showCities);
              }}
              className={`font-[800] flex items-center gap-[2px] transition-all duration-500 ${scrolled ? 'text-sm' : 'text-base'} ${showCities ? 'text-[var(--green)]' : ''}`}
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
                  className={`font-[800] transition-all duration-500 ${scrolled ? 'text-sm' : 'text-base'} ${isActive ? 'text-[var(--green)]' : ''}`}
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
                  to={city.path}
                  onClick={() => setShowCities(false)}
                  className="text-xs font-[500] whitespace-nowrap snap-start px-3 py-1.5 rounded-full hover:bg-black/5 transition-colors"
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