import type { Meta, StoryObj } from '@storybook/react';
import CityPin from '../../components/ui/CityPin';

const meta = {
  title: 'UI/CityPin',
  component: CityPin,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A diamond-shaped city pin component with glassmorphic styling and animated expansion on click. Features icon movement and letter-by-letter text animation.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    cityName: {
      control: 'text',
      description: 'Name of the city to display'
    },
    isSelected: {
      control: 'boolean',
      description: 'Whether the pin is currently selected'
    },
    variant: {
      control: 'select',
      options: ['glassmorphic', 'normal'],
      description: 'Visual style variant'
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size of the pin'
    },
    onClick: {
      action: 'clicked',
      description: 'Callback fired when pin is clicked'
    }
  }
} satisfies Meta<typeof CityPin>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive Story - Single pin with controls
export const Interactive: Story = {
  args: {
    cityName: 'Madrid',
    isSelected: false,
    variant: 'glassmorphic',
    size: 'md',
    onClick: () => console.log('Pin clicked!')
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive CityPin component with full controls. Click the pin to see the expansion animation with icon movement and letter-by-letter text reveal.'
      }
    }
  }
};

// Showcase Story - Different variants and sizes
export const Showcase: Story = {
  args: {
    cityName: "Madrid",
    variant: "glassmorphic",
    size: "md"
  },
  render: () => (
    <div className="p-8 bg-gradient-to-br from-blue-500 to-teal-600 rounded-lg">
      <div className="space-y-8">
        {/* Variants */}
        <div>
          <h3 className="text-white text-lg font-semibold mb-4">Variants</h3>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <CityPin cityName="Barcelona" variant="glassmorphic" size="md" />
              <p className="text-white text-sm mt-2">Glassmorphic</p>
            </div>
            <div className="text-center">
              <CityPin cityName="Valencia" variant="normal" size="md" />
              <p className="text-white text-sm mt-2">Normal</p>
            </div>
          </div>
        </div>

        {/* Sizes */}
        <div>
          <h3 className="text-white text-lg font-semibold mb-4">Sizes</h3>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <CityPin cityName="León" variant="glassmorphic" size="sm" />
              <p className="text-white text-sm mt-2">Small</p>
            </div>
            <div className="text-center">
              <CityPin cityName="Sevilla" variant="glassmorphic" size="md" />
              <p className="text-white text-sm mt-2">Medium</p>
            </div>
            <div className="text-center">
              <CityPin cityName="Málaga" variant="glassmorphic" size="lg" />
              <p className="text-white text-sm mt-2">Large</p>
            </div>
          </div>
        </div>

        {/* States */}
        <div>
          <h3 className="text-white text-lg font-semibold mb-4">States</h3>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <CityPin cityName="Zaragoza" variant="glassmorphic" size="md" isSelected={false} />
              <p className="text-white text-sm mt-2">Default</p>
            </div>
            <div className="text-center">
              <CityPin cityName="Alicante" variant="glassmorphic" size="md" isSelected={true} />
              <p className="text-white text-sm mt-2">Selected</p>
            </div>
          </div>
        </div>

        {/* Long city names */}
        <div>
          <h3 className="text-white text-lg font-semibold mb-4">Long Names</h3>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <CityPin cityName="Las Palmas de Gran Canaria" variant="glassmorphic" size="md" />
              <p className="text-white text-sm mt-2">Long Name</p>
            </div>
            <div className="text-center">
              <CityPin cityName="A Coruña" variant="glassmorphic" size="md" />
              <p className="text-white text-sm mt-2">Special Characters</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcase of different CityPin variants, sizes, and states. Demonstrates glassmorphic vs normal styling, various sizes (sm, md, lg), selected states, and handling of long city names.'
      }
    }
  }
};

// Examples Story - Real usage scenarios
export const Examples: Story = {
  args: {
    cityName: "Madrid",
    variant: "glassmorphic",
    size: "md"
  },
  render: () => (
    <div className="space-y-8">
      {/* Map-like scenario */}
      <div>
        <h3 className="text-gray-800 text-lg font-semibold mb-4">Map Integration Example</h3>
        <div 
          className="relative w-full h-64 bg-gradient-to-br from-blue-400 to-teal-500 rounded-lg overflow-hidden"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        >
          {/* Simulated Spanish cities positioned on map */}
          <CityPin 
            cityName="Madrid" 
            variant="glassmorphic" 
            size="md"
            className="absolute top-[45%] left-[50%] transform -translate-x-1/2 -translate-y-1/2"
          />
          <CityPin 
            cityName="Barcelona" 
            variant="glassmorphic" 
            size="md"
            className="absolute top-[25%] left-[75%] transform -translate-x-1/2 -translate-y-1/2"
          />
          <CityPin 
            cityName="Valencia" 
            variant="glassmorphic" 
            size="sm"
            className="absolute top-[65%] left-[65%] transform -translate-x-1/2 -translate-y-1/2"
          />
          <CityPin 
            cityName="Sevilla" 
            variant="glassmorphic" 
            size="sm"
            className="absolute top-[75%] left-[35%] transform -translate-x-1/2 -translate-y-1/2"
          />
          <CityPin 
            cityName="Bilbao" 
            variant="glassmorphic" 
            size="sm"
            className="absolute top-[15%] left-[25%] transform -translate-x-1/2 -translate-y-1/2"
          />
        </div>
        <p className="text-gray-600 text-sm mt-2">
          Click on any city pin to see the expansion animation with icon movement and letter-by-letter text reveal.
        </p>
      </div>

      {/* Selection states */}
      <div>
        <h3 className="text-gray-800 text-lg font-semibold mb-4">Selection States</h3>
        <div className="flex flex-wrap gap-4 p-4 bg-gray-100 rounded-lg">
          <CityPin cityName="Madrid" variant="glassmorphic" size="md" isSelected={true} />
          <CityPin cityName="Barcelona" variant="glassmorphic" size="md" isSelected={false} />
          <CityPin cityName="Valencia" variant="normal" size="md" isSelected={false} />
          <CityPin cityName="Zaragoza" variant="normal" size="md" isSelected={true} />
        </div>
        <p className="text-gray-600 text-sm mt-2">
          Selected pins show a yellow ring and remain expanded. Non-selected pins are in diamond form.
        </p>
      </div>

      {/* Animation demonstration */}
      <div>
        <h3 className="text-gray-800 text-lg font-semibold mb-4">Animation Features</h3>
        <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
          <div className="flex flex-wrap gap-6 justify-center">
            <CityPin cityName="Málaga" variant="glassmorphic" size="lg" />
            <CityPin cityName="Las Palmas" variant="glassmorphic" size="lg" />
            <CityPin cityName="A Coruña" variant="glassmorphic" size="lg" />
          </div>
          <p className="text-white text-sm mt-4 text-center">
            Click pins to see: 1) Diamond → Rectangle transformation, 2) Icon movement to left, 3) Letter-by-letter text animation
          </p>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Real-world usage examples showing CityPin in map contexts, selection states, and animation features. Demonstrates how the component works in typical application scenarios.'
      }
    }
  }
};
