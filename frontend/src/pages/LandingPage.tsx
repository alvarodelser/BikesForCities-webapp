import React from 'react';

import HeroSection from '../components/landing/HeroSection';
import MapSelector from '../components/landing/MapSelector';
import DataShowcaseSection from '../components/landing/DataShowcaseSection';
import GetInvolvedSection, { FaqSection } from '../components/landing/GetInvolvedSection';
import LandingReveal from '../components/landing/LandingReveal';

const LandingPage: React.FC = () => {
  return (
    <LandingReveal>
      <div className="overflow-x-hidden">
        <HeroSection />
        <MapSelector />
        <DataShowcaseSection />
        <GetInvolvedSection />
        <FaqSection />
      </div>
    </LandingReveal>
  );
};

export default LandingPage;
