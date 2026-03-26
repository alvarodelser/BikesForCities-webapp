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
    <nav className="fixed top-0 left-0 right-0 w-full z-50 bg-[var(--cream)]/85 backdrop-blur-md shadow-sm border-b border-black/5 transition-all duration-300">
      {/* Main navigation row */}
      <div className="flex items-center justify-between h-[70px] px-8 md:px-16 max-w-[1400px] mx-auto relative z-10">
        {/* Left: Logo */}
        <Link to="/" className="h-[40px] flex items-center shrink-0">
          <img src={logoImage} alt="BikesForCities Logo" className="h-full object-contain" />
        </Link>

        {/* Right: Navigation Links */}
        <div className="flex items-center gap-6 md:gap-10">
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
        className={`w-full transition-all duration-300 ease-in-out relative z-0 ${showCities ? 'max-h-[80px] opacity-100 border-t border-black/5' : 'max-h-0 opacity-0'
          } overflow-hidden bg-[var(--cream)]/95`}
      >
        <div className="flex items-center justify-center h-[50px] px-8 md:px-16 max-w-[1400px] mx-auto">
          <ScrollableCityList show={showCities}>
            {cities.map((city) => (
              <Link
                key={city.path}
                to={city.path}
                className="text-xs font-[500] whitespace-nowrap snap-start px-3 py-1.5 rounded hover:bg-black/5 transition-colors"
              >
                {city.name}
              </Link>
            ))}
          </ScrollableCityList>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;