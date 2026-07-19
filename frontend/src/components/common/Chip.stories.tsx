import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip, ChipGroup, FilterChip } from './Chip';
import { useState } from 'react';

const meta: Meta<typeof Chip> = {
  title: "Components/Common/Chip",
  component: Chip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {
  args: {
    label: "Chip",
  },
};

export const WithIcon: Story = {
  args: {
    label: "Pizza",
    icon: "🍕",
  },
};

export const Deletable: Story = {
  args: {
    label: "Removable",
    onDelete: () => alert("Deleted!"),
  },
};

export const Clickable: Story = {
  args: {
    label: "Clickable",
    onClick: () => alert("Clicked!"),
  },
};

export const Selected: Story = {
  args: {
    label: "Selected",
    selected: true,
  },
};

export const Filled: Story = {
  args: {
    label: "Filled",
    variant: "filled",
    color: "primary",
  },
};

export const Outlined: Story = {
  args: {
    label: "Outlined",
    variant: "outlined",
    color: "primary",
  },
};

export const Success: Story = {
  args: {
    label: "Success",
    variant: "filled",
    color: "success",
  },
};

export const Error: Story = {
  args: {
    label: "Error",
    variant: "filled",
    color: "error",
  },
};

export const Warning: Story = {
  args: {
    label: "Warning",
    variant: "filled",
    color: "warning",
  },
};

export const Small: Story = {
  args: {
    label: "Small",
    size: "sm",
  },
};

export const Large: Story = {
  args: {
    label: "Large",
    size: "lg",
  },
};

export const Group: Story = {
  render: () => {
    const [selected, setSelected] = useState<string[]>(["pizza"]);

    return (
      <ChipGroup
        chips={[
          { id: "pizza", label: "Пицца", icon: "🍕" },
          { id: "burger", label: "Бургер", icon: "🍔" },
          { id: "sushi", label: "Суши", icon: "🍣" },
          { id: "pasta", label: "Паста", icon: "🍝" },
        ]}
        selected={selected}
        onSelect={(id) => {
          setSelected((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
          );
        }}
        multiSelect
      />
    );
  },
};

export const FilterChips: Story = {
  render: () => {
    const [filter, setFilter] = useState<string | null>("active");

    return (
      <div className="flex gap-2">
        <FilterChip
          label="Активные"
          active={filter === "active"}
          count={5}
          onClick={() => setFilter("active")}
          onClear={() => setFilter(null)}
        />
        <FilterChip
          label="Завершённые"
          active={filter === "completed"}
          count={12}
          onClick={() => setFilter("completed")}
          onClear={() => setFilter(null)}
        />
      </div>
    );
  },
};
