import React from 'react';

import HeroSection from '../components/landing/HeroSection';
import MapSelector from '../components/landing/MapSelector';
import GetInvolvedSection from '../components/landing/GetInvolvedSection';

const LandingPage: React.FC = () => {
  return (
    <div className="overflow-x-hidden">
      <HeroSection />
      <MapSelector />
      <GetInvolvedSection />
    </div>
  );
};

export default LandingPage;