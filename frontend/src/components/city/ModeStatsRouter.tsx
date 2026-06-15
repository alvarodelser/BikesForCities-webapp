import React, { useState, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import { useMapState } from '../../hooks/useMapState';
import { MAP_MODES } from '../../constants/mapModes';
import InfraStats from './map/modes/infrastructure/InfraStats';
import StationsStats from './map/modes/stations/StationsStats';
import TrafficStats from './map/modes/traffic/TrafficStats';
import AccidentsStats from './map/modes/accidents/AccidentsStats';
import TransparencyStats from './map/modes/transparency/TransparencyStats';
import { fetchCityBudgets, fetchCityContext, fetchMayorsTimeline } from '../../services/api';
import type { BudgetYear, MayorTerm, ElectionResult, CouncilorRecord } from '../../services/api';
import type { TransparencyDataProps } from './MapSheetContent';
import { MOBILITY_CODES } from './plots/BudgetSunburst';

interface ModeStatsRouterProps {
  city: CityData;
  variant?: 'light' | 'darkTint';
  transparencyData?: TransparencyDataProps;
}

const TransparencyContainer: React.FC<{ city: CityData; variant?: 'light' | 'darkTint' }> = ({ city, variant }) => {
  const [budgetYears, setBudgetYears] = useState<BudgetYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [highlightCodes, setHighlightCodes] = useState<Set<string>>(() => new Set(MOBILITY_CODES));
  const [mayors, setMayors] = useState<MayorTerm[]>([]);
  const [elections, setElections] = useState<ElectionResult[]>([]);
  const [councilors, setCouncilors] = useState<CouncilorRecord[]>([]);

  useEffect(() => {
    if (!city.id) return;
    Promise.all([
      fetchCityBudgets(city.id).catch(() => [] as BudgetYear[]),
      fetchCityContext(city.id).catch(() => ({ mayors: [] as MayorTerm[], budget_year: null, budget_categories: {} })),
      fetchMayorsTimeline(city.id).catch(() => ({ mayors: [], elections: [] as ElectionResult[], councilors: [] as CouncilorRecord[] })),
    ]).then(([budgets, context, timeline]) => {
      setBudgetYears(budgets);
      if (budgets.length > 0) setSelectedYear(budgets[0].year);
      setMayors(context.mayors ?? []);
      setElections(timeline.elections ?? []);
      setCouncilors(timeline.councilors ?? []);
    });
  }, [city.id]);

  if (budgetYears.length === 0 && mayors.length === 0) return null;

  return (
    <TransparencyStats
      city={city}
      budgetYears={budgetYears}
      selectedYear={selectedYear}
      onYearChange={setSelectedYear}
      highlightCodes={highlightCodes}
      onHighlightChange={setHighlightCodes}
      mayors={mayors}
      elections={elections}
      councilors={councilors}
      variant={variant}
    />
  );
};

const ModeStatsRouter: React.FC<ModeStatsRouterProps> = ({ city, variant, transparencyData }) => {
  const { mode } = useMapState();

  switch (mode) {
    case MAP_MODES.INFRASTRUCTURE:
      return <InfraStats city={city} variant={variant} />;
    case MAP_MODES.STATIONS:
      return <StationsStats city={city} variant={variant} />;
    case MAP_MODES.TRAFFIC:
      return <TrafficStats city={city} variant={variant} />;
    case MAP_MODES.ACCIDENTS:
      return <AccidentsStats city={city} variant={variant} />;
    case MAP_MODES.TRANSPARENCY:
      if (transparencyData && transparencyData.budgetYears.length > 0) {
        return (
          <TransparencyStats
            city={city}
            budgetYears={transparencyData.budgetYears}
            selectedYear={transparencyData.selectedYear}
            onYearChange={transparencyData.onYearChange}
            highlightCodes={transparencyData.highlightCodes}
            onHighlightChange={transparencyData.onHighlightChange}
            mayors={transparencyData.mayors}
            elections={transparencyData.elections}
            councilors={transparencyData.councilors}
            variant={variant}
          />
        );
      }
      return <TransparencyContainer city={city} variant={variant} />;
    default:
      return null;
  }
};

export default ModeStatsRouter;
