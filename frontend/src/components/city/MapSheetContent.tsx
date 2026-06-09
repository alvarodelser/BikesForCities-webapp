import React from 'react';
import type { CityData } from '../../constants/cities';
import ModeStatsRouter from './ModeStatsRouter';
import type { BudgetYear, MayorTerm, ElectionResult } from '../../services/api';

export interface TransparencyDataProps {
  budgetYears: BudgetYear[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  budgetType: 'planned' | 'executed';
  onBudgetTypeChange: (t: 'planned' | 'executed') => void;
  mayors: MayorTerm[];
  elections: ElectionResult[];
}

interface MapSheetContentProps {
  city: CityData;
  transparencyData?: TransparencyDataProps;
}

export const MapSheetContent: React.FC<MapSheetContentProps> = ({ city, transparencyData }) => {
  return <ModeStatsRouter city={city} variant="darkTint" transparencyData={transparencyData} />;
};

export default MapSheetContent;
