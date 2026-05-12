import React, { useRef, useMemo, useState } from 'react';
import { getNews } from '../services/newsService';
import NewsCard from '../components/forum/NewsCard';
import NewsTimeline from '../components/forum/NewsTimeline';
import { Search, X } from 'lucide-react';
import CityBuildingBackground, { type CityBuildingBackgroundHandle } from '../components/forum/CityBuildingBackground';
import BuildingTrajectories from '../components/forum/BuildingTrajectories';
import { fetchCities, fetchStreetNetwork } from '../services/api';
import type { CityData } from '../constants/cities';
import { extractStreetSegments, findMarginCrossingPaths, geoLineToSvgPath } from '../utils/streetPathfinding';

const ForumPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearch, setShowSearch] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<CityBuildingBackgroundHandle | null>(null);
  const [cities, setCities] = useState<CityData[]>([]);
  const [trajectoryPaths, setTrajectoryPaths] = useState<string[]>([]);
  const selectedCityId = useMemo(
    () => {
      if (cities.length === 0) return 1;
      // Pick the city with the largest population for denser buildings
      const largest = cities.reduce((prev, current) =>
        (current.population || 0) > (prev.population || 0) ? current : prev
      );
      return largest.id ?? 1;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities.length > 0]
  );

  const allNews = useMemo(() => getNews(), []);

  const filteredNews = useMemo(() => {
    if (!searchQuery.trim()) return allNews;

    const query = searchQuery.toLowerCase();
    return allNews.filter(item =>
      item.headline.toLowerCase().includes(query) ||
      (item.summary && item.summary.toLowerCase().includes(query))
    );
  }, [searchQuery, allNews]);

  const handleDotClick = (index: number) => {
    if (!pageRef.current) return;

    const cards = pageRef.current.querySelectorAll('[data-news-id]');
    if (cards[index]) {
      const card = cards[index] as HTMLElement;
      const cardTop = card.getBoundingClientRect().top;
      const pageTop = pageRef.current.getBoundingClientRect().top;
      window.scrollBy({
        top: cardTop - pageTop - 120,
        behavior: 'smooth'
      });
    }
  };

  React.useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  React.useEffect(() => {
    fetchCities().then(setCities).catch(() => {
      // Silent fail — default city id 1 will be used
    });
  }, []);

  // Load street network and compute trajectories when city changes
  React.useEffect(() => {
    if (selectedCityId === 1) return; // Don't fetch until city is loaded

    fetchStreetNetwork(selectedCityId)
      .then((streetGeoJSON) => {
        // Extract street segments
        const segments = extractStreetSegments(streetGeoJSON.features, {
          minLon: 0,
          maxLon: 1,
          minLat: 0,
          maxLat: 1,
        });

        // We need to compute bbox from streets to find margin-crossing paths
        // For now, use fallback paths if we can't compute them properly
        if (segments.length === 0) {
          setTrajectoryPaths([]);
          return;
        }

        // Extract all coordinates to compute bbox
        const allCoords: [number, number][] = [];
        segments.forEach((seg) => {
          allCoords.push(...seg.points);
        });

        if (allCoords.length === 0) {
          setTrajectoryPaths([]);
          return;
        }

        // Compute bbox
        const bbox = {
          minLon: Math.min(...allCoords.map((c) => c[0])),
          maxLon: Math.max(...allCoords.map((c) => c[0])),
          minLat: Math.min(...allCoords.map((c) => c[1])),
          maxLat: Math.max(...allCoords.map((c) => c[1])),
        };

        // Compute center zone (40% like buildings)
        const lonWidth = bbox.maxLon - bbox.minLon;
        const latHeight = bbox.maxLat - bbox.minLat;
        const centerZone = {
          minLon: bbox.minLon + lonWidth * 0.3,
          maxLon: bbox.maxLon - lonWidth * 0.3,
          minLat: bbox.minLat + latHeight * 0.3,
          maxLat: bbox.maxLat - latHeight * 0.3,
        };

        // Filter segments to center zone
        const centerSegments = segments.filter((seg) =>
          seg.points.some(([lon, lat]) =>
            lon >= centerZone.minLon &&
            lon <= centerZone.maxLon &&
            lat >= centerZone.minLat &&
            lat <= centerZone.maxLat
          )
        );

        // Find margin-crossing paths
        const crossingPaths = findMarginCrossingPaths(centerSegments, centerZone);

        // Convert to SVG paths
        const svgPaths = crossingPaths.map((path) => geoLineToSvgPath(path.points, centerZone));

        setTrajectoryPaths(svgPaths);
      })
      .catch(() => {
        // Silent fail - use default paths
        setTrajectoryPaths([]);
      });
  }, [selectedCityId]);

  return (
    <div ref={pageRef} className="scrollbar-hide min-h-screen" style={{ position: 'relative', background: 'var(--forum-bg)' }}>
      <CityBuildingBackground cityId={selectedCityId} ref={bgRef} />
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
          <h1 className="font-heading text-2xl font-bold text-[var(--blue-dark)]">Foro de Noticias</h1>
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

        {/* Search bar - hidden by default */}
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

      {/* Feed content */}
      <div className="pr-8 max-w-4xl mx-auto py-8" style={{ position: 'relative', zIndex: 3 }}>
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

      {/* Right: Fixed Timeline */}
      <NewsTimeline
        items={filteredNews}
        onDotClick={handleDotClick}
      />
    </div>
  );
};

export default ForumPage;
