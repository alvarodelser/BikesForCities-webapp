import React, { Suspense } from 'react';
import { Routes, Route, useLocation } from "react-router";

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import { useViewport } from "./hooks/useViewport";

const LandingPage  = React.lazy(() => import('./pages/LandingPage'));
const CityPage     = React.lazy(() => import('./pages/CityPage'));
const ComparePage  = React.lazy(() => import('./pages/ComparePage'));
const AboutPage    = React.lazy(() => import('./pages/AboutPage'));
const StatusPage   = React.lazy(() => import('./pages/StatusPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

function CreamShell() {
  return <div className="min-h-dvh bg-[var(--cream)]" />;
}
function DarkShell() {
  return <div className="min-h-dvh bg-[var(--blue-dark)]" />;
}

function App() {
  const { isMobile } = useViewport();
  const location = useLocation();
  const isMapPage = location.pathname.startsWith('/map');

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Suspense fallback={<CreamShell />}><LandingPage /></Suspense>} />
        <Route path="/map/:cityName" element={<Suspense fallback={<DarkShell />}><CityPage /></Suspense>} />
        <Route path="/compare" element={<Suspense fallback={<CreamShell />}><ComparePage /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<CreamShell />}><AboutPage /></Suspense>} />
        <Route path="/status" element={<Suspense fallback={<CreamShell />}><StatusPage /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<CreamShell />}><NotFoundPage /></Suspense>} />
      </Routes>
      {!isMobile && !isMapPage && <Footer />}
    </>
  );
}

export default App;
