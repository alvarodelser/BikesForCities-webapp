import React from 'react';
import { Link } from 'react-router';
import { Github, Linkedin, Instagram, Bookmark, Heart } from 'lucide-react';
import IconContainer from '../ui/IconContainer';

type Particle = {
  id: number;
  angle: number;
  distance: number;
  size: number;
};

const Footer: React.FC = () => {
  const [isHeartFilled, setIsHeartFilled] = React.useState(false);
  const [particles, setParticles] = React.useState<Particle[]>([]);

  const socialLinks = [
    { icon: Instagram, href: 'https://www.instagram.com/bikesforcities', label: 'Instagram' },
    { icon: Bookmark, href: 'https://substack.com/@bikesforcities', label: 'Substack' },
    { icon: Linkedin, href: 'https://www.linkedin.com/company/105136520/', label: 'LinkedIn' },
    { icon: Github, href: 'https://github.com/alvarodelser/BikesForCities-webapp', label: 'GitHub' },
  ];

  const navigationLinks = [
    { to: '/about', label: 'Sobre Nosotros' },
    { to: '/compare', label: 'Comparar Ciudades' },
    { to: '/map', label: 'Explorar Mapas' }
  ];

  const handleHeartClick = () => {
    if (isHeartFilled) return;
    setIsHeartFilled(true);
    
    const newParticles: Particle[] = Array.from({ length: 12 }).map((_, i) => ({
      id: Math.random(),
      angle: (i * 30 * Math.PI) / 180,
      distance: Math.random() * 40 + 20,
      size: Math.random() * 4 + 2,
    }));
    setParticles(newParticles);
    
    // Clear particles after animation
    setTimeout(() => setParticles([]), 1000);
  };

  return (
    <footer className="w-full bg-[var(--blue-dark)] py-[var(--space-section-y)] px-[var(--space-gutter)]">
      <style>{`
        @keyframes particle-out {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + cos(var(--angle)) * var(--dist)), calc(-50% + sin(var(--angle)) * var(--dist))) scale(0); opacity: 0; }
        }
        .animate-particle {
          animation: particle-out 0.8s ease-out forwards;
        }
      `}</style>
      <div className="mx-auto w-full max-w-[var(--container-max)]">
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
            className="inline-flex flex-wrap items-center gap-2 bg-white/5 backdrop-blur-sm px-6 py-3 rounded-full border border-white/10"
            style={{
              boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1), inset -1px -1px 2px rgba(255,255,255,0.05)'
            }}
          >
            <span className="text-white/70 text-sm drop-shadow-sm">
              © 2025 Bikes for Cities. Hecho con
            </span>
            <div className="relative inline-flex items-center justify-center">
              <button 
                onClick={handleHeartClick}
                disabled={isHeartFilled}
                className={`transition-all duration-500 transform focus:outline-none relative z-10 ${isHeartFilled ? 'cursor-default scale-110' : 'cursor-pointer hover:scale-120 active:scale-150'}`}
                title={isHeartFilled ? "" : "Click para transformar"}
                aria-label="Click para transformar"
              >
                <Heart 
                  className={`w-4 h-4 text-[var(--yellow)] drop-shadow-sm transition-all duration-500 ${isHeartFilled ? 'fill-current scale-110' : ''}`} 
                />
              </button>
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="absolute animate-particle pointer-events-none"
                  style={{
                    '--angle': `${p.angle}rad`,
                    '--dist': `${p.distance}px`,
                    width: p.size,
                    height: p.size,
                    backgroundColor: 'var(--yellow)',
                    borderRadius: '50%',
                    top: '50%',
                    left: '50%',
                  } as any}
                />
              ))}
            </div>
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
Footer;