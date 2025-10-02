import type { Meta, StoryObj } from '@storybook/react';
import { Badge, BadgeWrapper, StatusBadge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Common/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: '5',
  },
};

export const Success: Story = {
  args: {
    children: '10',
    variant: 'success',
  },
};

export const Error: Story = {
  args: {
    children: '3',
    variant: 'error',
  },
};

export const Warning: Story = {
  args: {
    children: '2',
    variant: 'warning',
  },
};

export const Info: Story = {
  args: {
    children: '7',
    variant: 'info',
  },
};

export const Small: Story = {
  args: {
    children: '1',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    children: '99+',
    size: 'lg',
  },
};

export const Dot: Story = {
  args: {
    children: '',
    dot: true,
    variant: 'error',
  },
};

export const Pulse: Story = {
  args: {
    children: '',
    dot: true,
    variant: 'success',
    pulse: true,
  },
};

export const WithWrapper: Story = {
  render: () => (
    <BadgeWrapper badge={5} variant="error">
      <button className="px-4 py-2 bg-blue-500 text-white rounded-lg">
        Notifications
      </button>
    </BadgeWrapper>
  ),
};

export const WithDotBadge: Story = {
  render: () => (
    <BadgeWrapper badge={1} dot pulse variant="success">
      <div className="w-12 h-12 bg-gray-300 rounded-full" />
    </BadgeWrapper>
  ),
};

export const StatusActive: Story = {
  render: () => <StatusBadge status="active" />,
};

export const StatusCompleted: Story = {
  render: () => <StatusBadge status="completed" />,
};

export const StatusPending: Story = {
  render: () => <StatusBadge status="pending" />,
};
