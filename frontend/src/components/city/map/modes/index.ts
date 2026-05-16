import AccidentsLayer from './accidents/AccidentsLayer';
import AccidentsLegend from './accidents/AccidentsLegend';
import InfrastructureLayer from './infrastructure/InfrastructureLayer';
import InfrastructureLegend from './infrastructure/InfrastructureLegend';
import StationsLayer from './stations/StationsLayer';
import StationsLegend from './stations/StationsLegend';
import TrafficLayer from './traffic/TrafficLayer';
import TrafficLegend from './traffic/TrafficLegend';
import AccidentsStats from './accidents/AccidentsStats';
import InfraStats from './infrastructure/InfraStats';
import StationsStats from './stations/StationsStats';
import TrafficStats from './traffic/TrafficStats';
import type React from 'react';

import { MAP_MODES } from '../../../../constants/mapModes';

export interface ModeConfig {
    /** Pure-imperative MapLibre component — returns null */
    layer: React.ComponentType<{ submode: string }>;
    /** Legend UI component */
    legend: React.ComponentType;
    /** Stats UI component */
    stats?: React.ComponentType<{ city: any }>;
    /** Available submode keys for this mode; empty = no submode selector */
    submodes: readonly string[];
    /** Default submode when none is in URL */
    defaultSubmode: string;
}

export const MODES: Record<string, ModeConfig> = {
    [MAP_MODES.ACCIDENTS]: {
        layer:          AccidentsLayer,
        legend:         AccidentsLegend,
        stats:          AccidentsStats,
        submodes:       ['bike', 'all'],
        defaultSubmode: 'bike',
    },
    [MAP_MODES.INFRASTRUCTURE]: {
        layer:          InfrastructureLayer,
        legend:         InfrastructureLegend,
        stats:          InfraStats,
        submodes:       [],
        defaultSubmode: '',
    },
    [MAP_MODES.STATIONS]: {
        layer:          StationsLayer,
        legend:         StationsLegend,
        stats:          StationsStats,
        submodes:       ['trips', 'downtime', 'reach'],
        defaultSubmode: 'trips',
    },
    [MAP_MODES.TRAFFIC]: {
        layer:          TrafficLayer,
        legend:         TrafficLegend,
        stats:          TrafficStats,
        submodes:       ['traces', 'heatmap'],
        defaultSubmode: 'traces',
    },
};
