import type { Meta, StoryObj } from '@storybook/react-vite';
import DualPanel from './DualPanel';

function Demo() {
  return (
    <DualPanel>
      <DualPanel.Left>
        <div style={{ padding: 16, background: '#fbf6ef', height: 600 }}>Left — filters + stats</div>
      </DualPanel.Left>
      <DualPanel.Right>
        <div style={{ padding: 16, background: '#a4b7ca', height: 600 }}>Right — map canvas</div>
      </DualPanel.Right>
    </DualPanel>
  );
}

const meta: Meta<typeof Demo> = { title: 'Responsive/DualPanel', component: Demo };
export default meta;
type Story = StoryObj<typeof Demo>;
export const Default: Story = {};
