import type { CityData } from './cities';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart, 
  Activity,
  Target,
  Clock,
  Users
} from 'lucide-react';
import { formatDistance, formatPopulation } from '../utils/formatters';

export interface StatItem {
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ComponentType<any>;
}

export interface ModeStats {
  stats: StatItem[];
  insights: {
    primary: string;
    secondary: string;
  };
  recommendations: {
    primary: string;
    secondary: string;
  };
  overallScore: {
    score: number;
    label: string;
  };
}

export const getModeStats = (selectedMode: string, city: CityData): ModeStats => {
  switch (selectedMode) {
    case 'traffic':
      return {
        stats: [
          { label: 'Average Congestion', value: 'Medium', trend: 'up', icon: Activity },
          { label: 'Peak Traffic Hours', value: '7-9 AM', trend: 'neutral', icon: Clock },
          { label: 'Average Speed', value: '25 km/h', trend: 'down', icon: TrendingDown },
          { label: 'Traffic Incidents', value: '12/day', trend: 'down', icon: Target }
        ],
        insights: {
          primary: 'Traffic congestion peaks during morning rush hours (7-9 AM)',
          secondary: 'Average speed has decreased by 5% due to increased cycling'
        },
        recommendations: {
          primary: 'Implement dedicated cycling lanes to reduce congestion',
          secondary: 'Optimize traffic light timing for cyclists'
        },
        overallScore: {
          score: 78,
          label: 'Good Performance'
        }
      };

    case 'stations':
      return {
        stats: [
          { label: 'Total Stations', value: '45', trend: 'up', icon: Users },
          { label: 'Available Bikes', value: '320', trend: 'neutral', icon: BarChart3 },
          { label: 'Utilization Rate', value: '78%', trend: 'up', icon: TrendingUp },
          { label: 'Coverage Area', value: '85%', trend: 'up', icon: PieChart }
        ],
        insights: {
          primary: 'Bike station utilization is highest in the city center',
          secondary: 'Station coverage is expanding to suburban areas'
        },
        recommendations: {
          primary: 'Add more stations in high-demand areas',
          secondary: 'Improve bike availability during peak hours'
        },
        overallScore: {
          score: 82,
          label: 'Excellent Coverage'
        }
      };

    case 'network':
      return {
        stats: [
          { label: 'Network Length', value: `${formatDistance(city.cyclingNetwork)} km`, trend: 'up', icon: BarChart3 },
          { label: 'Connectivity Score', value: '78%', trend: 'up', icon: Target },
          { label: 'Planned Extensions', value: `${formatDistance(12)} km`, trend: 'up', icon: TrendingUp },
          { label: 'Network Density', value: '2.3 km/km²', trend: 'neutral', icon: Activity }
        ],
        insights: {
          primary: 'Network connectivity is strongest in residential areas',
          secondary: 'Planned extensions will improve connectivity by 20%'
        },
        recommendations: {
          primary: 'Prioritize connections to underserved neighborhoods',
          secondary: 'Enhance safety features on existing routes'
        },
        overallScore: {
          score: 75,
          label: 'Good Network'
        }
      };

    case 'topography':
      return {
        stats: [
          { label: 'Average Elevation', value: '650 m', trend: 'neutral', icon: BarChart3 },
          { label: 'Max Gradient', value: '8%', trend: 'neutral', icon: TrendingUp },
          { label: 'Difficulty Level', value: 'Moderate', trend: 'neutral', icon: Target },
          { label: 'Flat Routes', value: '65%', trend: 'up', icon: PieChart }
        ],
        insights: {
          primary: 'Most cycling routes follow natural terrain contours',
          secondary: 'Elevation changes create natural cycling corridors'
        },
        recommendations: {
          primary: 'Develop more flat routes for accessibility',
          secondary: 'Install bike-friendly infrastructure on steep sections'
        },
        overallScore: {
          score: 70,
          label: 'Moderate Terrain'
        }
      };

    case 'usage':
      return {
        stats: [
          { label: 'Daily Riders', value: '12,500', trend: 'up', icon: Users },
          { label: 'Peak Usage Time', value: '6-8 PM', trend: 'neutral', icon: Clock },
          { label: 'Growth Rate', value: '15%', trend: 'up', icon: TrendingUp },
          { label: 'User Satisfaction', value: '4.2/5', trend: 'up', icon: Target }
        ],
        insights: {
          primary: 'Cycling adoption has increased 15% year-over-year',
          secondary: 'Peak usage occurs during evening commute hours'
        },
        recommendations: {
          primary: 'Expand infrastructure to accommodate growing demand',
          secondary: 'Develop incentive programs to encourage cycling'
        },
        overallScore: {
          score: 85,
          label: 'High Adoption'
        }
      };

    case 'demographics':
      return {
        stats: [
          { label: 'Population Density', value: `${formatPopulation(5200)}/km²`, trend: 'neutral', icon: Users },
          { label: 'Age Distribution', value: '25-45', trend: 'neutral', icon: BarChart3 },
          { label: 'Car Ownership', value: '65%', trend: 'down', icon: TrendingDown },
          { label: 'Cycling Adoption', value: '23%', trend: 'up', icon: TrendingUp }
        ],
        insights: {
          primary: 'Young professionals (25-45) are the primary users',
          secondary: 'Car ownership correlates inversely with cycling adoption'
        },
        recommendations: {
          primary: 'Target marketing to increase adoption in all age groups',
          secondary: 'Create age-specific cycling programs and facilities'
        },
        overallScore: {
          score: 68,
          label: 'Growing Interest'
        }
      };

    default:
      return {
        stats: [],
        insights: {
          primary: '',
          secondary: ''
        },
        recommendations: {
          primary: '',
          secondary: ''
        },
        overallScore: {
          score: 0,
          label: 'No Data'
        }
      };
  }
};

export const getTrendColor = (trend: string): string => {
  switch (trend) {
    case 'up': return 'text-[var(--green)]';
    case 'down': return 'text-[var(--red)]';
    default: return 'text-[var(--blue)]';
  }
};

export const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'up': return TrendingUp;
    case 'down': return TrendingDown;
    default: return Activity;
  }
}; 