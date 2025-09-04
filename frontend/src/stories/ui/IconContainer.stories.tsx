import type { Meta, StoryObj } from '@storybook/react';
import { IconContainer } from '../../components/ui/IconContainer';
import { 
  Map, 
  CircuitBoard, 
  BarChart3, 
  Settings, 
  User, 
  Bell, 
  Search, 
  Heart, 
  Star, 
  Zap,
  Home,
  Navigation,
  Route,
  Bike,
  Euro,
  Users,
  Clock,
  Shield,
  Globe,
  TrendingUp
} from 'lucide-react';

const meta: Meta<typeof IconContainer> = {
  title: 'UI/IconContainer',
  component: IconContainer,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f5f5f5' },
        { name: 'cream', value: '#FBF6EF' },
        { name: 'white', value: '#FFFFFF' },
        { name: 'dark', value: '#333333' },
        { name: 'dark-green', value: '#027A76' }
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
    icon: {
      control: false,
      description: 'Lucide icon component to display'
    },
    variant: {
      control: 'select',
      options: ['flat', 'glass', 'outline'],
      description: 'Visual variant of the container'
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size of the container and icon'
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the container is disabled'
    },
    bouncy: {
      control: 'boolean',
      description: 'Enable bouncy active animation'
    },
    iconColor: {
      control: 'color',
      description: 'Color of the icon'
    },
    hoverIconColor: {
      control: 'color',
      description: 'Icon color on hover'
    },
    // Flat-specific
    color: {
      control: 'color',
      description: 'Solid background color (flat only)',
      if: { arg: 'variant', eq: 'flat' }
    },
    gradient: {
      control: 'object',
      description: 'Gradient background (flat only)',
      if: { arg: 'variant', eq: 'flat' }
    },
    // Glass and Outline tint properties
    tint: {
      control: 'color',
      description: 'Base background tint color (glass/outline)',
      if: { arg: 'variant', neq: 'flat' }
    },
    hoverTint: {
      control: 'color',
      description: 'Background tint color on hover (glass/outline)',
      if: { arg: 'variant', neq: 'flat' }
    },
    activeTint: {
      control: 'color',
      description: 'Background tint color on active/press (glass/outline)',
      if: { arg: 'variant', neq: 'flat' }
    },
    blurStrength: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Backdrop blur intensity (glass/outline)',
      if: { arg: 'variant', neq: 'flat' }
    },
    // Outline-specific
    borderColor: {
      control: 'color',
      description: 'Border color (outline only)',
      if: { arg: 'variant', eq: 'outline' }
    },
    hoverBorderColor: {
      control: 'color',
      description: 'Border color on hover (outline only)',
      if: { arg: 'variant', eq: 'outline' }
    },
    activeBorderColor: {
      control: 'color',
      description: 'Border color on active (outline only)',
      if: { arg: 'variant', eq: 'outline' }
    }
  }
};

export default meta;
type Story = StoryObj<typeof IconContainer>;

// Interactive Default Component
export const Interactive: Story = {
  args: {
    icon: Star,
    variant: 'glass',
    size: 'md',
    disabled: false,
    bouncy: true,
    iconColor: 'black',
    onClick: () => alert('Icon clicked!')
  },
  render: (args) => (
    <div className="p-8">
      <IconContainer {...args} aria-label="Interactive icon" />
    </div>
  )
};

// Simple Hover Tint Example
export const HoverTintExample: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Hover Tint Demo</h2>
        <p className="text-gray-600 mb-6">Hover over the icons to see the background tint change</p>
      </div>
      
      <div className="flex gap-8 justify-center">
        <div className="text-center">
          <h3 className="text-sm font-medium mb-3 text-gray-600">Outline: No tint → Green tint</h3>
          <IconContainer 
            icon={Heart}
            variant="outline"
            borderColor="var(--green)"
            hoverTint="rgba(123, 164, 146, 0.2)"
            iconColor="var(--green)"
            onClick={() => {}}
            aria-label="Outline hover tint example"
          />
        </div>
        
        <div className="text-center">
          <h3 className="text-sm font-medium mb-3 text-gray-600">Glass: Blue → Green tint</h3>
          <IconContainer 
            icon={Star}
            variant="glass"
            tint="rgba(58, 108, 127, 0.3)"
            hoverTint="rgba(123, 164, 146, 0.4)"
            iconColor="black"
            onClick={() => {}}
            aria-label="Glass hover tint example"
          />
        </div>
        
        <div className="text-center">
          <h3 className="text-sm font-medium mb-3 text-gray-600">Outline: Blue → Red tint</h3>
          <IconContainer 
            icon={Zap}
            variant="outline"
            borderColor="var(--blue)"
            tint="rgba(58, 108, 127, 0.1)"
            hoverTint="rgba(175, 71, 73, 0.3)"
            iconColor="var(--blue)"
            hoverIconColor="var(--red)"
            onClick={() => {}}
            aria-label="Outline color change tint example"
          />
        </div>
      </div>
    </div>
  )
};

