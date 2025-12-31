import type { Meta, StoryObj } from '@storybook/react'
import { Textarea } from './textarea'

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  args: {
    placeholder: 'Enter your message...',
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: 'This is a sample message.\nIt can span multiple lines.',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled textarea',
    disabled: true,
  },
}

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2">
      <label htmlFor="message" className="text-sm font-medium">
        Message
      </label>
      <Textarea id="message" placeholder="Type your message here..." />
    </div>
  ),
}

export const WithError: Story = {
  render: () => (
    <div className="space-y-2">
      <label htmlFor="description" className="text-sm font-medium">
        Description
      </label>
      <Textarea
        id="description"
        placeholder="Enter description"
        aria-invalid="true"
      />
      <p className="text-sm text-destructive">Description is required</p>
    </div>
  ),
}

export const LongText: Story = {
  args: {
    defaultValue: `This is a longer text example.
It demonstrates how the textarea handles multiple lines of content.
The field-sizing-content class allows it to grow automatically.

You can add as much content as you need, and the textarea will adjust its height accordingly.`,
  },
}
