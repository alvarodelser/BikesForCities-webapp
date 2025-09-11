import React from 'react';
import { Link } from 'react-router';
import { Github, Linkedin, Instagram, Bookmark, Heart } from 'lucide-react';
import IconContainer from '../ui/IconContainer';

const Footer: React.FC = () => {
  const socialLinks = [
    { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
    { icon: Bookmark, href: 'https://substack.com', label: 'Substack' },
    { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
    { icon: Github, href: 'https://github.com', label: 'GitHub' },
  ];

  const navigationLinks = [
    { to: '/about', label: 'Sobre Nosotros' },
    { to: '/compare', label: 'Comparar Ciudades' },
    { to: '/map', label: 'Explorar Mapas' }
  ];

  return (
    <footer className="w-full bg-[var(--blue-dark)] py-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Main footer content */}
        <div 
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-8 relative overflow-hidden group"
          style={{
            boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.1), inset -1px -1px 4px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.1)'
          }}
        >
          {/* Glass reflection effect */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl pointer-events-none" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {/* Branding Section */}
            <div className="space-y-4">
              <h3 className="text-2xl font-heading font-bold text-white drop-shadow-lg">
                Bikes for Cities
              </h3>
              <p className="text-white/80 text-sm leading-relaxed drop-shadow-sm">
                Somos un proyecto de participación ciudadana que busca transformar la movilidad urbana a través de los datos. 
                Construyamos ciudades más verdes y saludables.
              </p>
            </div>

            {/* Navigation Links */}
            <div className="space-y-4 text-center">
              <h4 className="text-lg font-heading font-semibold text-white drop-shadow-lg">
                Navegación
              </h4>
              <ul className="space-y-2">
                {navigationLinks.map((link, index) => (
                  <li key={index}>
                    <Link 
                      to={link.to}
                      className="text-white/80 hover:text-white transition-colors duration-300 drop-shadow-sm hover:drop-shadow-lg text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social Media Links */}
            <div className="space-y-4">
              <h4 className="text-lg font-heading font-semibold text-white drop-shadow-lg">
                Síguenos
              </h4>
              <div className="flex gap-3">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                  >
                    <IconContainer
                      icon={social.icon}
                      variant="glass"
                      size="md"
                      tint="rgba(0, 56, 73, 0.95)"
                      hoverTint="rgba(2, 122, 118, 0.8)"
                      iconColor="white"
                      hoverIconColor="#ffffff"
                      onClick={() => window.open(social.href, '_blank')}
                      aria-label={social.label}
                      className="transition-all duration-300"
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom glass highlight */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>

        {/* Copyright Section */}
        <div className="mt-8 text-center">
          <div 
            className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm px-6 py-3 rounded-full border border-white/10"
            style={{
              boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1), inset -1px -1px 2px rgba(255,255,255,0.05)'
            }}
          >
            <span className="text-white/70 text-sm drop-shadow-sm">
              © 2025 Bikes for Cities. Hecho con
            </span>
            <Heart className="w-4 h-4 text-[var(--yellow)] drop-shadow-sm" />
            <span className="text-white/70 text-sm drop-shadow-sm">
              para un futuro más sostenible
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;