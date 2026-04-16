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
    infrastructure: {
        layer:          InfrastructureLayer,
        legend:         InfrastructureLegend,
        submodes:       [],
        defaultSubmode: '',
    },
    stations: {
        layer:          StationsLayer,
        legend:         StationsLegend,
        submodes:       ['trips', 'downtime'],
        defaultSubmode: 'trips',
    },
    traffic: {
        layer:          TrafficLayer,
        legend:         TrafficLegend,
        submodes:       [],
        defaultSubmode: '',
    },
    terrain: {
        layer:          TerrainLayer,
        legend:         TerrainLegend,
        submodes:       [],
        defaultSubmode: '',
    },
    accidents: {
        layer:          AccidentsLayer,
        legend:         AccidentsLegend,
        submodes:       [],
        defaultSubmode: '',
    },
    intersections: {
        layer:          IntersectionsLayer,
        legend:         IntersectionsLegend,
        submodes:       [],
        defaultSubmode: '',
    },
};
