import type { Meta, StoryObj } from '@storybook/react-vite';
import MobileTabs from './MobileTabs';

function Demo() {
  return (
    <MobileTabs defaultTab="graphs">
      <MobileTabs.Tab id="graphs" label="Gráficos"><div style={{ padding: 20 }}>Charts</div></MobileTabs.Tab>
      <MobileTabs.Tab id="table" label="Tabla"><div style={{ padding: 20 }}>Table</div></MobileTabs.Tab>
      <MobileTabs.Tab id="detail" label="Detalle"><div style={{ padding: 20 }}>Detail</div></MobileTabs.Tab>
    </MobileTabs>
  );
}
const meta: Meta<typeof Demo> = { title: 'Responsive/MobileTabs', component: Demo };
export default meta;
type Story = StoryObj<typeof Demo>;
export const Default: Story = {};
