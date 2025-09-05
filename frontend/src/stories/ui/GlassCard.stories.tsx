import type { Meta, StoryObj } from '@storybook/react';
import { GlassCard } from '../../components/ui/GlassCard';
import { 
  Users, 
  Euro, 
  Bike, 
  Percent, 
  FileText, 
  Map, 
  CircuitBoard,
  Home,
  MapPin,
  Clock,
  BarChart3,
  Route,
  Navigation,
  Car,
  Zap,
  Settings,
  User,
  Bell
} from 'lucide-react';

const meta: Meta<typeof GlassCard> = {
  title: 'UI/GlassCard',
  component: GlassCard,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark-green',
      values: [
        { name: 'dark-green', value: '#027A76' },
        { name: 'cream', value: '#FBF6EF' },
        { name: 'white', value: '#FFFFFF' },
        { name: 'dark', value: '#333333' }
      ]
    }
  },
  decorators: [
    (Story) => (
      <div style={{
        '--green-light': '#BFDDCE',
        '--green': '#7BA492',
        '--green-dark': '#027A76',
        '--blue-light': '#92BEC9',
        '--blue': '#3A6C7F',
        '--blue-dark': '#003849',
        '--yellow': '#F4A24C',
        '--orange': '#FF7F50',
        '--red': '#AF4749',
        '--cream': '#FBF6EF',
        '--cream-dark': '#F9E9DC',
        '--white': '#FFFFFF',
        '--black': '#1E1E1E'
      } as React.CSSProperties}>
        <Story />
      </div>
    )
  ],
  tags: ['autodocs'],
  argTypes: {
    surface: {
      control: 'select',
      options: ['glass', 'inset'],
      description: 'Visual surface variant'
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Padding scale'
    },
    // Glass-specific
    interactive: {
      control: 'boolean',
      description: 'Enable hover/click interactions (glass only)',
      if: { arg: 'surface', eq: 'glass' }
    },
    tint: {
      control: 'color',
      description: 'Background tint color (glass only)',
      if: { arg: 'surface', eq: 'glass' }
    },
    blurStrength: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Backdrop blur intensity (glass only)',
      if: { arg: 'surface', eq: 'glass' }
    },
    shadow: {
      control: 'select',
      options: ['none', 'sm', 'lg'],
      description: 'Outer shadow intensity (glass only)',
      if: { arg: 'surface', eq: 'glass' }
    },
    // Inset-specific
    depth: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Inner shadow depth (inset only)',
      if: { arg: 'surface', eq: 'inset' }
    }
  }
};

export default meta;
type Story = StoryObj<typeof GlassCard>;

