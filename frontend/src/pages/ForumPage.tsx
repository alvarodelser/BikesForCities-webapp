import React, { useRef, useMemo, useState } from 'react';
import { getNews } from '../services/newsService';
import NewsCard from '../components/forum/NewsCard';
import NewsTimeline from '../components/forum/NewsTimeline';
import { Search, X } from 'lucide-react';
import CityBuildingBackground, { type CityBuildingBackgroundHandle } from '../components/forum/CityBuildingBackground';
import BuildingTrajectories from '../components/forum/BuildingTrajectories';
import { fetchCities, fetchStreetNetwork } from '../services/api';
import type { CityData } from '../constants/cities';
import type { GeoBbox } from '../utils/geoProjection';
import { extractStreetSegments, findMarginCrossingPaths, geoLineToSvgPath } from '../utils/streetPathfinding';

// Radius (degrees) around city center to display — ~2.2 km for dense downtown
const DOWNTOWN_RADIUS = 0.022;

function selectMadridCity(cities: CityData[]): CityData | undefined {
  return (
    cities.find((c) => c.name.toLowerCase().includes('madrid')) ??
    cities.reduce((prev, cur) =>
      (cur.population || 0) > (prev.population || 0) ? cur : prev
    )
  );
}

function buildViewBbox(city: CityData): GeoBbox {
  const { longitude: lon, latitude: lat } = city.geoCoords;
  return {
    minLon: lon - DOWNTOWN_RADIUS,
    maxLon: lon + DOWNTOWN_RADIUS,
    minLat: lat - DOWNTOWN_RADIUS,
    maxLat: lat + DOWNTOWN_RADIUS,
  };
}

const ForumPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearch, setShowSearch] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<CityBuildingBackgroundHandle | null>(null);
  const [cities, setCities] = useState<CityData[]>([]);
  const [trajectoryPaths, setTrajectoryPaths] = useState<string[]>([]);

  const selectedCity = useMemo(
    () => (cities.length > 0 ? selectMadridCity(cities) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities.length > 0]
  );

  const selectedCityId = selectedCity?.id ?? 1;
  const viewBbox: GeoBbox | undefined = useMemo(
    () => (selectedCity ? buildViewBbox(selectedCity) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCity?.id]
  );

  const allNews = useMemo(() => getNews(), []);

  const filteredNews = useMemo(() => {
    let filtered = allNews;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = allNews.filter(
        (item) =>
          item.headline.toLowerCase().includes(query) ||
          (item.summary && item.summary.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [searchQuery, allNews]);

  const handleDotClick = (index: number) => {
    if (!pageRef.current) return;
    const cards = pageRef.current.querySelectorAll('[data-news-id]');
    const card = cards[index] as HTMLElement | undefined;
    if (!card) return;
    const absoluteTop = window.scrollY + card.getBoundingClientRect().top - 96;
    window.scrollTo({ top: absoluteTop, behavior: 'smooth' });
  };

  React.useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  React.useEffect(() => {
    fetchCities().then(setCities).catch(() => {});
  }, []);

  // Load street network and compute trajectories when city + viewBbox are ready
  React.useEffect(() => {
    if (!selectedCity || !viewBbox) return;

    fetchStreetNetwork(selectedCityId)
      .then((streetGeoJSON) => {
        const segments = extractStreetSegments(streetGeoJSON.features, viewBbox);

        if (segments.length === 0) {
          setTrajectoryPaths([]);
          return;
        }

        // Filter to segments within the downtown view
        const centerSegments = segments.filter((seg) =>
          seg.points.some(
            ([lon, lat]) =>
              lon >= viewBbox.minLon &&
              lon <= viewBbox.maxLon &&
              lat >= viewBbox.minLat &&
              lat <= viewBbox.maxLat
          )
        );

        const crossingPaths = findMarginCrossingPaths(
          centerSegments.length > 0 ? centerSegments : segments,
          viewBbox
        );

        const svgPaths = crossingPaths.map((path) =>
          geoLineToSvgPath(path.points, viewBbox)
        );

        setTrajectoryPaths(svgPaths);
      })
      .catch(() => {
        setTrajectoryPaths([]);
      });
  }, [selectedCityId, viewBbox]);

  return (
    <div
      ref={pageRef}
      className="scrollbar-hide min-h-screen"
      style={{ position: 'relative', background: 'var(--forum-bg)' }}
    >
      <CityBuildingBackground cityId={selectedCityId} ref={bgRef} viewBbox={viewBbox} />
      <BuildingTrajectories bgRef={bgRef} trajectoryPaths={trajectoryPaths} />

      {/* Header */}
      <div
        className="sticky top-0 z-50 border-b border-[var(--blue-light)] py-6 px-8"
        style={{
          background: 'rgba(237, 224, 204, 0.72)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.5)',
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-[var(--blue-dark)]">
            Foro de Noticias
          </h1>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-[var(--blue-light)]/20 rounded transition-colors"
          >
            {showSearch ? (
              <X size={20} className="text-[var(--blue-dark)]" />
            ) : (
              <Search size={20} className="text-[var(--blue-dark)]" />
            )}
          </button>
        </div>

        {showSearch && (
          <div className="max-w-4xl mx-auto mt-4">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar noticias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--cream)] text-[var(--black)] placeholder-[var(--black)] placeholder-opacity-40 border-b-2 border-[var(--blue)] outline-none font-body text-base py-2 px-1 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Feed */}
      <div
        className="pr-8 max-w-4xl mx-auto py-8"
        style={{ position: 'relative', zIndex: 3 }}
      >
        {filteredNews.length > 0 ? (
          filteredNews.map((item) => (
            <div key={item.id} data-news-id={item.id}>
              <NewsCard item={item} />
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-[var(--black)] opacity-50">
            No hay noticias que coincidan con tu búsqueda.
          </div>
        )}
      </div>

      {/* Fixed Timeline */}
      <NewsTimeline items={filteredNews} onDotClick={handleDotClick} />
    </div>
  );
};

export default ForumPage;
