import React, { useState } from "react";
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

  React.useEffect(() => {
    fetchCities().then(data => setCities(data)).catch(console.error);
  }, []);

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center w-full pointer-events-none px-4">
      <nav 
        className={`pointer-events-auto bg-[var(--cream)]/85 backdrop-blur-md shadow-lg transition-all duration-500 ease-in-out flex flex-col items-center overflow-hidden border border-black/5 rounded-[32px] w-full
          ${showCities ? 'max-w-[1400px]' : 'max-w-[800px]'}
        `}
      >
        {/* Main navigation row - Fixed width based on content */}
        <div className="flex items-center justify-between h-[60px] px-8 gap-8 md:gap-16 w-max shrink-0">
          {/* Left: Logo */}
          <Link to="/" className="h-[28px] flex items-center shrink-0">
            <img src={logoImage} alt="BikesForCities Logo" className="h-[28px] object-contain" />
          </Link>

          {/* Right: Navigation Links */}
          <div className="flex items-center gap-6 md:gap-10 shrink-0">
            <Link
              to="/"
              className={`text-sm font-[800] transition-colors ${location.pathname === '/' ? 'text-[var(--green)]' : ''}`}
            >
              Inicio
            </Link>

            <Link
              onClick={() => setShowCities(!showCities)}
              className={`text-sm font-[800] flex items-center gap-[2px] transition-colors ${showCities ? 'text-[var(--green)]' : ''}`}
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
                  className={`text-sm font-[800] transition-colors ${isActive ? 'text-[var(--green)]' : ''}`}
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
          <div className="flex items-center justify-center h-[60px] w-full px-8 max-w-[1400px]">
            <ScrollableCityList show={showCities}>
              {cities.map((city) => (
                <Link
                  key={city.path}
                  to={city.path}
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