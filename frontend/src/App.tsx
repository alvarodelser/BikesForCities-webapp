import { Routes, Route } from "react-router";

import LandingPage from "./pages/LandingPage";
import CityPage from "./pages/CityPage";
// import ComparePage from "./pages/ComparePage";
// import AboutPage from "./pages/AboutPage";

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map/:cityName" element={<CityPage />} />
        {/* <Route path="/compare" element={<ComparePage />} /> */}
        {/* <Route path="/about" element={<AboutPage />} /> */}
      </Routes>
      <Footer />
    </>
  );
}

export default App;