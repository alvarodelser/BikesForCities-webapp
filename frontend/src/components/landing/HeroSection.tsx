import React from 'react';
import { FileText, Map, Building2, CircleChevronDown } from 'lucide-react';
import landingHeroImage from '../../assets/landing_hero.jpg';
import backgroundTexture from '../../assets/background2.svg';
import GlassCard from '../ui/GlassCard';
import IconContainer from '../ui/IconContainer';

const HeroSection: React.FC = () => {
  const scrollToNextSection = () => {
    const mapSelector = document.getElementById('map-selector');
    if (mapSelector) {
      mapSelector.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      className="w-full flex items-center justify-center px-6 relative"
      style={{
        backgroundColor: 'var(--cream)',
      }}
    >
      {/* Background texture extending upward to cover navbar */}
      <div
        className="absolute pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundTexture})`,
          backgroundSize: '600px 600px',
          backgroundPosition: 'top left',
          backgroundRepeat: 'repeat',
          top: -145, // Extend upward to cover navbar
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.07
        }}
      />

      <div className="relative w-full z-10 pt-[88px]">
        {/* Title */}
        <h1
          className="text-[6vw] font-heading font-bold leading-tight bg-gradient-to-b from-[#2c5c8c] to-[#3f7aba] bg-clip-text text-transparent 
         my-[-10px] mx-[50px] lg:mx-[100px]"
        >
          Bikes for Cities
        </h1>

        {/* Image */}

        {/* Introduction */}
        <div className="flex items-start justify-between mx-[50px] lg:mx-[100px] py-[30px] gap-[20px] lg:gap-[120px]">
          {/* Left side - Motivational phrase */}
          <div className="flex-1">
            <h1 className="text-3xl md:text-5xl font-heading font-bold bg-gradient-to-r from-[var(--blue-dark)] via-[var(--green-dark)] via-[var(--green)] to-[var(--blue)] bg-clip-text text-transparent leading-tight mb-6 tracking-tighter">
              <span className="block text-6xl lg:text-4xl tracking-tight">Movilidad sostenible</span>
              <span className="block text-4xl lg:text-3xl tracking-tight flex items-center gap-3 leading-[1.2]">
                en la era digital
                <CircleChevronDown
                  onClick={scrollToNextSection}
                  className="text-[var(--green)] cursor-pointer 
                    transition-all duration-300 
                    hover:scale-110 hover:text-[var(--green-dark)] 
                    animate-bounce"
                  size={32}
                />
              </span>
            </h1>
          </div>

          {/* Right side - Description and Feature cards */}
          <div className="flex-1">
            <div className="space-y-4">
              <GlassCard
                surface="glass"
                interactive
                tint="rgba(255, 255, 255, 0.15)"
                blurStrength="md"
                shadow="lg"
                size="md"
                className="group cursor-pointer"
                onClick={scrollToNextSection}
              >
                <div className="flex items-center gap-2 lg:gap-4">
                  <IconContainer
                    icon={Building2}
                    variant="glass"
                    size="lg"
                    tint="rgba(2, 122, 118, 0.6)"
                    iconColor="white"
                    hoverIconColor="#ffffff"
                    className="flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="flex-1">
                    <h3 className="text-md lg:text-xl font-semibold text-gray-800 mb-1">
                      Compara nuestras ciudades
                    </h3>

                    <p> Datos de más de X ciudades de todo el territorio</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard
                surface="glass"
                interactive
                tint="rgba(255, 255, 255, 0.15)"
                blurStrength="md"
                shadow="lg"
                size="md"
                className="group cursor-pointer"
                onClick={() => console.log('Explora mapas clicked')}
              >
                <div className="flex items-center gap-2 lg:gap-4">
                  <IconContainer
                    icon={Map}
                    variant="glass"
                    size="lg"
                    tint="rgba(244, 162, 76, 0.6)"
                    iconColor="white"
                    hoverIconColor="#ffffff"
                    className="flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="flex-1">
                    <h3 className="text-lg lg:text-xl font-semibold text-gray-800 mb-1">
                      Explora mapas de movilidad
                    </h3>
                    <p>
                      Diversos modos de ver sobre el papel.
                    </p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard
                surface="glass"
                interactive
                tint="rgba(255, 255, 255, 0.15)"
                blurStrength="md"
                shadow="lg"
                size="md"
                className="group cursor-pointer"
                onClick={scrollToNextSection}
              >
                <div className="flex items-center gap-2 lg:gap-4">
                  <IconContainer
                    icon={FileText}
                    variant="glass"
                    size="lg"
                    tint="rgba(175, 71, 73, 0.6)"
                    iconColor="white"
                    hoverIconColor="#ffffff"
                    className="flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 mb-1">
                      Planifica con visión de futuro
                    </h3>
                    <p>
                      Datos y estudios contrastados para informar una estrategia municipal basada en datos.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection; 