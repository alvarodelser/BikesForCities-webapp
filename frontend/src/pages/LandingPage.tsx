import React from 'react';

import HeroSection from '../components/landing/HeroSection';
import MapSelector from '../components/landing/MapSelector';
import DataShowcaseSection from '../components/landing/DataShowcaseSection';
import GetInvolvedSection from '../components/landing/GetInvolvedSection';

const LandingPage: React.FC = () => {
  return (
    <div className="overflow-x-hidden">
      <HeroSection />
      <MapSelector />
      <DataShowcaseSection />
      <GetInvolvedSection />
    </div>
  );
};

export default LandingPage;