// Comprehensive Customization Showcase
export const CustomizationShowcase: Story = {
  render: () => (
    <div className="space-y-12 max-w-7xl mx-auto p-6">
      {/* Variants Row */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Variants</h2>
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-4 text-gray-600">Flat</h3>
            <IconContainer 
              icon={CircuitBoard} 
              variant="flat" 
              color="var(--green)" 
              iconColor="white"
              onClick={() => {}}
              aria-label="Flat variant"
            />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-4 text-gray-600">Glass</h3>
            <IconContainer 
              icon={Map} 
              variant="glass" 
              tint="rgba(123, 164, 146, 0.3)"
              iconColor="black"
              onClick={() => {}}
              aria-label="Glass variant"
            />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-4 text-gray-600">Outline</h3>
            <IconContainer 
              icon={BarChart3} 
              variant="outline" 
              borderColor="var(--blue)"
              iconColor="var(--blue)"
              onClick={() => {}}
              aria-label="Outline variant"
            />
          </div>
        </div>
      </div>

      {/* Sizes Row */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Sizes</h2>
        <div className="flex items-center gap-8 justify-center">
          <div className="text-center">
            <h3 className="text-sm font-medium mb-3 text-gray-600">Small</h3>
            <IconContainer 
              icon={Clock} 
              variant="flat" 
              size="sm"
              color="var(--blue)" 
              iconColor="white"
              onClick={() => {}}
              aria-label="Small size"
            />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-medium mb-3 text-gray-600">Medium</h3>
            <IconContainer 
              icon={Clock} 
              variant="flat" 
              size="md"
              color="var(--blue)" 
              iconColor="white"
              onClick={() => {}}
              aria-label="Medium size"
            />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-medium mb-3 text-gray-600">Large</h3>
            <IconContainer 
              icon={Clock} 
              variant="flat" 
              size="lg"
              color="var(--blue)" 
              iconColor="white"
              onClick={() => {}}
              aria-label="Large size"
            />
          </div>
        </div>
      </div>

      {/* Interactive States */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Interactive States</h2>
        <div className="grid grid-cols-4 gap-6">
          <div className="text-center">
            <h3 className="text-sm font-medium mb-3 text-gray-600">Static</h3>
            <IconContainer 
              icon={User} 
              variant="flat" 
              color="var(--green)" 
              iconColor="white"
              aria-label="Static icon"
            />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-medium mb-3 text-gray-600">Interactive</h3>
            <IconContainer 
              icon={Bell} 
              variant="flat" 
              color="var(--green)" 
              iconColor="white"
              onClick={() => {}}
              aria-label="Interactive icon"
            />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-medium mb-3 text-gray-600">Disabled</h3>
            <IconContainer 
              icon={Settings} 
              variant="flat" 
              color="var(--green)" 
              iconColor="white"
              onClick={() => {}}
              disabled
              aria-label="Disabled icon"
            />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-medium mb-3 text-gray-600">No Bouncy</h3>
            <IconContainer 
              icon={Search} 
              variant="flat" 
              color="var(--green)" 
              iconColor="white"
              onClick={() => {}}
              bouncy={false}
              aria-label="Non-bouncy icon"
            />
          </div>
        </div>
      </div>

      {/* Flat Customizations */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Flat Customizations</h2>
        <div className="space-y-8">
          {/* Solid Colors */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Solid Colors</h3>
            <div className="flex gap-6 justify-center">
              <IconContainer 
                icon={Heart} 
                variant="flat" 
                color="var(--blue)" 
                iconColor="white"
                onClick={() => {}}
                aria-label="Blue background"
              />
              <IconContainer 
                icon={Heart} 
                variant="flat" 
                color="var(--green)" 
                iconColor="white"
                onClick={() => {}}
                aria-label="Green background"
              />
              <IconContainer 
                icon={Heart} 
                variant="flat" 
                color="var(--yellow)" 
                iconColor="white"
                onClick={() => {}}
                aria-label="Yellow background"
              />
              <IconContainer 
                icon={Heart} 
                variant="flat" 
                color="var(--red)" 
                iconColor="white"
                onClick={() => {}}
                aria-label="Red background"
              />
            </div>
          </div>

          {/* Gradients */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Gradients</h3>
            <div className="flex gap-6 justify-center">
              <IconContainer 
                icon={Zap} 
                variant="flat" 
                gradient={{ from: 'var(--green)', to: 'var(--green-dark)', direction: 'r' }}
                iconColor="white"
                onClick={() => {}}
                aria-label="Green gradient right"
              />
              <IconContainer 
                icon={Zap} 
                variant="flat" 
                gradient={{ from: 'var(--blue)', to: 'var(--blue-dark)', direction: 'b' }}
                iconColor="white"
                onClick={() => {}}
                aria-label="Blue gradient bottom"
              />
              <IconContainer 
                icon={Zap} 
                variant="flat" 
                gradient={{ from: 'var(--yellow)', to: 'var(--orange)', direction: 'tr' }}
                iconColor="white"
                onClick={() => {}}
                aria-label="Yellow to orange gradient"
              />
              <IconContainer 
                icon={Zap} 
                variant="flat" 
                gradient={{ from: 'var(--orange)', to: 'var(--red)', direction: 'br' }}
                iconColor="white"
                onClick={() => {}}
                aria-label="Orange to red gradient"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Glass Customizations */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Glass Customizations</h2>
        <div className="space-y-8">
          {/* Tints */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Tints</h3>
            <div className="flex gap-6 justify-center">
              <IconContainer 
                icon={Star} 
                variant="glass" 
                tint="rgba(123, 164, 146, 0.3)"
                iconColor="black"
                onClick={() => {}}
                aria-label="Green tint"
              />
              <IconContainer 
                icon={Star} 
                variant="glass" 
                tint="rgba(58, 108, 127, 0.3)"
                iconColor="black"
                onClick={() => {}}
                aria-label="Blue tint"
              />
              <IconContainer 
                icon={Star} 
                variant="glass" 
                tint="rgba(244, 162, 76, 0.3)"
                iconColor="black"
                onClick={() => {}}
                aria-label="Yellow tint"
              />
              <IconContainer 
                icon={Star} 
                variant="glass" 
                tint="rgba(175, 71, 73, 0.3)"
                iconColor="white"
                onClick={() => {}}
                aria-label="Red tint"
              />
            </div>
          </div>

          {/* Blur Strengths */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Blur Strengths</h3>
            <div className="flex gap-6 justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Small</p>
                <IconContainer 
                  icon={Globe} 
                  variant="glass" 
                  blurStrength="sm"
                  tint="rgba(123, 164, 146, 0.2)"
                  iconColor="black"
                  onClick={() => {}}
                  aria-label="Small blur"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Medium</p>
                <IconContainer 
                  icon={Globe} 
                  variant="glass" 
                  blurStrength="md"
                  tint="rgba(123, 164, 146, 0.2)"
                  iconColor="black"
                  onClick={() => {}}
                  aria-label="Medium blur"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Large</p>
                <IconContainer 
                  icon={Globe} 
                  variant="glass" 
                  blurStrength="lg"
                  tint="rgba(123, 164, 146, 0.2)"
                  iconColor="black"
                  onClick={() => {}}
                  aria-label="Large blur"
                />
              </div>
            </div>
          </div>

          {/* Interactive Tints */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Interactive Tints</h3>
            <div className="flex gap-6 justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Hover Tint</p>
                <IconContainer 
                  icon={Heart} 
                  variant="glass" 
                  tint="rgba(123, 164, 146, 0.1)"
                  hoverTint="rgba(123, 164, 146, 0.4)"
                  iconColor="black"
                  onClick={() => {}}
                  aria-label="Hover tint example"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Active Tint</p>
                <IconContainer 
                  icon={Zap} 
                  variant="glass" 
                  tint="rgba(58, 108, 127, 0.1)"
                  activeTint="rgba(58, 108, 127, 0.5)"
                  iconColor="black"
                  onClick={() => {}}
                  aria-label="Active tint example"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Full Interactive</p>
                <IconContainer 
                  icon={Star} 
                  variant="glass" 
                  tint="rgba(244, 162, 76, 0.1)"
                  hoverTint="rgba(244, 162, 76, 0.3)"
                  activeTint="rgba(255, 127, 80, 0.5)"
                  iconColor="black"
                  onClick={() => {}}
                  aria-label="Full interactive tints"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Outline Customizations */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Outline Customizations</h2>
        <div className="space-y-8">
          {/* Border Colors */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Border Colors</h3>
            <div className="flex gap-6 justify-center">
              <IconContainer 
                icon={Shield} 
                variant="outline" 
                borderColor="var(--green)"
                iconColor="var(--green)"
                onClick={() => {}}
                aria-label="Green border"
              />
              <IconContainer 
                icon={Shield} 
                variant="outline" 
                borderColor="var(--blue)"
                iconColor="var(--blue)"
                onClick={() => {}}
                aria-label="Blue border"
              />
              <IconContainer 
                icon={Shield} 
                variant="outline" 
                borderColor="var(--yellow)"
                iconColor="var(--yellow)"
                onClick={() => {}}
                aria-label="Yellow border"
              />
              <IconContainer 
                icon={Shield} 
                variant="outline" 
                borderColor="var(--red)"
                iconColor="var(--red)"
                onClick={() => {}}
                aria-label="Red border"
              />
            </div>
          </div>

          {/* Interactive Borders */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Interactive Borders</h3>
            <div className="flex gap-6 justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Hover Effect</p>
                <IconContainer 
                  icon={TrendingUp} 
                  variant="outline" 
                  borderColor="var(--green)"
                  hoverBorderColor="var(--green-dark)"
                  iconColor="var(--green)"
                  hoverIconColor="var(--green-dark)"
                  onClick={() => {}}
                  aria-label="Hover border change"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Full Interactive</p>
                <IconContainer 
                  icon={Navigation} 
                  variant="outline" 
                  borderColor="var(--blue)"
                  hoverBorderColor="var(--blue-dark)"
                  activeBorderColor="var(--green)"
                  iconColor="var(--blue)"
                  hoverIconColor="var(--blue-dark)"
                  onClick={() => {}}
                  aria-label="Full interactive borders"
                />
              </div>
            </div>
          </div>

          {/* With Background Tint */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">With Background Tint</h3>
            <div className="flex gap-6 justify-center">
              <IconContainer 
                icon={Route} 
                variant="outline" 
                borderColor="var(--green)"
                tint="rgba(123, 164, 146, 0.1)"
                iconColor="var(--green)"
                onClick={() => {}}
                aria-label="Outline with tint"
              />
              <IconContainer 
                icon={Route} 
                variant="outline" 
                borderColor="var(--blue)"
                tint="rgba(58, 108, 127, 0.1)"
                iconColor="var(--blue)"
                onClick={() => {}}
                aria-label="Blue outline with tint"
              />
            </div>
          </div>

          {/* Interactive Outline Tints */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Interactive Outline Tints</h3>
            <div className="flex gap-6 justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Hover Tint</p>
                <IconContainer 
                  icon={Shield} 
                  variant="outline" 
                  borderColor="var(--green)"
                  tint="rgba(123, 164, 146, 0.05)"
                  hoverTint="rgba(123, 164, 146, 0.2)"
                  iconColor="var(--green)"
                  onClick={() => {}}
                  aria-label="Outline hover tint"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Active Tint</p>
                <IconContainer 
                  icon={TrendingUp} 
                  variant="outline" 
                  borderColor="var(--blue)"
                  tint="rgba(58, 108, 127, 0.05)"
                  activeTint="rgba(58, 108, 127, 0.3)"
                  iconColor="var(--blue)"
                  onClick={() => {}}
                  aria-label="Outline active tint"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Full Interactive</p>
                <IconContainer 
                  icon={Navigation} 
                  variant="outline" 
                  borderColor="var(--yellow)"
                  hoverBorderColor="var(--orange)"
                  activeBorderColor="var(--red)"
                  tint="rgba(244, 162, 76, 0.05)"
                  hoverTint="rgba(255, 127, 80, 0.15)"
                  activeTint="rgba(175, 71, 73, 0.25)"
                  iconColor="var(--yellow)"
                  hoverIconColor="var(--orange)"
                  onClick={() => {}}
                  aria-label="Full outline interactive"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Icon Color Customizations */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Icon Color Customizations</h2>
        <div className="space-y-8">
          {/* Static Colors */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Icon Colors</h3>
            <div className="flex gap-6 justify-center">
              <IconContainer 
                icon={Home} 
                variant="glass" 
                iconColor="black"
                onClick={() => {}}
                aria-label="Black icon"
              />
              <IconContainer 
                icon={Home} 
                variant="glass" 
                iconColor="var(--green)"
                onClick={() => {}}
                aria-label="Green icon"
              />
              <IconContainer 
                icon={Home} 
                variant="glass" 
                iconColor="var(--blue)"
                onClick={() => {}}
                aria-label="Blue icon"
              />
              <IconContainer 
                icon={Home} 
                variant="glass" 
                iconColor="var(--red)"
                onClick={() => {}}
                aria-label="Red icon"
              />
            </div>
          </div>

          {/* Hover Colors */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-gray-600">Hover Icon Colors</h3>
            <div className="flex gap-6 justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Black → Green</p>
                <IconContainer 
                  icon={Bike} 
                  variant="glass" 
                  iconColor="black"
                  hoverIconColor="var(--green)"
                  onClick={() => {}}
                  aria-label="Icon changes to green on hover"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Blue → Red</p>
                <IconContainer 
                  icon={Euro} 
                  variant="glass" 
                  iconColor="var(--blue)"
                  hoverIconColor="var(--red)"
                  onClick={() => {}}
                  aria-label="Icon changes to red on hover"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Gray → Yellow</p>
                <IconContainer 
                  icon={Users} 
                  variant="glass" 
                  iconColor="#6b7280"
                  hoverIconColor="var(--yellow)"
                  onClick={() => {}}
                  aria-label="Icon changes to yellow on hover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
};

// App Components - Real Usage Examples
export const AppComponents: Story = {
  render: () => (
    <div className="space-y-12 max-w-6xl mx-auto p-6">
      {/* Navigation Icons */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Navigation Icons</h2>
        <div className="flex gap-4 justify-center">
          <IconContainer 
            icon={Map} 
            variant="flat" 
            color="var(--green)"
            iconColor="white"
            onClick={() => {}}
            aria-label="Open maps"
          />
          <IconContainer 
            icon={BarChart3} 
            variant="flat" 
            color="var(--blue)"
            iconColor="white"
            onClick={() => {}}
            aria-label="View analytics"
          />
          <IconContainer 
            icon={Settings} 
            variant="outline" 
            borderColor="var(--green)"
            iconColor="var(--green)"
            onClick={() => {}}
            aria-label="Open settings"
          />
          <IconContainer 
            icon={User} 
            variant="glass" 
            tint="rgba(123, 164, 146, 0.2)"
            iconColor="black"
            onClick={() => {}}
            aria-label="User profile"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Action Buttons</h2>
        <div className="grid grid-cols-4 gap-6">
          <div className="text-center">
            <IconContainer 
              icon={Search} 
              variant="flat" 
              gradient={{ from: 'var(--blue)', to: 'var(--blue-dark)' }}
              iconColor="white"
              size="lg"
              onClick={() => {}}
              aria-label="Search"
            />
            <p className="text-sm text-gray-600 mt-2">Search</p>
          </div>
          <div className="text-center">
            <IconContainer 
              icon={Bell} 
              variant="glass" 
              tint="rgba(244, 162, 76, 0.3)"
              iconColor="black"
              size="lg"
              onClick={() => {}}
              aria-label="Notifications"
            />
            <p className="text-sm text-gray-600 mt-2">Notifications</p>
          </div>
          <div className="text-center">
            <IconContainer 
              icon={Heart} 
              variant="outline" 
              borderColor="var(--red)"
              hoverBorderColor="var(--red)"
              iconColor="var(--red)"
              size="lg"
              onClick={() => {}}
              aria-label="Favorites"
            />
            <p className="text-sm text-gray-600 mt-2">Favorites</p>
          </div>
          <div className="text-center">
            <IconContainer 
              icon={Zap} 
              variant="flat" 
              color="var(--yellow)"
              iconColor="white"
              size="lg"
              onClick={() => {}}
              aria-label="Quick actions"
            />
            <p className="text-sm text-gray-600 mt-2">Quick Actions</p>
          </div>
        </div>
      </div>

      {/* Filter Icons */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Filter Icons</h2>
        <div className="flex gap-3 justify-center flex-wrap">
          <IconContainer 
            icon={Route} 
            variant="outline" 
            borderColor="var(--green)"
            hoverBorderColor="var(--green-dark)"
            iconColor="var(--green)"
            size="sm"
            onClick={() => {}}
            aria-label="Cycling routes filter"
          />
          <IconContainer 
            icon={Navigation} 
            variant="outline" 
            borderColor="#e5e7eb"
            hoverBorderColor="var(--blue)"
            iconColor="#6b7280"
            hoverIconColor="var(--blue)"
            size="sm"
            onClick={() => {}}
            aria-label="Traffic data filter"
          />
          <IconContainer 
            icon={Zap} 
            variant="outline" 
            borderColor="var(--yellow)"
            hoverBorderColor="var(--orange)"
            iconColor="var(--yellow)"
            size="sm"
            onClick={() => {}}
            aria-label="E-bike stations filter"
          />
          <IconContainer 
            icon={CircuitBoard} 
            variant="outline" 
            borderColor="#e5e7eb"
            iconColor="#9ca3af"
            size="sm"
            disabled
            aria-label="Infrastructure filter (disabled)"
          />
        </div>
      </div>

      {/* Status Indicators */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Status Indicators</h2>
        <div className="flex gap-6 justify-center">
          <div className="text-center">
            <IconContainer 
              icon={Shield} 
              variant="flat" 
              color="var(--green)"
              iconColor="white"
              bouncy={false}
              aria-label="System healthy"
            />
            <p className="text-sm text-green-600 mt-2">Healthy</p>
          </div>
          <div className="text-center">
            <IconContainer 
              icon={Clock} 
              variant="flat" 
              color="var(--yellow)"
              iconColor="white"
              bouncy={false}
              aria-label="System warning"
            />
            <p className="text-sm text-yellow-600 mt-2">Warning</p>
          </div>
          <div className="text-center">
            <IconContainer 
              icon={Zap} 
              variant="flat" 
              color="var(--red)"
              iconColor="white"
              bouncy={false}
              aria-label="System error"
            />
            <p className="text-sm text-red-600 mt-2">Error</p>
          </div>
          <div className="text-center">
            <IconContainer 
              icon={Globe} 
              variant="flat" 
              color="#6b7280"
              iconColor="white"
              bouncy={false}
              disabled
              aria-label="System offline"
            />
            <p className="text-sm text-gray-500 mt-2">Offline</p>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Floating Action Buttons</h2>
        <div className="flex gap-8 justify-center">
          <IconContainer 
            icon={Map} 
            variant="flat" 
            gradient={{ from: 'var(--green)', to: 'var(--green-dark)' }}
            iconColor="white"
            size="lg"
            onClick={() => {}}
            aria-label="Add new location"
            className="shadow-xl"
          />
          <IconContainer 
            icon={BarChart3} 
            variant="glass" 
            tint="rgba(255, 255, 255, 0.9)"
            blurStrength="lg"
            iconColor="var(--blue)"
            size="lg"
            onClick={() => {}}
            aria-label="Generate report"
            className="shadow-xl"
          />
        </div>
      </div>
    </div>
  )
};