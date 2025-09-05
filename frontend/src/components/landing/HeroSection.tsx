import React from 'react';
import { FileText, Map, CircuitBoard, CircleChevronDown } from 'lucide-react';
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
      
      <div className="relative w-full z-10">
        {/* Title */}
        <h1
          className="text-[6vw] font-heading font-bold leading-tight bg-gradient-to-b from-[#2c5c8c] to-[#3f7aba] bg-clip-text text-transparent my-[0px] mx-[120px]"
        >
          Bikes for Cities
        </h1>

        {/* Image */}
        <div 
          className="h-[400px] bg-cover bg-center rounded-sm mx-[100px] -mt-[20px]"
          style={{
            backgroundImage: `url(${landingHeroImage})`,
            backgroundPosition: 'center center'
          }}
        ></div>

        {/* Introduction */}
        <div className="flex items-start justify-between mx-[100px] py-[30px] gap-[120px]">
          {/* Left side - Motivational phrase */}
          <div className="flex-1">
            <h1 className="text-5xl font-heading font-bold bg-gradient-to-r from-[var(--blue-dark)] via-[var(--green-dark)] via-[var(--green)] to-[var(--blue)] bg-clip-text text-transparent leading-tight mb-6 tracking-tighter">
              <span className="block text-8xl tracking-tight">Movilidad sostenible</span>
              <span className="block text-5xl tracking-tight flex items-center gap-3 leading-[1.2]">
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
                <div className="flex items-center gap-4">
                  <IconContainer
                    icon={CircuitBoard}
                    variant="glass"
                    size="lg"
                    tint="rgba(59, 130, 246, 0.2)"
                    hoverTint="rgba(59, 130, 246, 0.3)"
                    iconColor="white"
                    hoverIconColor="#ffffff"
                    className="flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 mb-1 group-hover:text-gray-700 transition-colors duration-300">
                      Compara nuestras ciudades
                    </h3>
                    <p className="text-sm text-gray-600 group-hover:text-gray-500 transition-colors duration-300">
                      Analiza datos de movilidad urbana
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
                onClick={() => console.log('Explora mapas clicked')}
              >
                <div className="flex items-center gap-4">
                  <IconContainer
                    icon={Map}
                    variant="glass"
                    size="lg"
                    tint="#027a76"
                    hoverTint="rgba(33, 150, 243, 0.3)"
                    iconColor="white"
                    hoverIconColor="#e3f2fd"
                    onClick={() => console.log('Explora mapas clicked')}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 mb-1 group-hover:text-gray-700 transition-colors duration-300">
                      Explora mapas de tráfico
                    </h3>
                    <p className="text-sm text-gray-600 group-hover:text-gray-500 transition-colors duration-300">
                      Visualiza patrones de ciclismo urbano
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
                <div className="flex items-center gap-4">
                  <IconContainer
                    icon={FileText}
                    variant="glass"
                    size="lg"
                    tint="rgba(156, 39, 176, 0.2)"
                    hoverTint="rgba(156, 39, 176, 0.3)"
                    iconColor="white"
                    hoverIconColor="#f3e5f5"
                    onClick={scrollToNextSection}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 mb-1 group-hover:text-gray-700 transition-colors duration-300">
                      Planifica con visión de futuro
                    </h3>
                    <p className="text-sm text-gray-600 group-hover:text-gray-500 transition-colors duration-300">
                      Diseña infraestructura sostenible
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