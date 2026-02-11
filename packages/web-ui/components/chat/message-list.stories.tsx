import type { Meta, StoryObj } from '@storybook/react'
import { MessageList } from './message-list'
import type { Message } from '@/types/chat'

const meta: Meta<typeof MessageList> = {
  title: 'Chat/MessageList',
  component: MessageList,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof MessageList>

const sampleMessages: Message[] = [
  {
    id: '1',
    type: 'user',
    content: 'Hello! How are you?',
    timestamp: Date.now() - 60000,
  },
  {
    id: '2',
    type: 'agent',
    content: "I'm doing well, thank you! How can I assist you today?",
    timestamp: Date.now() - 50000,
  },
  {
    id: '3',
    type: 'user',
    content: 'Can you help me with my project?',
    timestamp: Date.now() - 40000,
  },
  {
    id: '4',
    type: 'agent',
    content:
      'Of course! I\'d be happy to help.\n\nPlease tell me more about your project and what you need assistance with.',
    timestamp: Date.now() - 30000,
  },
]

const longMessages: Message[] = [
  ...sampleMessages,
  {
    id: '5',
    type: 'user',
    content:
      'I need help implementing a chat interface with React and TypeScript.',
    timestamp: Date.now() - 20000,
  },
  {
    id: '6',
    type: 'agent',
    content:
      'Great! Let me help you with that.\n\nFor a chat interface, you\'ll need:\n1. Message input component\n2. Message list component\n3. Chat interface to combine them\n\nWould you like me to explain each part?',
    timestamp: Date.now() - 10000,
  },
  {
    id: '7',
    type: 'system',
    content: 'Connection established',
    timestamp: Date.now() - 5000,
  },
  {
    id: '8',
    type: 'user',
    content: 'Yes, please explain!',
    timestamp: Date.now() - 3000,
  },
]

export const Empty: Story = {
  args: {
    messages: [],
  },
}

export const Default: Story = {
  args: {
    messages: sampleMessages,
  },
}

export const WithSystemMessage: Story = {
  args: {
    messages: [
      ...sampleMessages,
      {
        id: '5',
        type: 'system',
        content: 'Connection established',
        timestamp: Date.now(),
      },
    ],
  },
}

export const LongConversation: Story = {
  args: {
    messages: longMessages,
  },
}

export const WithMarkdown: Story = {
  args: {
    messages: [
      {
        id: '1',
        type: 'user',
        content: 'Can you explain how to use React hooks?',
        timestamp: Date.now() - 20000,
      },
      {
        id: '2',
        type: 'agent',
        content: `# React Hooks Guide

Here are the most commonly used hooks:

## useState
Use **useState** for managing local state:

\`\`\`typescript
const [count, setCount] = useState(0);
\`\`\`

## useEffect
Use *useEffect* for side effects:

- Fetching data
- Setting up subscriptions
- Manually changing the DOM

## Useful Links
Check the [React documentation](https://react.dev/) for more details.

| Hook | Purpose |
|------|---------|
| useState | Local state |
| useEffect | Side effects |
| useContext | Context access |

> **Note:** Always follow the [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks).

---

That's a quick overview! Let me know if you need more details.`,
        timestamp: Date.now() - 10000,
      },
    ],
  },
}

export const WithLongText: Story = {
  args: {
    messages: [
      {
        id: '1',
        type: 'user',
        content: 'This is a very long message that contains a lot of text to test the text wrapping functionality. It should wrap properly and not overflow the container. Let me add even more text to make sure it works correctly with multiple lines of content.',
        timestamp: Date.now() - 10000,
      },
      {
        id: '2',
        type: 'agent',
        content: 'Here is a response with some code:\n\n```typescript\nfunction example() {\n  console.log("This is a code example")\n  return true\n}\n```\n\nThis demonstrates multi-line content handling.',
        timestamp: Date.now(),
      },
    ],
  },
}
