import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router';
import CityCard from '../../components/ui/CityCard';
import type { CityData } from '../../constants/cities';

// Sample city data for the story
const sampleCity: CityData = {
  name: 'Madrid',
  slug: 'madrid',
  path: '/map/madrid',
  mapCoords: { x: 639.4, y: 241.6 },
  geoCoords: { longitude: -3.7038, latitude: 40.4168 },
  population: 3223000,
  budget: 2500000,
  cyclingNetwork: 45,
  coverage: 18
};

const meta: Meta<typeof CityCard> = {
  title: 'UI/CityCard',
  component: CityCard,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark-blue',
      values: [
        { name: 'dark-blue', value: '#003849' }, // --blue-dark
        { name: 'blue', value: '#3A6C7F' }, // --blue
        { name: 'green', value: '#7BA492' }, // --green
        { name: 'light', value: '#FBF6EF' } // --cream
      ]
    }
  },
  decorators: [
    (Story) => (
      <BrowserRouter>
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
      </BrowserRouter>
    )
  ],
  tags: ['autodocs'],
  argTypes: {
    city: { 
      control: 'object',
      description: 'City data object containing name, population, budget, cyclingNetwork, coverage, and path'
    },
    position: { 
      control: { type: 'number', min: -2, max: 2, step: 1 },
      description: 'Position of the card (-2 to 2, where 0 is center)'
    },
    onClick: { 
      action: 'clicked',
      description: 'Optional click handler function'
    }
  }
};

export default meta;
type Story = StoryObj<typeof CityCard>;

export const Default: Story = {
  args: {
    city: sampleCity,
    position: 0,
    onClick: () => console.log('CityCard clicked!')
  },
  render: (args) => (
    <div 
      className="w-full h-screen flex items-center justify-center relative"
      style={{ backgroundColor: '#003849' }}
    >
      <CityCard {...args} />
    </div>
  )
};

export const CenterPosition: Story = {
  args: {
    city: sampleCity,
    position: 0,
  },
  render: (args) => (
    <div 
      className="w-full h-screen flex items-center justify-center relative"
      style={{ backgroundColor: '#003849' }}
    >
      <CityCard {...args} />
    </div>
  )
};

export const LeftPosition: Story = {
  args: {
    city: sampleCity,
    position: -1,
  },
  render: (args) => (
    <div 
      className="w-full h-screen flex items-center justify-center relative"
      style={{ backgroundColor: '#003849' }}
    >
      <CityCard {...args} />
    </div>
  )
};

export const RightPosition: Story = {
  args: {
    city: sampleCity,
    position: 1,
  },
  render: (args) => (
    <div 
      className="w-full h-screen flex items-center justify-center relative"
      style={{ backgroundColor: '#003849' }}
    >
      <CityCard {...args} />
    </div>
  )
};