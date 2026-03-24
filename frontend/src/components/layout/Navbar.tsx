import React, { useState } from "react";
import { useLocation } from "react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "../ui/Link";
import ScrollableCityList from "../landing/ScrollableCityList";
import logoImage from '../../assets/logo.svg';
import type { CityData } from "../../constants/cities";
import { fetchCities } from "../../services/api";
import backgroundTexture from '../../assets/background2.svg';

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
    <nav 
      className="w-full z-20 relative bg-[var(--cream)]"
    >
    {/* Background texture extending upward to cover navbar */}
    <div 
        className="absolute pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundTexture})`,
          backgroundSize: '600px 600px',
          backgroundPosition: 'top left',
          backgroundRepeat: 'repeat',
          top: 0, // Extend upward to cover navbar
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.07
        }}
      />
      {/* Top row: logos */}
      <div className="flex justify-between items-center h-[50px] mx-[50px] relative z-10">
          <img src={logoImage} alt="Logo Left" className="h-full" />
          <img src={logoImage} alt="Logo Right" className="h-full" />
      </div>

      {/* Middle row: menu */}
      <div className="flex items-center justify-center gap-[200px] h-[75px] mx-[100px] relative z-10">
        <Link
          onClick={() => setShowCities(!showCities)}
          className="font-[800] flex items-center gap-[1px]"
        >
          Ciudades
          {showCities ? (
            <ChevronUp size={18} />
          ) : (
            <ChevronDown size={18} />
          )}
        </Link>
        {navLinks
          .filter(link => link.to !== location.pathname)
          .map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-[800]"
            >
              {link.name}
            </Link>
        ))}
      </div>
        
      {/* Bottom row: cities */}
      <div className="flex items-center justify-center gap-[200px] h-[50px] mx-[100px] -mt-[30px] relative z-10">
        <ScrollableCityList show={showCities}>
          {cities.map((city) => (
            <Link
              key={city.path}
              to={city.path}
              className="text-xs font-[300] whitespace-nowrap snap-start"
            >
              {city.name}
            </Link>
          ))}
        </ScrollableCityList>
      </div>
    </nav>


  );
};

export default Navbar;