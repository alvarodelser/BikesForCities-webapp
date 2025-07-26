import React from 'react';
import { NavLink } from 'react-router-dom';

const Navbar: React.FC = () => {
    const navLinks = [
        { name: "Home", to: "/" },
        { name: "Compare", to: "/compare" },
        { name: "Map", to: "/map/madrid" },
        { name: "About", to: "/about" },
      ];

    return (
    <nav className="w-full px-6 py-4 bg-blue shadow-md flex justify-between items-center text-lg sticky top-0 z-50">
      {/* Left: Logo */}
      <div className="text-white font-bold text-2xl tracking-wide">
        BikesForCities
      </div>

      {/* Right: Navigation Links */}
      <div className="flex gap-6">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={`hover:text-orange-400 transition ${
              location.pathname === link.to ? "text-white font-semibold" : "text-gray-200"
            }`}
          >
            {link.name}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
  

export default Navbar;