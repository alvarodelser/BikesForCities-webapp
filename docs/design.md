# BikesForCities Frontend Design Document

## 1. Executive Summary

### 1.1 Project Overview
The BikesForCities frontend is a React-based Single Page Application (SPA) designed to visualize and analyze bike-sharing trip data and urban cycling infrastructure. The application provides interactive maps, statistical dashboards, and data exploration tools for city planning and mobility optimization.

### 1.2 Mission Statement
Create an intuitive, responsive web interface that enables users to explore bike network data, analyze trip patterns, and gain insights into urban cycling infrastructure for informed city planning decisions.

### 1.3 Target Users
- **Urban Planners**: Analyze bike infrastructure and trip patterns
- **Transportation Researchers**: Study mobility patterns and network efficiency
- **City Officials**: Make data-driven decisions about bike infrastructure
- **General Public**: Explore cycling data in their cities

---

## 2. System Architecture

### 2.1 High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SPA     │    │   FastAPI       │    │  PostgreSQL     │
│   Frontend      │◄──►│   Backend       │◄──►│  + PostGIS      │
│   (Port 3000)   │    │   (Port 8000)   │    │  (Port 5432)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
    Web Browser            REST API              Spatial Database
```

### 2.2 Frontend Architecture Pattern
- **Component-Based Architecture**: Modular, reusable UI components
- **Container/Presentational Pattern**: Separation of logic and presentation
- **Custom Hooks**: Shared stateful logic across components
- **Context API**: Global state for theme and user preferences

### 2.3 Technology Stack

#### Core Framework
- **React 18+**: Latest React with concurrent features
- **TypeScript 5+**: Type-safe development
- **Vite**: Fast build tool and development server

#### UI Framework & Styling
- **Material-UI (MUI) v5**: Component library with design system
- **Emotion**: CSS-in-JS for component styling
- **React Icons**: Consistent iconography

#### Data Visualization
- **React-Leaflet**: Interactive maps with OpenStreetMap
- **Chart.js + react-chartjs-2**: Statistical charts and graphs
- **D3.js**: Advanced custom visualizations (if needed)

#### State Management
- **React Query (TanStack Query)**: Server state management
- **useState/useReducer**: Local component state
- **Context API**: Global application state

#### Development Tools
- **ESLint**: Code linting and quality
- **Prettier**: Code formatting
- **Husky**: Git hooks for code quality

---

## 3. Application Structure

### 3.1 Directory Structure
```
src/
├── components/              # Reusable UI components
│   ├── common/             # Generic components (Button, Card, etc.)
│   ├── layout/             # Layout components (Header, Sidebar, etc.)
│   ├── maps/               # Map-related components
│   ├── charts/             # Chart and visualization components
│   └── forms/              # Form components
├── pages/                  # Main application pages
│   ├── Dashboard/          # Dashboard page
│   ├── NetworkView/        # Network visualization page
│   ├── Statistics/         # Statistics and analytics page
│   └── About/              # About page
├── hooks/                  # Custom React hooks
│   ├── useNetworks.ts      # Network data hooks
│   ├── useMap.ts           # Map interaction hooks
│   └── useCharts.ts        # Chart data hooks
├── services/               # API and external services
│   ├── api.ts              # API client configuration
│   ├── networks.ts         # Network API calls
│   ├── features.ts         # OSM features API calls
│   └── routes.ts           # Trip routes API calls
├── utils/                  # Utility functions
│   ├── constants.ts        # Application constants
│   ├── helpers.ts          # Helper functions
│   └── types.ts            # TypeScript type definitions
├── context/                # React context providers
│   ├── ThemeContext.tsx    # Theme management
│   └── AppContext.tsx      # Global application state
├── styles/                 # Global styles and themes
│   ├── theme.ts            # MUI theme configuration
│   └── global.css          # Global CSS styles
├── types/                  # TypeScript type definitions
│   ├── api.ts              # API response types
│   ├── network.ts          # Network data types
│   └── common.ts           # Common type definitions
├── App.tsx                 # Main application component
├── main.tsx                # Application entry point
└── index.html              # HTML template
```

### 3.2 Component Hierarchy
```
App
├── ThemeProvider
├── QueryClient
├── Router
│   ├── Layout
│   │   ├── Header
│   │   ├── Navigation
│   │   └── Main Content
│   ├── Dashboard
│   │   ├── NetworkOverview
│   │   ├── QuickStats
│   │   └── RecentActivity
│   ├── NetworkView
│   │   ├── MapContainer
│   │   ├── LayerControls
│   │   ├── NetworkStats
│   │   └── FeaturePanel
│   └── Statistics
│       ├── ChartContainer
│       ├── FilterPanel
│       └── DataTable
```

---

## 4. Core Features & Requirements

### 4.1 Essential Features

#### 4.1.1 Network Visualization
**Requirements:**
- Display bike networks on interactive maps
- Support multiple map layers (network, features, routes)
- Provide layer toggle controls
- Show network statistics and metadata
- Support geographic filtering and search

**Implementation:**
- React-Leaflet with OpenStreetMap tiles
- Custom map controls for layer management
- GeoJSON rendering for network data
- Popup components for feature information

#### 4.1.2 Dashboard Overview
**Requirements:**
- Display key metrics and statistics
- Show network comparison charts
- Provide quick access to main features
- Display recent activity or updates

**Implementation:**
- Card-based layout with key metrics
- Chart.js for statistical visualizations
- Responsive grid layout
- Real-time data updates

#### 4.1.3 Statistics & Analytics
**Requirements:**
- Comprehensive network statistics
- Trip pattern analysis
- Infrastructure coverage metrics
- Export capabilities for data

**Implementation:**
- Multiple chart types (bar, line, pie)
- Interactive filtering and drill-down
- Data export functionality
- Responsive chart layouts

### 4.2 Advanced Features

#### 4.2.1 Geographic Search
**Requirements:**
- Location-based search with autocomplete
- Bounding box filtering
- Network selection by geographic area

**Implementation:**
- Geocoding service integration
- Search suggestions and autocomplete
- Map-based area selection

#### 4.2.2 Data Export
**Requirements:**
- Export network data as GeoJSON
- Download statistics as CSV/JSON
- Save map views as images

**Implementation:**
- File download utilities
- Canvas-based map export
- Data formatting helpers

---

## 5. User Interface Design

### 5.1 Design System

#### 5.1.1 Color Palette
```typescript
const colors = {
  primary: {
    main: '#1976d2',
    light: '#42a5f5',
    dark: '#1565c0'
  },
  secondary: {
    main: '#dc004e',
    light: '#ff5983',
    dark: '#9a0036'
  },
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  info: '#0288d1',
  grey: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121'
  }
}
```

#### 5.1.2 Typography
```typescript
const typography = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  h1: { fontSize: '2.5rem', fontWeight: 300 },
  h2: { fontSize: '2rem', fontWeight: 300 },
  h3: { fontSize: '1.75rem', fontWeight: 400 },
  h4: { fontSize: '1.5rem', fontWeight: 400 },
  h5: { fontSize: '1.25rem', fontWeight: 400 },
  h6: { fontSize: '1rem', fontWeight: 500 },
  body1: { fontSize: '1rem', lineHeight: 1.5 },
  body2: { fontSize: '0.875rem', lineHeight: 1.43 }
}
```

#### 5.1.3 Spacing System
```typescript
const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  xxl: '3rem'       // 48px
}
```

### 5.2 Responsive Design

#### 5.2.1 Breakpoints
```typescript
const breakpoints = {
  xs: 0,      // Extra small devices (phones)
  sm: 600,    // Small devices (tablets)
  md: 900,    // Medium devices (small laptops)
  lg: 1200,   // Large devices (desktops)
  xl: 1536    // Extra large devices (large desktops)
}
```

#### 5.2.2 Layout Adaptations
- **Mobile (< 600px)**: Single column layout, collapsible navigation
- **Tablet (600px - 900px)**: Two-column layout, simplified controls
- **Desktop (> 900px)**: Multi-column layout, full feature set

### 5.3 Component Design

#### 5.3.1 Map Components
```typescript
interface MapContainerProps {
  center: [number, number];
  zoom: number;
  layers: LayerConfig[];
  onLayerToggle: (layerId: string, visible: boolean) => void;
  onMapClick: (latlng: [number, number]) => void;
}
```

#### 5.3.2 Chart Components
```typescript
interface ChartContainerProps {
  data: ChartData;
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  options?: ChartOptions;
  height?: number;
  responsive?: boolean;
}
```

---

## 6. Data Management

### 6.1 API Integration

#### 6.1.1 API Client Configuration
```typescript
// services/api.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication (if needed)
apiClient.interceptors.request.use((config) => {
  // Add auth headers if needed
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Global error handling
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
```

#### 6.1.2 Network Data Service
```typescript
// services/networks.ts
export const networkService = {
  // Get all networks
  getNetworks: () => apiClient.get('/api/networks'),
  
  // Get network details
  getNetwork: (id: number) => apiClient.get(`/api/networks/${id}`),
  
  // Get network statistics
  getNetworkStats: (id: number) => apiClient.get(`/api/networks/${id}/stats`),
  
  // Get network nodes with pagination and filtering
  getNetworkNodes: (id: number, params: NodeQueryParams) => 
    apiClient.get(`/api/networks/${id}/nodes`, { params }),
  
  // Get network edges with filtering
  getNetworkEdges: (id: number, params: EdgeQueryParams) => 
    apiClient.get(`/api/networks/${id}/edges`, { params }),
  
  // Get network routes
  getNetworkRoutes: (id: number, params: RouteQueryParams) => 
    apiClient.get(`/api/networks/${id}/routes`, { params }),
  
  // Get OSM features
  getNetworkFeatures: (id: number, params: FeatureQueryParams) => 
    apiClient.get(`/api/networks/${id}/features`, { params }),
  
  // Get features as GeoJSON
  getFeaturesGeoJSON: (id: number, params: GeoJSONParams) => 
    apiClient.get(`/api/networks/${id}/features/geojson`, { params }),
};
```

### 6.2 State Management

#### 6.2.1 React Query Configuration
```typescript
// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* App components */}
    </QueryClientProvider>
  );
}
```

#### 6.2.2 Custom Hooks
```typescript
// hooks/useNetworks.ts
import { useQuery } from '@tanstack/react-query';
import { networkService } from '../services/networks';

