import type { Meta, StoryObj } from '@storybook/react'
import { MessageInput } from './message-input'

const meta: Meta<typeof MessageInput> = {
  title: 'Chat/MessageInput',
  component: MessageInput,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof MessageInput>

export const Default: Story = {
  args: {
    onSend: (message: string) => {
      console.log('Message sent:', message)
    },
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    onSend: (message: string) => {
      console.log('Message sent:', message)
    },
  },
}
