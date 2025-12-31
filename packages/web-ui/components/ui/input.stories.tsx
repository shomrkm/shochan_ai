import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url'],
    },
    disabled: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: 'Sample text',
  },
}

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'Enter your email...',
  },
}

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter your password...',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
}

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2">
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <Input id="email" type="email" placeholder="m@example.com" />
    </div>
  ),
}

export const WithError: Story = {
  render: () => (
    <div className="space-y-2">
      <label htmlFor="username" className="text-sm font-medium">
        Username
      </label>
      <Input
        id="username"
        placeholder="Enter username"
        aria-invalid="true"
      />
      <p className="text-sm text-destructive">Username is required</p>
    </div>
  ),
}
