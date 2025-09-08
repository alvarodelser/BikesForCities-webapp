import type { Meta, StoryObj } from '@storybook/react';
import WaveBackground from '../../components/ui/WaveBackground';

const meta = {
  title: 'UI/WaveBackground',
  component: WaveBackground,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A Three.js-based animated wave background component inspired by Vanta.js waves effect. Creates realistic water surface animation with interactive camera movement.',
      },
    },
  },
  argTypes: {
    color: {
      control: { type: 'color' },
      description: 'Wave surface color in hexadecimal format',
    },
    shininess: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Material shininess/reflectivity (0-100)',
    },
    waveHeight: {
      control: { type: 'range', min: 1, max: 50, step: 1 },
      description: 'Wave amplitude in pixels',
    },
    waveSpeed: {
      control: { type: 'range', min: 0.1, max: 3, step: 0.1 },
      description: 'Animation speed multiplier',
    },
    zoom: {
      control: { type: 'range', min: 0.5, max: 3, step: 0.1 },
      description: 'Camera zoom level',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <Story />
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 1000
        }}>
          Move your mouse to interact with the camera
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof WaveBackground>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive - Single component with controls for interactive testing
export const Interactive: Story = {
  args: {
    color: 0x3A6C7F,
    shininess: 25,
    waveHeight: 15,
    waveSpeed: 1,
    zoom: 1,
    className: '',
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive WaveBackground with all configurable properties. Use the controls panel to experiment with different settings and move your mouse to see the camera interaction.',
      },
    },
  },
};

// Showcase - Different variants showing customization options
export const Showcase: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100vh' }}>
      {/* Ocean Theme */}
      <div style={{ position: 'relative', border: '2px solid #ccc' }}>
        <WaveBackground
          color={0x005588}
          shininess={30}
          waveHeight={20}
          waveSpeed={0.8}
          zoom={1.2}
        />
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          Ocean Theme
        </div>
      </div>

      {/* Calm Waters */}
      <div style={{ position: 'relative', border: '2px solid #ccc' }}>
        <WaveBackground
          color={0x7BA492}
          shininess={50}
          waveHeight={8}
          waveSpeed={0.5}
          zoom={1.5}
        />
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          Calm Waters
        </div>
      </div>

      {/* Stormy Seas */}
      <div style={{ position: 'relative', border: '2px solid #ccc' }}>
        <WaveBackground
          color={0x003849}
          shininess={15}
          waveHeight={35}
          waveSpeed={2}
          zoom={0.8}
        />
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          Stormy Seas
        </div>
      </div>

      {/* Tropical Lagoon */}
      <div style={{ position: 'relative', border: '2px solid #ccc' }}>
        <WaveBackground
          color={0x92BEC9}
          shininess={80}
          waveHeight={12}
          waveSpeed={0.6}
          zoom={1.3}
        />
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          Tropical Lagoon
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcase of different WaveBackground themes and configurations: Ocean Theme (deep blue with medium waves), Calm Waters (green with gentle waves), Stormy Seas (dark with high waves), and Tropical Lagoon (light blue with subtle shimmer).',
      },
    },
  },
};

// Examples - Usage in actual app context
export const Examples: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* MapSelector Context */}
      <div style={{ flex: 1, position: 'relative', border: '2px solid #ccc', marginBottom: '10px' }}>
        <WaveBackground
          color={0x3A6C7F}
          shininess={25}
          waveHeight={12}
          waveSpeed={0.8}
          zoom={1.2}
        />
        {/* Simulated Spain Map Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M20,30 Q50,10 80,30 Q90,50 80,70 Q50,90 20,70 Q10,50 20,30 Z\' fill=\'none\' stroke=\'white\' stroke-width=\'1\' opacity=\'0.3\'/%3E%3C/svg%3E") center/contain no-repeat',
          opacity: 0.15,
          zIndex: 10
        }} />
        {/* Simulated City Pins */}
        <div style={{ position: 'absolute', top: '40%', left: '45%', zIndex: 20 }}>
          <div style={{
            width: '12px',
            height: '12px',
            background: '#7BA492',
            borderRadius: '50%',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }} />
        </div>
        <div style={{ position: 'absolute', top: '60%', left: '30%', zIndex: 20 }}>
          <div style={{
            width: '12px',
            height: '12px',
            background: '#7BA492',
            borderRadius: '50%',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }} />
        </div>
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 30
        }}>
          MapSelector Usage - Background for interactive map
        </div>
      </div>

      {/* Hero Section Context */}
      <div style={{ flex: 1, position: 'relative', border: '2px solid #ccc' }}>
        <WaveBackground
          color={0x005588}
          shininess={40}
          waveHeight={18}
          waveSpeed={0.6}
          zoom={1.5}
        />
        {/* Simulated Content Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(45deg, rgba(0,0,0,0.3), transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.9)',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)'
          }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#003849' }}>Hero Section</h2>
            <p style={{ margin: 0, color: '#3A6C7F' }}>Dynamic background for engaging content</p>
          </div>
        </div>
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 30
        }}>
          Hero Section Usage - Dynamic background with overlay content
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Real-world usage examples of WaveBackground in the Bikes for Cities application: as a background for the MapSelector component with Spain map overlay and city pins, and as a dynamic background for hero sections with content overlays.',
      },
    },
  },
};

// Additional story for performance testing
export const PerformanceTest: Story = {
  args: {
    color: 0x3A6C7F,
    shininess: 25,
    waveHeight: 15,
    waveSpeed: 1,
    zoom: 1,
  },
  parameters: {
    docs: {
      description: {
        story: 'Performance test version with standard settings. Monitor frame rate and GPU usage in browser dev tools.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <Story />
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '12px',
          zIndex: 1000,
          fontFamily: 'monospace'
        }}>
          <div>Performance Monitor</div>
          <div>Open DevTools → Performance tab</div>
          <div>Check GPU usage and FPS</div>
        </div>
      </div>
    ),
  ],
};
