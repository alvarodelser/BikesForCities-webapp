import TrafficRoutesLayer from './TrafficRoutesLayer';
import TrafficTripsLayer from './TrafficTripsLayer';

export default function TrafficModeLayer({ submode }: { submode: string }) {
    if (submode === 'od') return <TrafficTripsLayer />;
    return <TrafficRoutesLayer />;
}
