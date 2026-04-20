import InfrastructureLayer from './infrastructure/InfrastructureLayer';
import InfrastructureLegend from './infrastructure/InfrastructureLegend';
import StationsLayer from './stations/StationsLayer';
import StationsLegend from './stations/StationsLegend';
import TrafficLayer from './traffic/TrafficLayer';
import TrafficLegend from './traffic/TrafficLegend';
import TerrainLayer from './terrain/TerrainLayer';
import TerrainLegend from './terrain/TerrainLegend';
import AccidentsLayer from './accidents/AccidentsLayer';
import AccidentsLegend from './accidents/AccidentsLegend';
import IntersectionsLayer from './intersections/IntersectionsLayer';
import IntersectionsLegend from './intersections/IntersectionsLegend';
import type React from 'react';

import { MAP_MODES } from '../../../../constants/mapModes';

export interface ModeConfig {
    /** Pure-imperative MapLibre component — returns null */
    layer: React.ComponentType<{ submode: string }>;
    /** Legend UI component */
    legend: React.ComponentType;
    /** Available submode keys for this mode; empty = no submode selector */
    submodes: readonly string[];
    /** Default submode when none is in URL */
    defaultSubmode: string;
}

export const MODES: Record<string, ModeConfig> = {
    [MAP_MODES.INFRASTRUCTURE]: {
        layer:          InfrastructureLayer,
        legend:         InfrastructureLegend,
        submodes:       [],
        defaultSubmode: '',
    },
    [MAP_MODES.STATIONS]: {
        layer:          StationsLayer,
        legend:         StationsLegend,
        submodes:       ['trips', 'downtime', 'reach'],
        defaultSubmode: 'trips',
    },
    [MAP_MODES.TRAFFIC]: {
        layer:          TrafficLayer,
        legend:         TrafficLegend,
        submodes:       ['traces', 'heatmap'],
        defaultSubmode: 'traces',
    },
    [MAP_MODES.TERRAIN]: {
        layer:          TerrainLayer,
        legend:         TerrainLegend,
        submodes:       [],
        defaultSubmode: '',
    },
    [MAP_MODES.ACCIDENTS]: {
        layer:          AccidentsLayer,
        legend:         AccidentsLegend,
        submodes:       [],
        defaultSubmode: '',
    },
    [MAP_MODES.INTERSECTIONS]: {
        layer:          IntersectionsLayer,
        legend:         IntersectionsLegend,
        submodes:       [],
        defaultSubmode: '',
    },
};