export const useNetworks = () => {
  return useQuery({
    queryKey: ['networks'],
    queryFn: () => networkService.getNetworks(),
  });
};

export const useNetwork = (id: number) => {
  return useQuery({
    queryKey: ['network', id],
    queryFn: () => networkService.getNetwork(id),
    enabled: !!id,
  });
};

export const useNetworkStats = (id: number) => {
  return useQuery({
    queryKey: ['network-stats', id],
    queryFn: () => networkService.getNetworkStats(id),
    enabled: !!id,
  });
};
```

### 6.3 Data Types

#### 6.3.1 API Response Types
```typescript
// types/api.ts
export interface NetworkResponse {
  id: number;
  name: string;
  description?: string;
  center_lat?: number;
  center_lon?: number;
  radius?: number;
  created_at?: string;
}

export interface NetworkStats {
  network_id: number;
  network_name: string;
  nodes_count: number;
  edges_count: number;
  routes_count: number;
  features_count: number;
  bounds?: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
  };
}

export interface NodeResponse {
  id: number;
  lat: number;
  lon: number;
  street_count: number;
}

export interface EdgeResponse {
  id: number;
  osmid?: number;
  u: number; // from node
  v: number; // to node
  highway?: string;
  name?: string;
  length?: number;
  maxspeed?: number[];
  lanes?: number[];
  geometry?: string; // WKT format
}

