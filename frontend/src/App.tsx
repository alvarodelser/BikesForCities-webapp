import { Routes, Route } from "react-router";

import LandingPage from "./pages/LandingPage";
import CityPage from "./pages/CityPage";
import NotFoundPage from "./pages/NotFoundPage";
import ComparePage from "./pages/ComparePage";
import AboutPage from "./pages/AboutPage";
import StatusPage from "./pages/StatusPage";

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

import { useViewport } from "./hooks/useViewport";

function App() {
  const { isMobile } = useViewport();

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map/:cityName" element={<CityPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!isMobile && <Footer />}
    </>
  );
}

export default App;