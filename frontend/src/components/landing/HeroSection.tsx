import React from 'react';
import { FileText, Map, CircuitBoard, CircleChevronDown } from 'lucide-react';
import landingHeroImage from '../../assets/landing_hero5.jpg';
import backgroundTexture from '../../assets/background2.svg';
import FeatureCard from '../ui/FeatureCard';

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
          className="h-[600px] bg-cover bg-center rounded-sm mx-[100px] -mt-[20px]"
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
              <FeatureCard 
                icon={CircuitBoard} 
                text="Compara nuestras ciudades" 
              />
              <FeatureCard 
                icon={Map} 
                text="Explora mapas de tráfico ciclista" 
              />
              <FeatureCard 
                icon={FileText} 
                text="Planifica con visión de futuro" 
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection; 