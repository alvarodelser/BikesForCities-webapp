import type { Meta, StoryObj } from '@storybook/react';
import { FlatCard } from '../../components/ui/FlatCard';
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
  Bell,
  Search,
  Heart,
  Star,
  TrendingUp,
  Shield,
  Globe
} from 'lucide-react';

const meta: Meta<typeof FlatCard> = {
  title: 'UI/FlatCard',
  component: FlatCard,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f5f5f5' },
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
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Padding scale'
    },
    interactive: {
      control: 'boolean',
      description: 'Enable hover/click interactions'
    },
    shadow: {
      control: 'select',
      options: ['none', 'sm', 'lg'],
      description: 'Outer shadow intensity'
    },
    border: {
      control: 'select',
      options: ['none', 'thin', 'thick'],
      description: 'Border weight'
    },
    borderColor: {
      control: 'color',
      description: 'Base border color'
    },
    hoverBorderColor: {
      control: 'color',
      description: 'Border color on hover'
    },
    activeBorderColor: {
      control: 'color',
      description: 'Border color on active/press'
    },
    color: {
      control: 'color',
      description: 'Solid background color (use either color OR gradient)',
      if: { arg: 'gradient', exists: false }
    },
    gradient: {
      control: 'object',
      description: 'Gradient background (use either gradient OR color)',
      if: { arg: 'color', exists: false }
    }
  }
};

export default meta;
type Story = StoryObj<typeof FlatCard>;

// Interactive Default Component
export const Interactive: Story = {
  args: {
    size: 'md',
    interactive: true,
    shadow: 'sm',
    border: 'thin',
    gradient: {
      from: 'var(--green)',
      to: 'var(--green-dark)',
      direction: 'r'
    }
  },
  render: (args) => (
    <div className="w-[400px]">
      <FlatCard {...args}>
        <div className="flex items-center">
          <Home className="mr-4 w-8 h-8 text-black" />
          <div>
            <h3 className="text-lg font-semibold text-black">Interactive FlatCard</h3>
            <p className="text-sm text-black/80">Customize gradient, hover, and more!</p>
          </div>
        </div>
      </FlatCard>
    </div>
  )
};

