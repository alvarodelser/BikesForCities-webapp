import { createContext, useContext } from 'react';

export interface Thresholds {
    q5: number;
    q50: number;
    q95: number;
    max: number;
    min: number;
}

export interface ThresholdsContextValue {
    thresholds: Thresholds | null;
    setThresholds: (t: Thresholds | null) => void;
}

export const ThresholdsContext = createContext<ThresholdsContextValue>({
    thresholds: null,
    setThresholds: () => {},
});

export const useThresholds = () => useContext(ThresholdsContext);
