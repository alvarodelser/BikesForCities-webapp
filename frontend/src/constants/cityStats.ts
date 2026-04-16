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
import { formatDistance } from '../utils/formatters';

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
    case 'infrastructure':
      return {
        stats: [
          { label: 'Longitud de red', value: `${formatDistance(city.cyclingNetwork)} km`, trend: 'up', icon: BarChart3 },
          { label: 'Puntuación de conectividad', value: '78%', trend: 'up', icon: Target },
          { label: 'Extensiones planificadas', value: `${formatDistance(12)} km`, trend: 'up', icon: TrendingUp },
          { label: 'Densidad de red', value: '2,3 km/km²', trend: 'neutral', icon: Activity }
        ],
        insights: {
          primary: 'La conectividad de la red es mayor en zonas residenciales',
          secondary: 'Las extensiones planificadas mejorarán la conectividad en un 20%'
        },
        recommendations: {
          primary: 'Priorizar conexiones hacia barrios con menor cobertura',
          secondary: 'Mejorar las medidas de seguridad en las rutas existentes'
        },
        overallScore: {
          score: 75,
          label: 'Buena Red'
        }
      };

    case 'traffic':
      return {
        stats: [
          { label: 'Congestión media', value: 'Media', trend: 'up', icon: Activity },
          { label: 'Horas punta de tráfico', value: '7-9 h', trend: 'neutral', icon: Clock },
          { label: 'Velocidad media', value: '25 km/h', trend: 'down', icon: TrendingDown },
          { label: 'Incidentes de tráfico', value: '12/día', trend: 'down', icon: Target }
        ],
        insights: {
          primary: 'La congestión alcanza su máximo durante las horas punta matinales (7-9 h)',
          secondary: 'La velocidad media ha descendido un 5% por el aumento del ciclismo'
        },
        recommendations: {
          primary: 'Implementar carriles bici para reducir la congestión',
          secondary: 'Optimizar la sincronización semafórica para ciclistas'
        },
        overallScore: {
          score: 78,
          label: 'Buen Desempeño'
        }
      };

    case 'stations':
      return {
        stats: [
          { label: 'Total de estaciones', value: '45', trend: 'up', icon: Users },
          { label: 'Bicis disponibles', value: '320', trend: 'neutral', icon: BarChart3 },
          { label: 'Tasa de uso', value: '78%', trend: 'up', icon: TrendingUp },
          { label: 'Área de cobertura', value: '85%', trend: 'up', icon: PieChart }
        ],
        insights: {
          primary: 'El uso de las estaciones es mayor en el centro de la ciudad',
          secondary: 'La cobertura se está expandiendo hacia zonas periféricas'
        },
        recommendations: {
          primary: 'Añadir más estaciones en zonas de alta demanda',
          secondary: 'Mejorar la disponibilidad de bicis en horas punta'
        },
        overallScore: {
          score: 82,
          label: 'Excelente Cobertura'
        }
      };

    case 'terrain':
      return {
        stats: [
          { label: 'Altitud media', value: '650 m', trend: 'neutral', icon: BarChart3 },
          { label: 'Pendiente máxima', value: '8%', trend: 'neutral', icon: TrendingUp },
          { label: 'Nivel de dificultad', value: 'Moderado', trend: 'neutral', icon: Target },
          { label: 'Rutas llanas', value: '65%', trend: 'up', icon: PieChart }
        ],
        insights: {
          primary: 'La mayoría de rutas ciclistas siguen los contornos naturales del terreno',
          secondary: 'Los cambios de altitud crean corredores ciclistas naturales'
        },
        recommendations: {
          primary: 'Desarrollar más rutas llanas para mayor accesibilidad',
          secondary: 'Instalar infraestructura ciclista adaptada en tramos empinados'
        },
        overallScore: {
          score: 70,
          label: 'Terreno Moderado'
        }
      };

    case 'intersections':
      return {
        stats: [
          { label: 'Total de cruces', value: '1.240', trend: 'neutral', icon: Activity },
          { label: 'Cruces adaptados', value: '68%', trend: 'up', icon: TrendingUp },
          { label: 'Tiempo medio de espera', value: '22 s', trend: 'down', icon: Clock },
          { label: 'Puntos de conflicto', value: '34', trend: 'down', icon: Target }
        ],
        insights: {
          primary: 'El 68% de las intersecciones cuentan con adaptaciones para ciclistas',
          secondary: 'Los tiempos de espera en semáforos han mejorado en zonas céntricas'
        },
        recommendations: {
          primary: 'Priorizar la señalización ciclista en cruces conflictivos',
          secondary: 'Implementar semáforos con fases específicas para bicicletas'
        },
        overallScore: {
          score: 72,
          label: 'Mejora Continua'
        }
      };

    case 'accidents':
      return {
        stats: [
          { label: 'Accidentes anuales', value: '180', trend: 'down', icon: TrendingDown },
          { label: 'Puntos negros', value: '8', trend: 'down', icon: Target },
          { label: 'Accidentes graves', value: '12', trend: 'down', icon: Activity },
          { label: 'Reducción interanual', value: '7%', trend: 'up', icon: TrendingUp }
        ],
        insights: {
          primary: 'La siniestralidad ha disminuido un 7% respecto al año anterior',
          secondary: 'Los puntos negros se concentran en grandes avenidas sin carril bici'
        },
        recommendations: {
          primary: 'Instalar carril bici protegido en los puntos de mayor siniestralidad',
          secondary: 'Ampliar la iluminación nocturna en zonas de riesgo'
        },
        overallScore: {
          score: 65,
          label: 'Requiere Atención'
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
          label: 'Sin datos'
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