// Interactive Default Component
export const Interactive: Story = {
  args: {
    surface: 'glass',
    size: 'md',
    interactive: true,
    blurStrength: 'md',
    shadow: 'sm'
  },
  render: (args) => (
    <div className="w-[400px]">
      <GlassCard {...args}>
        <div className="flex items-center">
          <Home className="mr-4 w-8 h-8 text-black" />
          <div>
            <h3 className="text-lg font-semibold text-black">Interactive GlassCard</h3>
            <p className="text-sm text-black/80">Customize surface, size, and more!</p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
};

// Comprehensive Customization Showcase
export const CustomizationShowcase: Story = {
  render: () => (
    <div className="space-y-8 max-w-6xl mx-auto p-6">
      {/* Surface Variants Row */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-black">Surface Variants</h2>
        <div className="grid grid-cols-2 gap-6">
          <GlassCard surface="glass" className="p-6">
            <div className="flex items-center">
              <CircuitBoard className="mr-4 w-8 h-8 text-black" />
              <span className="text-black">Glass Surface</span>
            </div>
          </GlassCard>
          <GlassCard surface="inset" className="p-6">
            <div className="flex items-center">
              <MapPin className="mr-4 w-8 h-8 text-black/70" />
              <span className="text-black/70">Inset Surface</span>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Sizes Row */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-black">Sizes</h2>
        <div className="grid grid-cols-3 gap-6">
          <GlassCard surface="glass" size="sm" className="p-3">
            <Clock className="mr-3 w-6 h-6 text-black" />
            <span className="text-black text-sm">Small</span>
          </GlassCard>
          <GlassCard surface="glass" size="md" className="p-4">
            <Clock className="mr-4 w-7 h-7 text-black" />
            <span className="text-black">Medium</span>
          </GlassCard>
          <GlassCard surface="glass" size="lg" className="p-6">
            <Clock className="mr-4 w-8 h-8 text-black" />
            <span className="text-black text-lg">Large</span>
          </GlassCard>
        </div>
      </div>

      {/* Glass Customizations */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-black">Glass Customizations</h2>
        <div className="space-y-6">
          {/* Tints */}
          <div>
            <h3 className="text-lg font-medium mb-3 text-black/80">Custom Tints</h3>
            <div className="grid grid-cols-4 gap-4">
              <GlassCard surface="glass" tint="rgba(123, 164, 146, 0.3)" className="p-4">
                <div className="text-center">
                  <div className="w-8 h-8 bg-[var(--green)] rounded-full mx-auto mb-2" />
                  <span className="text-black text-sm">Green Tint</span>
                </div>
              </GlassCard>
              <GlassCard surface="glass" tint="rgba(58, 108, 127, 0.3)" className="p-4">
                <div className="text-center">
                  <div className="w-8 h-8 bg-[var(--blue)] rounded-full mx-auto mb-2" />
                  <span className="text-black text-sm">Blue Tint</span>
                </div>
              </GlassCard>
              <GlassCard surface="glass" tint="rgba(244, 162, 76, 0.3)" className="p-4">
                <div className="text-center">
                  <div className="w-8 h-8 bg-[var(--yellow)] rounded-full mx-auto mb-2" />
                  <span className="text-black text-sm">Yellow Tint</span>
                </div>
              </GlassCard>
              <GlassCard surface="glass" tint="rgba(255, 255, 255, 0.3)" className="p-4">
                <div className="text-center">
                  <div className="w-8 h-8 bg-gray-400 rounded-full mx-auto mb-2" />
                  <span className="text-black text-sm">White Tint</span>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Blur Strengths */}
          <div>
            <h3 className="text-lg font-medium mb-3 text-black/80">Blur Strengths</h3>
            <div className="grid grid-cols-3 gap-4">
              <GlassCard surface="glass" blurStrength="sm" className="p-4">
                <div className="text-center">
                  <BarChart3 className="w-6 h-6 text-black mx-auto mb-2" />
                  <p className="text-black text-sm">Small Blur</p>
                </div>
              </GlassCard>
              <GlassCard surface="glass" blurStrength="md" className="p-4">
                <div className="text-center">
                  <BarChart3 className="w-6 h-6 text-black mx-auto mb-2" />
                  <p className="text-black text-sm">Medium Blur</p>
                </div>
              </GlassCard>
              <GlassCard surface="glass" blurStrength="lg" className="p-4">
                <div className="text-center">
                  <BarChart3 className="w-6 h-6 text-black mx-auto mb-2" />
                  <p className="text-black text-sm">Large Blur</p>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Shadow Variants */}
          <div>
            <h3 className="text-lg font-medium mb-3 text-black/80">Shadow Variants</h3>
            <div className="grid grid-cols-3 gap-4">
              <GlassCard surface="glass" shadow="none" className="p-4">
                <div className="text-center">
                  <Map className="w-6 h-6 text-black mx-auto mb-2" />
                  <p className="text-black text-sm">No Shadow</p>
                </div>
              </GlassCard>
              <GlassCard surface="glass" shadow="sm" className="p-4">
                <div className="text-center">
                  <Map className="w-6 h-6 text-black mx-auto mb-2" />
                  <p className="text-black text-sm">Small Shadow</p>
                </div>
              </GlassCard>
              <GlassCard surface="glass" shadow="lg" className="p-4">
                <div className="text-center">
                  <Map className="w-6 h-6 text-black mx-auto mb-2" />
                  <p className="text-black text-sm">Large Shadow</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive States Row */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-black">Interactive States</h2>
        <div className="grid grid-cols-2 gap-6">
          <GlassCard surface="glass" interactive={false} className="p-6">
            <div className="flex items-center">
              <CircuitBoard className="mr-4 w-8 h-8 text-black" />
              <span className="text-black">Non-Interactive</span>
            </div>
          </GlassCard>
          <GlassCard surface="glass" interactive className="p-6">
            <div className="flex items-center">
              <CircuitBoard className="mr-4 w-8 h-8 text-black" />
              <span className="text-black">Interactive - Hover me!</span>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Inset Depths */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-black">Inset Depths</h2>
        <div className="grid grid-cols-3 gap-4">
          <GlassCard surface="inset" depth="sm" className="p-4 text-center">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-black/70" />
            <p className="font-semibold text-black/70">Small Depth</p>
          </GlassCard>
          
          <GlassCard surface="inset" depth="md" className="p-4 text-center">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-black/70" />
            <p className="font-semibold text-black/70">Medium Depth</p>
          </GlassCard>
          
          <GlassCard surface="inset" depth="lg" className="p-4 text-center">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-black/70" />
            <p className="font-semibold text-black/70">Large Depth</p>
          </GlassCard>
        </div>
      </div>
    </div>
  )
};

// App Components - Real Usage Examples
export const AppComponents: Story = {
  render: () => (
    <div className="space-y-12 max-w-6xl mx-auto p-6">
      {/* HeroSection.tsx Usage - Feature Cards */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-black">Feature Cards (HeroSection Style)</h2>
        <div className="grid grid-cols-3 gap-6">
          <GlassCard 
            surface="glass"
            interactive
            tint="rgba(255, 255, 255, 0.1)"
            className="p-6 cursor-pointer"
          >
            <div className="w-12 h-12 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white/35 shadow-lg mb-4">
              <CircuitBoard className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
            <span className="text-lg font-medium text-black drop-shadow-md">
              Compara nuestras ciudades
            </span>
          </GlassCard>
          
          <GlassCard 
            surface="glass"
            interactive
            tint="rgba(255, 255, 255, 0.1)"
            className="p-6 cursor-pointer"
          >
            <div className="w-12 h-12 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white/35 shadow-lg mb-4">
              <Map className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
            <span className="text-lg font-medium text-black drop-shadow-md">
              Explora mapas de tráfico ciclista
            </span>
          </GlassCard>
          
          <GlassCard 
            surface="glass"
            interactive
            tint="rgba(255, 255, 255, 0.1)"
            className="p-6 cursor-pointer"
          >
            <div className="w-12 h-12 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white/35 shadow-lg mb-4">
              <FileText className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
            <span className="text-lg font-medium text-black drop-shadow-md">
              Planifica con visión de futuro
            </span>
          </GlassCard>
        </div>
      </div>

      {/* OverviewSection.tsx Usage - Stats Cards */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-black">Stats Cards (OverviewSection Style)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <GlassCard
            surface="glass"
            interactive
            tint="rgba(255, 255, 255, 0.1)"
            className="p-6 group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-black">Population</h3>
            </div>
            <p className="text-3xl font-bold text-black">3.2M</p>
          </GlassCard>

          <GlassCard
            surface="glass"
            interactive
            tint="rgba(255, 255, 255, 0.1)"
            className="p-6 group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--yellow)] to-[var(--orange)] rounded-full flex items-center justify-center shadow-lg">
                <Euro className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-black">Budget</h3>
            </div>
            <p className="text-3xl font-bold text-black">85M€</p>
          </GlassCard>

          <GlassCard
            surface="glass"
            interactive
            tint="rgba(255, 255, 255, 0.1)"
            className="p-6 group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center shadow-lg">
                <Bike className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-black">Cycling Network</h3>
            </div>
            <p className="text-3xl font-bold text-black">560km</p>
          </GlassCard>

          <GlassCard
            surface="glass"
            interactive
            tint="rgba(255, 255, 255, 0.1)"
            className="p-6 group"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--yellow)] to-[var(--orange)] rounded-full flex items-center justify-center shadow-lg">
                <Percent className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-black">Coverage</h3>
            </div>
            <p className="text-3xl font-bold text-black">78%</p>
          </GlassCard>
        </div>
      </div>

      {/* CityCard.tsx Usage - Nested Cards Structure */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-black">Nested Cards Structure (CityCard Style)</h2>
        <div className="max-w-[300px]">
          <GlassCard 
            surface="glass"
            interactive
            tint="rgba(255, 255, 255, 0.15)"
            className="w-[300px] h-[400px] p-6 flex flex-col"
          >
            <h2 className="font-bold text-black text-center drop-shadow-lg mb-6 text-2xl">
              Madrid
            </h2>
            
            <div className="grid grid-rows-2 grid-cols-2 gap-4 flex-1 mb-6">
              <GlassCard surface="inset" className="p-4 text-center h-[80px]">
                <h3 className="font-semibold text-black/95 mb-2 drop-shadow-lg text-sm">
                  Población
                </h3>
                <p className="font-bold text-black drop-shadow-lg text-lg">
                  3.2M
                </p>
              </GlassCard>

              <GlassCard surface="inset" className="p-4 text-center h-[80px]">
                <h3 className="font-semibold text-black/95 mb-2 drop-shadow-lg text-sm">
                  Presupuesto
                </h3>
                <p className="font-bold text-black drop-shadow-lg text-lg">
                  85M€
                </p>
              </GlassCard>
              
              <GlassCard surface="inset" className="p-4 text-center h-[80px]">
                <h3 className="font-semibold text-black/95 mb-2 drop-shadow-lg text-sm">
                  Red Ciclista
                </h3>
                <p className="font-bold text-black drop-shadow-lg text-lg">
                  560km
                </p>
              </GlassCard>

              <GlassCard surface="inset" className="p-4 text-center h-[80px]">
                <h3 className="font-semibold text-black/95 mb-2 drop-shadow-lg text-sm">
                  Cobertura
                </h3>
                <p className="font-bold text-black drop-shadow-lg text-lg">
                  78%
                </p>
              </GlassCard>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Settings Panel Usage */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-black">Settings Panel</h2>
        <div className="max-w-md">
          <GlassCard surface="glass" tint="rgba(255, 255, 255, 0.1)" className="p-6">
            <h3 className="text-lg font-semibold text-black mb-4">User Preferences</h3>
            <div className="space-y-3">
              <GlassCard surface="inset" size="sm">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-black/70" />
                  <span className="text-black/70 text-sm">Profile Settings</span>
                </div>
              </GlassCard>
              
              <GlassCard surface="inset" size="sm">
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-black/70" />
                  <span className="text-black/70 text-sm">Notifications</span>
                </div>
              </GlassCard>
              
              <GlassCard surface="inset" size="sm">
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-black/70" />
                  <span className="text-black/70 text-sm">General Settings</span>
                </div>
              </GlassCard>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
};