import React, { useState, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import { useMapState } from '../../hooks/useMapState';
import { MAP_MODES } from '../../constants/mapModes';
import InfraStats from './map/modes/infrastructure/InfraStats';
import StationsStats from './map/modes/stations/StationsStats';
import TrafficStats from './map/modes/traffic/TrafficStats';
import AccidentsStats from './map/modes/accidents/AccidentsStats';
import TransparencyStats from './map/modes/transparency/TransparencyStats';
import { fetchCityBudgets, fetchCityContext } from '../../services/api';
import type { BudgetYear, MayorTerm } from '../../services/api';
import type { TransparencyDataProps } from './MapSheetContent';

interface ModeStatsRouterProps {
  city: CityData;
  variant?: 'light' | 'darkTint';
  transparencyData?: TransparencyDataProps;
}

const TransparencyContainer: React.FC<{ city: CityData }> = ({ city }) => {
  const [budgetYears, setBudgetYears] = useState<BudgetYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [budgetType, setBudgetType] = useState<'planned' | 'executed'>('planned');
  const [mayors, setMayors] = useState<MayorTerm[]>([]);

  useEffect(() => {
    if (!city.id) return;
    Promise.all([
      fetchCityBudgets(city.id).catch(() => [] as BudgetYear[]),
      fetchCityContext(city.id).catch(() => ({ mayors: [] as MayorTerm[], budget_year: null, budget_categories: {} })),
    ]).then(([budgets, context]) => {
      setBudgetYears(budgets);
      if (budgets.length > 0) setSelectedYear(budgets[0].year);
      setMayors(context.mayors ?? []);
    });
  }, [city.id]);

  if (budgetYears.length === 0 && mayors.length === 0) return null;

  return (
    <TransparencyStats
      city={city}
      budgetYears={budgetYears}
      selectedYear={selectedYear}
      onYearChange={setSelectedYear}
      budgetType={budgetType}
      onBudgetTypeChange={setBudgetType}
      mayors={mayors}
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
            budgetType={transparencyData.budgetType}
            onBudgetTypeChange={transparencyData.onBudgetTypeChange}
            mayors={transparencyData.mayors}
          />
        );
      }
      return <TransparencyContainer city={city} />;
    default:
      return null;
  }
};

export default ModeStatsRouter;
