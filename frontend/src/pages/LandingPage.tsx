import React from 'react';
import { Link } from 'react-router-dom';

import HeroSection from '../components/landing/HeroSection';
import MapSelector from '../components/landing/MapSelector';

const LandingPage: React.FC = () => {
  return (
    <>
      <HeroSection />
      <MapSelector />
      {/* <InvolvedSection /> */}
    </>
  );
};

export default LandingPage; 