export interface FeatureResponse {
  id: number;
  feature_type: string;
  geometry: string; // WKT format
  tags?: Record<string, any>;
}
```

---

## 7. Routing & Navigation

### 7.1 Route Structure
```typescript
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const AppRoutes = () => (
  <BrowserRouter>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/network/:id" element={<NetworkView />} />
        <Route path="/network/:id/stats" element={<NetworkStats />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  </BrowserRouter>
);
```

### 7.2 Navigation Components
```typescript
// components/layout/Navigation.tsx
interface NavigationProps {
  networks: NetworkResponse[];
  currentNetwork?: number;
}

const Navigation: React.FC<NavigationProps> = ({ networks, currentNetwork }) => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          BikesForCities
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button color="inherit" component={Link} to="/">
            Dashboard
          </Button>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={currentNetwork || ''}
              onChange={(e) => navigate(`/network/${e.target.value}`)}
              displayEmpty
            >
              <MenuItem value="">
                <em>Select Network</em>
              </MenuItem>
              {networks.map((network) => (
                <MenuItem key={network.id} value={network.id}>
                  {network.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button color="inherit" component={Link} to="/statistics">
            Statistics
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
```

---

## 8. Performance Optimization

### 8.1 Code Splitting
```typescript
// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NetworkView = lazy(() => import('./pages/NetworkView'));
const Statistics = lazy(() => import('./pages/Statistics'));

// Suspense wrapper
<Suspense fallback={<CircularProgress />}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/network/:id" element={<NetworkView />} />
    <Route path="/statistics" element={<Statistics />} />
  </Routes>
</Suspense>
```

### 8.2 Data Optimization
- **Pagination**: Implement pagination for large datasets
- **Virtualization**: Use virtual scrolling for large lists
- **Caching**: React Query for intelligent caching
- **Debouncing**: Debounce search and filter inputs

### 8.3 Bundle Optimization
- **Tree Shaking**: Remove unused code
- **Dynamic Imports**: Load heavy libraries on demand
- **Image Optimization**: Compress and lazy load images
- **CDN**: Use CDN for static assets

---

## 9. Testing Strategy

### 9.1 Testing Pyramid
```
    /\
   /  \     E2E Tests (Cypress)
  /____\    
 /      \   Integration Tests (React Testing Library)
/________\  Unit Tests (Jest)
```

### 9.2 Test Categories

#### 9.2.1 Unit Tests
- Component rendering
- Utility functions
- Custom hooks
- API service functions

#### 9.2.2 Integration Tests
- Component interactions
- Form submissions
- API integration
- State management

#### 9.2.3 E2E Tests
- User workflows
- Critical paths
- Cross-browser compatibility

### 9.3 Testing Tools
- **Jest**: Unit testing framework
- **React Testing Library**: Component testing
- **Cypress**: E2E testing
- **MSW**: API mocking

---

## 10. Deployment & DevOps

### 10.1 Build Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@mui/material', '@mui/icons-material'],
          maps: ['react-leaflet', 'leaflet'],
          charts: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

### 10.2 Environment Configuration
```bash
# .env.development
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENV=development
REACT_APP_VERSION=$npm_package_version

# .env.production
REACT_APP_API_URL=https://api.bikesforcities.com
REACT_APP_ENV=production
REACT_APP_VERSION=$npm_package_version
```

### 10.3 Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 10.4 CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy Frontend

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - name: Deploy to production
        # Deployment steps
```

---

## 11. Security Considerations

### 11.1 Frontend Security
- **Input Validation**: Client-side validation for forms
- **XSS Prevention**: Sanitize user inputs
- **CSP Headers**: Content Security Policy
- **HTTPS**: Secure communication

### 11.2 API Security
- **CORS Configuration**: Proper CORS setup
- **Rate Limiting**: API rate limiting
- **Input Sanitization**: Server-side validation
- **Error Handling**: Secure error messages

---

## 12. Accessibility (a11y)

### 12.1 WCAG Compliance
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: ARIA labels and roles
- **Color Contrast**: WCAG AA compliance
- **Focus Management**: Proper focus indicators

### 12.2 Implementation
```typescript
// Accessible components
<Button
  aria-label="Toggle map layer"
  onClick={handleToggle}
  onKeyDown={handleKeyDown}
>
  <VisibilityIcon />
</Button>

// Skip links
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
```

---

## 13. Internationalization (i18n)

### 13.1 Multi-language Support
```typescript
// i18n configuration
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    es: { translation: esTranslations },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
```

### 13.2 Translation Structure
```typescript
// locales/en.json
{
  "common": {
    "loading": "Loading...",
    "error": "Error",
    "save": "Save",
    "cancel": "Cancel"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "networks": "Networks",
    "statistics": "Statistics"
  },
  "maps": {
    "layers": "Layers",
    "toggleLayer": "Toggle layer",
    "zoomIn": "Zoom in",
    "zoomOut": "Zoom out"
  }
}
```

---

## 14. Monitoring & Analytics

### 14.1 Error Tracking
- **Error Boundaries**: React error boundaries
- **Logging Service**: Error logging and monitoring
- **Performance Monitoring**: Core Web Vitals tracking

### 14.2 Analytics
- **User Behavior**: Page views and interactions
- **Performance Metrics**: Load times and responsiveness
- **Feature Usage**: Most used features and workflows

---

## 15. Future Enhancements

### 15.1 Planned Features
- **Real-time Updates**: WebSocket integration for live data
- **Advanced Filtering**: Complex query builders
- **Data Export**: Advanced export options
- **User Preferences**: Customizable dashboards

### 15.2 Technical Improvements
- **PWA Support**: Progressive Web App features
- **Offline Mode**: Service worker for offline functionality
- **Advanced Caching**: Intelligent data caching strategies
- **Performance Optimization**: Further performance improvements

---

## 16. Development Guidelines

### 16.1 Code Standards
- **TypeScript**: Strict TypeScript configuration
- **ESLint**: Comprehensive linting rules
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Standardized commit messages

### 16.2 Component Guidelines
- **Single Responsibility**: One component, one purpose
- **Props Interface**: Clear prop definitions
- **Default Props**: Sensible defaults
- **Error Handling**: Graceful error states

### 16.3 State Management Rules
- **Local First**: Use local state when possible
- **Server State**: React Query for server data
- **Global State**: Context API for app-wide state
- **Derived State**: Compute from existing state

---

## 17. Conclusion

This design document provides a comprehensive blueprint for the BikesForCities frontend implementation. The architecture emphasizes:

- **Modularity**: Component-based architecture for maintainability
- **Performance**: Optimized data loading and rendering
- **Accessibility**: WCAG-compliant user interface
- **Scalability**: Extensible design for future features
- **User Experience**: Intuitive and responsive interface

The implementation follows modern React best practices and leverages the existing backend API to create a powerful visualization platform for bike-sharing data analysis.

---

## Appendix A: API Endpoints Reference

### Network Endpoints
- `GET /api/networks` - List all networks
- `GET /api/networks/{id}` - Get network details
- `GET /api/networks/{id}/stats` - Get network statistics
- `GET /api/networks/{id}/nodes` - Get network nodes
- `GET /api/networks/{id}/edges` - Get network edges
- `GET /api/networks/{id}/routes` - Get network routes
- `GET /api/networks/{id}/features` - Get OSM features
- `GET /api/networks/{id}/features/geojson` - Get features as GeoJSON

### Health & Info Endpoints
- `GET /api/health` - Health check
- `GET /api/health/detailed` - Detailed health check
- `GET /api/info` - API information

---

## Appendix B: Environment Variables

### Required Environment Variables
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_ENV`: Environment (development/production)
- `REACT_APP_VERSION`: Application version

### Optional Environment Variables
- `REACT_APP_ANALYTICS_ID`: Analytics tracking ID
- `REACT_APP_SENTRY_DSN`: Error tracking DSN
- `REACT_APP_MAP_TILES_URL`: Custom map tiles URL

---

## Appendix C: Performance Benchmarks

### Target Performance Metrics
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms
- **Time to Interactive**: < 3.5s

### Optimization Targets
- **Bundle Size**: < 500KB (gzipped)
- **Map Load Time**: < 2s
- **Chart Render Time**: < 1s
- **API Response Time**: < 500ms 