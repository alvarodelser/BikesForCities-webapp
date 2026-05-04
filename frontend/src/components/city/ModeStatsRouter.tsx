import React from 'react';
import type { CityData } from '../../constants/cities';
import { useMapState } from '../../hooks/useMapState';
import { MAP_MODES } from '../../constants/mapModes';
import InfraStats from './map/modes/infrastructure/InfraStats';
import StationsStats from './map/modes/stations/StationsStats';
import TrafficStats from './map/modes/traffic/TrafficStats';
import AccidentsStats from './map/modes/accidents/AccidentsStats';

interface ModeStatsRouterProps {
  city: CityData;
}

const ModeStatsRouter: React.FC<ModeStatsRouterProps> = ({ city }) => {
  const { mode } = useMapState();

  switch (mode) {
    case MAP_MODES.INFRASTRUCTURE:
      return <InfraStats city={city} />;
    case MAP_MODES.STATIONS:
      return <StationsStats city={city} />;
    case MAP_MODES.TRAFFIC:
      return <TrafficStats city={city} />;
    case MAP_MODES.ACCIDENTS:
      return <AccidentsStats city={city} />;
    default:
      return null;
  }
};

export default ModeStatsRouter;