// Comprehensive Customization Showcase
export const CustomizationShowcase: Story = {
  render: () => (
    <div className="space-y-8 max-w-6xl mx-auto p-6">
      {/* Sizes Row */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Sizes</h2>
        <div className="grid grid-cols-3 gap-6">
          <FlatCard size="sm" color="var(--blue)">
            <Clock className="mr-3 w-6 h-6 text-black" />
            <span className="text-black text-sm">Small</span>
          </FlatCard>
          <FlatCard size="md" color="var(--blue)">
            <Clock className="mr-4 w-7 h-7 text-black" />
            <span className="text-black">Medium</span>
          </FlatCard>
          <FlatCard size="lg" color="var(--blue)">
            <Clock className="mr-4 w-8 h-8 text-black" />
            <span className="text-black text-lg">Large</span>
          </FlatCard>
        </div>
      </div>

      {/* Background Colors Row */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Background Colors</h2>
        <div className="grid grid-cols-4 gap-4">
          <FlatCard 
            color="rgba(123, 164, 146, 0.8)" 
            interactive 
            className="p-6"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-full mr-4" />
              <span className="text-black">Green</span>
            </div>
          </FlatCard>
          <FlatCard 
            color="rgba(58, 108, 127, 0.8)" 
            interactive 
            className="p-6"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-full mr-4" />
              <span className="text-black">Blue</span>
            </div>
          </FlatCard>
          <FlatCard 
            color="rgba(244, 162, 76, 0.8)" 
            interactive 
            className="p-6"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-full mr-4" />
              <span className="text-black">Yellow</span>
            </div>
          </FlatCard>
          <FlatCard 
            color="rgba(255, 255, 255, 0.9)" 
            interactive 
            className="p-6"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-400 rounded-full mr-4" />
              <span className="text-gray-800">White</span>
            </div>
          </FlatCard>
        </div>
      </div>

      {/* Background Gradients Row */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Background Gradients</h2>
        <div className="grid grid-cols-4 gap-4">
          <FlatCard 
            gradient={{
              from: 'var(--green)',
              to: 'var(--green-dark)',
              direction: 'r'
            }}
            interactive 
            className="p-6"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-full mr-4" />
              <span className="text-black">Green →</span>
            </div>
          </FlatCard>
          <FlatCard 
            gradient={{
              from: 'var(--blue)',
              to: 'var(--blue-dark)',
              direction: 'b'
            }}
            interactive 
            className="p-6"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-full mr-4" />
              <span className="text-black">Blue ↓</span>
            </div>
          </FlatCard>
          <FlatCard 
            gradient={{
              from: 'var(--yellow)',
              to: 'var(--orange)',
              direction: 'tr'
            }}
            interactive 
            className="p-6"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-full mr-4" />
              <span className="text-black">Yellow ↗</span>
            </div>
          </FlatCard>
          <FlatCard 
            gradient={{
              from: 'var(--green)',
              to: 'var(--blue)',
              direction: 'br'
            }}
            interactive 
            className="p-6"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-full mr-4" />
              <span className="text-black">Mixed ↘</span>
            </div>
          </FlatCard>
        </div>
      </div>

      {/* Border Customizations */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Border Customizations</h2>
        <div className="space-y-6">
          {/* Border Weights */}
          <div>
            <h3 className="text-lg font-medium mb-3 text-gray-600">Border Weights</h3>
            <div className="grid grid-cols-3 gap-4">
              <FlatCard color="rgba(255,255,255,0.9)" border="none">
                <p className="text-gray-800 text-center">No Border</p>
              </FlatCard>
              <FlatCard color="rgba(255,255,255,0.9)" border="thin" borderColor="#3b82f6">
                <p className="text-gray-800 text-center">Thin Border</p>
              </FlatCard>
              <FlatCard color="rgba(255,255,255,0.9)" border="thick" borderColor="#3b82f6">
                <p className="text-gray-800 text-center">Thick Border</p>
              </FlatCard>
            </div>
          </div>

          {/* Interactive Borders */}
          <div>
            <h3 className="text-lg font-medium mb-3 text-gray-600">Interactive Borders</h3>
            <div className="grid grid-cols-3 gap-6">
              <FlatCard 
                interactive
                border="thin"
                borderColor="rgba(123, 164, 146, 0.5)" 
                hoverBorderColor="rgba(123, 164, 146, 0.8)"
                className="p-6"
                color="rgba(255,255,255,0.9)"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-[var(--green)] rounded-full mr-4" />
                  <span className="text-gray-800">Green Border</span>
                </div>
              </FlatCard>
              <FlatCard 
                interactive
                border="thin"
                borderColor="rgba(58, 108, 127, 0.5)" 
                hoverBorderColor="rgba(58, 108, 127, 0.8)"
                className="p-6"
                color="rgba(255,255,255,0.9)"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-[var(--blue)] rounded-full mr-4" />
                  <span className="text-gray-800">Blue Border</span>
                </div>
              </FlatCard>
              <FlatCard 
                interactive
                border="thin"
                borderColor="rgba(244, 162, 76, 0.5)" 
                hoverBorderColor="rgba(244, 162, 76, 0.8)"
                className="p-6"
                color="rgba(255,255,255,0.9)"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-[var(--yellow)] rounded-full mr-4" />
                  <span className="text-gray-800">Yellow Border</span>
                </div>
              </FlatCard>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive States Row */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Interactive States</h2>
        <div className="grid grid-cols-2 gap-6">
          <FlatCard interactive={false} color="var(--green)" className="p-6">
            <div className="flex items-center">
              <CircuitBoard className="mr-4 w-8 h-8 text-black" />
              <span className="text-black">Non-Interactive</span>
            </div>
          </FlatCard>
          <FlatCard interactive color="var(--green)" className="p-6">
            <div className="flex items-center">
              <CircuitBoard className="mr-4 w-8 h-8 text-black" />
              <span className="text-black">Interactive - Hover me!</span>
            </div>
          </FlatCard>
        </div>
      </div>

      {/* Shadow Variants */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Shadow Variants</h2>
        <div className="grid grid-cols-3 gap-6">
          <FlatCard color="var(--green)" shadow="none" className="p-6">
            <div className="text-center">
              <Globe className="w-6 h-6 text-black mx-auto mb-2" />
              <p className="text-black">No Shadow</p>
            </div>
          </FlatCard>
          <FlatCard color="var(--green)" shadow="sm" className="p-6">
            <div className="text-center">
              <Globe className="w-6 h-6 text-black mx-auto mb-2" />
              <p className="text-black">Small Shadow</p>
            </div>
          </FlatCard>
          <FlatCard color="var(--green)" shadow="lg" className="p-6">
            <div className="text-center">
              <Globe className="w-6 h-6 text-black mx-auto mb-2" />
              <p className="text-black">Large Shadow</p>
            </div>
          </FlatCard>
        </div>
      </div>
    </div>
  )
};

// App Components - Real Usage Examples
export const AppComponents: Story = {
  render: () => (
    <div className="space-y-12 max-w-6xl mx-auto p-6">
      {/* Stats Dashboard Cards */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Stats Dashboard</h2>
        <div className="grid grid-cols-4 gap-4">
          <FlatCard color="var(--blue)" interactive className="p-4 text-center">
            <p className="text-2xl font-bold text-black">1,234</p>
            <p className="text-black/80 text-sm">Total Routes</p>
          </FlatCard>
          
          <FlatCard color="var(--green)" interactive className="p-4 text-center">
            <p className="text-2xl font-bold text-black">89%</p>
            <p className="text-black/80 text-sm">Coverage</p>
          </FlatCard>
          
          <FlatCard color="var(--yellow)" interactive className="p-4 text-center">
            <p className="text-2xl font-bold text-black">42</p>
            <p className="text-black/80 text-sm">Cities</p>
          </FlatCard>
          
          <FlatCard color="var(--red)" interactive className="p-4 text-center">
            <p className="text-2xl font-bold text-black">156k</p>
            <p className="text-black/80 text-sm">Data Points</p>
          </FlatCard>
        </div>
      </div>

      {/* City Cards */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">City Cards</h2>
        <div className="grid grid-cols-2 gap-6">
          <FlatCard 
            interactive 
            gradient={{ from: 'var(--blue)', to: 'var(--blue-dark)' }}
            className="p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                <Map className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-black">Amsterdam</h3>
                <p className="text-black/80">Netherlands</p>
                <p className="text-black/60 text-sm mt-1">92% bike infrastructure coverage</p>
              </div>
            </div>
          </FlatCard>

          <FlatCard 
            interactive 
            gradient={{ from: 'var(--cream)', to: 'var(--orange)' }}
            className="p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                <Map className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-black">Copenhagen</h3>
                <p className="text-black/80">Denmark</p>
                <p className="text-black/60 text-sm mt-1">87% bike infrastructure coverage</p>
              </div>
            </div>
          </FlatCard>
        </div>
      </div>

      {/* Action Buttons */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Action Buttons</h2>
        <div className="flex gap-4 flex-wrap">
          <FlatCard 
            color="var(--blue)" 
            interactive 
            size="sm"
            border="none"
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-white" />
              <span className="text-black font-medium">Search</span>
            </div>
          </FlatCard>

          <FlatCard 
            gradient={{ from: 'var(--green)', to: 'var(--green-dark)' }}
            interactive 
            size="sm"
            border="none"
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-white" />
              <span className="text-black font-medium">Analyze</span>
            </div>
          </FlatCard>

          <FlatCard 
            color="rgba(255,255,255,0.9)" 
            interactive 
            size="sm"
            border="thin"
            borderColor="#e5e7eb"
            hoverBorderColor="#3b82f6"
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-700" />
              <span className="text-gray-700 font-medium">Settings</span>
            </div>
          </FlatCard>
        </div>
      </div>

      {/* Filter-like Cards (inspired by old filter variant) */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Filter Cards</h2>
        <div className="grid grid-cols-4 gap-4">
          <FlatCard 
            interactive
            color="rgba(123, 164, 146, 0.15)"
            border="thick"
            borderColor="var(--green)"
            hoverBorderColor="var(--green-dark)"
            className="p-4 cursor-pointer"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center shadow-lg"
                   style={{ background: 'var(--green)' }}>
                <Route className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-sm text-gray-800">Cycling Routes</h3>
            </div>
          </FlatCard>

          <FlatCard 
            interactive
            color="rgba(255, 255, 255, 0.9)"
            border="thin"
            borderColor="#e5e7eb"
            hoverBorderColor="var(--blue)"
            className="p-4 cursor-pointer"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-white border border-gray-300">
                <Navigation className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="font-semibold text-sm text-gray-600">Traffic Data</h3>
            </div>
          </FlatCard>

          <FlatCard 
            interactive
            color="rgba(244, 162, 76, 0.15)"
            border="thick"
            borderColor="var(--yellow)"
            hoverBorderColor="var(--orange)"
            className="p-4 cursor-pointer"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center shadow-lg"
                   style={{ background: 'var(--yellow)' }}>
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-sm text-gray-800">E-Bike Stations</h3>
            </div>
          </FlatCard>

          <FlatCard 
            interactive={false}
            color="rgba(255, 255, 255, 0.9)"
            border="thin"
            borderColor="#e5e7eb"
            className="p-4 opacity-60"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-gray-200 border border-gray-300">
                <Car className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="font-semibold text-sm text-gray-400">Car Traffic</h3>
              <span className="text-xs text-red-500 mt-1 block">Coming Soon</span>
            </div>
          </FlatCard>
        </div>
      </div>

      {/* Feature Cards */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Feature Cards</h2>
        <div className="grid grid-cols-3 gap-6">
          <FlatCard 
            color="rgba(59, 130, 246, 0.1)" 
            border="thin" 
            borderColor="rgba(59, 130, 246, 0.3)"
            className="p-6"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Secure</h3>
              <p className="text-blue-600 text-sm">Your data is protected with enterprise-grade security</p>
            </div>
          </FlatCard>

          <FlatCard 
            color="rgba(34, 197, 94, 0.1)" 
            border="thin" 
            borderColor="rgba(34, 197, 94, 0.3)"
            className="p-6"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">Fast</h3>
              <p className="text-green-600 text-sm">Lightning-fast performance for real-time analysis</p>
            </div>
          </FlatCard>

          <FlatCard 
            color="rgba(251, 191, 36, 0.1)" 
            border="thin" 
            borderColor="rgba(251, 191, 36, 0.3)"
            className="p-6"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Global</h3>
              <p className="text-yellow-600 text-sm">Access data from cities around the world</p>
            </div>
          </FlatCard>
        </div>
      </div>
    </div>
  )
};