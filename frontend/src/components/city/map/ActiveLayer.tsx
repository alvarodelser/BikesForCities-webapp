import { MODES } from './modes';
import { useMapState } from '../../../hooks/useMapState';
import { MAP_MODES } from '../../../constants/mapModes';

/**
 * Resolves the active mode from the URL and mounts the matching Layer component.
 * Only rendered after the MapLibre map fires its 'load' event.
 */
export default function ActiveLayer() {
    const { mode, submode, period } = useMapState();
    const config = MODES[mode];
    if (!config) return null;

    const Layer = config.layer;
    const resolvedSubmode = submode || config.defaultSubmode;

    // Accidents mode reuses `period` URL param to store the selected year
    const year = mode === MAP_MODES.ACCIDENTS && period ? parseInt(period, 10) : undefined;

    return <Layer submode={resolvedSubmode} year={year} />;
}
