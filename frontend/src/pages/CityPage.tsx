import React from 'react';
import { useParams } from 'react-router';
import type { CityData } from '../constants/cities';
import { fetchCities } from '../services/api';
import { useViewport } from '../hooks/useViewport';
import MapDesktop from '../components/city/MapDesktop';
import MapMobile from '../components/city/MapMobile';
import ErrorContainer from '../components/ui/ErrorContainer';
import LoadingContainer from '../components/ui/LoadingContainer';
import CityRankTable from '../components/city/plots/CityRankTable';
import LineAreaChart from '../components/city/plots/LineAreaChart';
import ScoreDonut from '../components/city/plots/ScoreDonut';
import BarHistogram from '../components/city/plots/BarHistogram';
import StackedBarMatrix from '../components/city/plots/StackedBarMatrix';

const CityPage: React.FC = () => {
  const { cityName: rawCityName } = useParams<{ cityName: string }>();
  const cityName = rawCityName?.replace(/\/$/, "");
  const [city, setCity] = React.useState<CityData | null>(null);
  // true only on the very first load (no city yet); city transitions keep the map mounted
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { isMobile } = useViewport();

  React.useEffect(() => {
    setError(null);
    fetchCities().then(cities => {
      if (!cities || cities.length === 0) {
        setError("Unable to find city data. The database might be empty or unreachable.");
        setInitialLoading(false);
        return;
      }
      const found = cities.find(c =>
        c.slug === cityName ||
        c.name.toLowerCase().replace(/\s+/g, '') === cityName?.toLowerCase().replace(/\s+/g, '')
      );
      if (!found) {
        setError(`The city "${cityName}" could not be found.`);
        setInitialLoading(false);
      } else {
        setCity(found);
        setInitialLoading(false);
        document.title = `${found.name}${found.altName ? ` (${found.altName})` : ''} | BikesForCities`;
      }
    }).catch(err => {
      console.error(err);
      setError("Unable to reach the database. Please ensure the backend is running.");
      setInitialLoading(false);
    });
  }, [cityName]);

  if (initialLoading) {
    return (
      <div className="h-dvh bg-gradient-to-br from-[var(--blue)] to-[var(--blue-dark)] flex items-center justify-center">
        <LoadingContainer />
      </div>
    );
  }

  if (error || !city) {
    return (
      <div className="w-full h-dvh flex flex-col items-center justify-center bg-[var(--blue-dark)]">
        <ErrorContainer
          title="City Not Found"
          message={error || "The city you are looking for does not exist."}
          showHome={true}
        />
      </div>
    );
  }

  const demoCities = [
    { id: 1, name: city.name, score: 78.5, isCurrent: true },
    { id: 2, name: 'Barcelona', score: 85.2 },
    { id: 3, name: 'Vitoria-Gasteiz', score: 82.1 },
    { id: 4, name: 'Sevilla', score: 76.8 },
    { id: 5, name: 'Valencia', score: 74.2 },
  ];

  const demoChartData = [
    { date: 'Jan', value: 30, alt: 45 },
    { date: 'Feb', value: 40, alt: 52 },
    { date: 'Mar', value: 35, alt: 48 },
    { date: 'Apr', value: 50, alt: 61 },
    { date: 'May', value: 65, alt: 72 },
    { date: 'Jun', value: 60, alt: 68 },
  ];

  const demoSegments = [
    { label: 'Seguridad', weight: 0.4, value: 0.85, color: '#4ADE80' },
    { label: 'Conectividad', weight: 0.3, value: 0.65, color: '#60A5FA' },
    { label: 'Intermodalidad', weight: 0.3, value: 0.45, color: '#FACC15' },
  ];

  const demoHistogramData = [
    { label: '0-50m', value: 120 },
    { label: '50-100m', value: 340 },
    { label: '100-150m', value: 560 },
    { label: '150-200m', value: 210 },
    { label: '200m+', value: 90 },
  ];

  const demoMatrixRows = [
    {
      label: 'Comercial',
      total: 1000,
      segments: [
        { value: 400, color: '#4ADE80', label: 'Seguro' },
        { value: 350, color: '#FACC15', label: 'Neutral' },
        { value: 250, color: '#F87171', label: 'Inseguro' },
      ]
    },
    {
      label: 'Residencial',
      total: 2500,
      segments: [
        { value: 1500, color: '#4ADE80', label: 'Seguro' },
        { value: 700, color: '#FACC15', label: 'Neutral' },
        { value: 300, color: '#F87171', label: 'Inseguro' },
      ]
    },
  ];
  const demoMatrixLabels = ['Seguro', 'Neutral', 'Inseguro'];

  return (
    <div className="h-dvh flex flex-col overflow-auto bg-gray-50">
      {/* PROVISIONAL DEMO SECTION */}
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 border-b bg-white z-10">
        <div className="col-span-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">City Ranking</h2>
          <CityRankTable cities={demoCities} accent="#AF4749" />
        </div>
        <div className="col-span-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Network Growth</h2>
          <LineAreaChart 
            data={demoChartData} 
            xKey="date" 
            title="Kilómetros de red"
            subtitle="Evolución histórica de la infraestructura"
            series={[
              { key: 'value', label: 'Carril Bici', color: '#AF4749', type: 'area' },
              { key: 'alt', label: 'Ciclocarril', color: '#60A5FA', type: 'line', dashed: true }
            ]}
          />
        </div>
        <div className="col-span-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Service Score</h2>
          <ScoreDonut 
            segments={demoSegments} 
            cityName={city.name} 
            overallScore={78} 
            accent="#AF4749" 
          />
        </div>
        <div className="col-span-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Coverage Histogram</h2>
          <BarHistogram 
            data={demoHistogramData} 
            accent="#AF4749" 
            title="Distancia a red"
            subtitle="Población por proximidad"
            gradient
          />
        </div>
        <div className="col-span-1 md:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Safety Matrix</h2>
          <StackedBarMatrix 
            rows={demoMatrixRows} 
            segmentLabels={demoMatrixLabels}
            title="Percepción por zona"
            subtitle="Distribución de seguridad percibida"
          />
        </div>
      </div>

      <div className="flex-1 min-h-[600px] relative">
        {isMobile ? <MapMobile city={city} /> : <MapDesktop city={city} />}
      </div>
    </div>
  );
};

export default CityPage;
 