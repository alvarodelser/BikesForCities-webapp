import { MODES } from './modes';
import { useMapState } from '../../../hooks/useMapState';

/**
 * Resolves the active mode from the URL and mounts the matching Layer component.
 * Only rendered after the MapLibre map fires its 'load' event.
 */
export default function ActiveLayer() {
    const { mode, submode } = useMapState();
    const config = MODES[mode];
    if (!config) return null;

    const Layer = config.layer;
    // Use URL submode, falling back to mode's default
    const resolvedSubmode = submode || config.defaultSubmode;
    return <Layer submode={resolvedSubmode} />;
}
