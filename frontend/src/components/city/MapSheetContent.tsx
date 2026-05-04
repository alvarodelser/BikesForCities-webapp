import React from 'react';
import type { CityData } from '../../constants/cities';
import ModeStatsRouter from './ModeStatsRouter';

interface MapSheetContentProps {
  city: CityData;
}

export const MapSheetContent: React.FC<MapSheetContentProps> = ({ city }) => {
  return <ModeStatsRouter city={city} />;
};

export default MapSheetContent;
