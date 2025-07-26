import { Routes, Route } from "react-router";

import LandingPage from "./pages/LandingPage";
import ComparePage from "./pages/ComparePage";
import MapPage from "./pages/MapPage";
import AboutPage from "./pages/AboutPage";

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* <Route path="/compare" element={<ComparePage />} /> */}
        <Route path="/map" element={<MapPage />} />
        {/* <Route path="/about" element={<AboutPage />} /> */}
      </Routes>
      <Footer />
    </>
  );
}

export default App;