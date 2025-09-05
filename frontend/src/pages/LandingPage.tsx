import React from 'react';

import HeroSection from '../components/landing/HeroSection';
import MapSelector from '../components/landing/MapSelector';

const LandingPage: React.FC = () => {
  return (
    <div>
      <HeroSection />
      <MapSelector />
    </div>
  );
};

export default LandingPage; 