import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef } from 'react';
import SideCardTail from './SideCardTail';

function Demo({ x, y }: { x: string; y: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#1a3340' }}>
      <div
        ref={ref}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: 16,
          height: 16,
          borderRadius: 8,
          background: '#F4A24C',
        }}
      />
      <SideCardTail targetRef={ref} visible>
        <div style={{ padding: 16, background: 'rgba(251,246,239,0.95)', borderRadius: 12, color: '#003849' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Madrid</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Example side card</div>
        </div>
      </SideCardTail>
    </div>
  );
}

const meta: Meta<typeof Demo> = { title: 'Responsive/SideCardTail', component: Demo };
export default meta;
type Story = StoryObj<typeof Demo>;

export const LeftSide: Story = { args: { x: '20%', y: '40%' } };
export const RightSide: Story = { args: { x: '80%', y: '50%' } };
export const TopClamped: Story = { args: { x: '30%', y: '2%' } };
