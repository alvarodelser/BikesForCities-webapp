import type { Meta, StoryObj } from '@storybook/react-vite';
import ResponsiveChart from './ResponsiveChart';

function Demo() {
  return (
    <ResponsiveChart minHeight={220} maxHeight={340}>
      {({ band, width, height }) => (
        <div style={{ width, height, background: '#eef4f8', padding: 12 }}>
          Band: <b>{band}</b> — {width}×{height}
        </div>
      )}
    </ResponsiveChart>
  );
}
const meta: Meta<typeof Demo> = { title: 'Responsive/ResponsiveChart', component: Demo };
export default meta;
type Story = StoryObj<typeof Demo>;
export const Default: Story = {};
