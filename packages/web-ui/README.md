# @shochan_ai/web-ui

Next.js-based frontend for Shochan AI with real-time streaming chat interface.

## Overview

`@shochan_ai/web-ui` is a modern chat interface built with Next.js that connects to the Shochan AI backend API. It features real-time text streaming via Server-Sent Events (SSE), providing users with immediate feedback as the AI agent processes requests and generates responses.

## Tech Stack

- **Next.js** 16.1.1 (App Router)
- **React** 19.2.3
- **TypeScript** 5.x
- **Tailwind CSS** 4.x
- **ESLint** 9.x

## Features

- **Real-time Chat Interface**: Interactive chat UI with message history
- **SSE Streaming**: Live updates from the backend via Server-Sent Events
- **Text Streaming**: Real-time display of LLM-generated text tokens
- **Event Visualization**: Visual indicators for different event types (tool calls, approvals, etc.)
- **Responsive Design**: Modern UI with Tailwind CSS
- **Type Safety**: Full TypeScript integration with shared types from `@shochan_ai/core`

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm (v8 or higher)
- Backend API server running (see `@shochan_ai/web` package)

### Installation

Install dependencies (if not already installed):

```bash
pnpm install
```

### Environment Variables

Create a `.env.local` file in the `packages/web-ui` directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your backend API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STREAM_URL=http://localhost:3001
```

**Note**: Since the backend API has CORS enabled, we call it directly from the client-side. No BFF (Backend for Frontend) pattern is needed.

### Running the Development Server

```bash
# From the repository root
pnpm --filter @shochan_ai/web-ui dev

# Or from the packages/web-ui directory
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Building for Production

```bash
# Build the application
pnpm --filter @shochan_ai/web-ui build

# Start production server
pnpm --filter @shochan_ai/web-ui start
```

## Project Structure

```
packages/web-ui/
├── app/                        # Next.js App Router
│   ├── layout.tsx             # Root layout with metadata
│   ├── page.tsx               # Home page with ChatInterface
│   └── globals.css            # Global styles and Tailwind imports
├── components/                # React components
│   ├── chat/
│   │   └── chat-interface.tsx # Main chat interface with SSE integration
│   └── ui/
│       └── badge.tsx          # Badge component for event types
├── hooks/                     # Custom React hooks
│   └── use-sse.ts            # SSE connection management hook
├── lib/                       # Utility libraries
│   ├── api/
│   │   └── hooks/
│   │       └── use-send-message.ts  # API call hook for sending messages
│   └── sse-client.ts         # SSE client implementation
├── types/                     # TypeScript type definitions
│   └── chat.ts               # Chat-specific types
├── public/                    # Static assets
├── .env.example              # Environment variable template
├── .env.local                # Local environment variables (not committed)
├── next.config.ts            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Package dependencies and scripts
```

## Key Components

### ChatInterface (`components/chat/chat-interface.tsx`)

The main chat interface component that handles:

- **Message Display**: Renders user and agent messages with proper styling
- **SSE Integration**: Connects to backend SSE stream for real-time updates
- **Event Handling**: Processes different event types:
  - `connected`: SSE connection established
  - `tool_call`: Display tool execution information
  - `tool_result`: Show tool execution results
  - `text_chunk`: Stream text tokens in real-time
  - `awaiting_approval`: Show approval UI (future feature)
  - `error`: Display error messages
- **Message Composition**: Builds complete messages from streamed chunks
- **Auto-scroll**: Automatically scrolls to latest message

### SSE Client (`lib/sse-client.ts`)

Handles Server-Sent Events connection:

```typescript
export class SSEClient {
  connect(conversationId: string, onEvent: (event: Event) => void): void
  disconnect(): void
}
```

**Features:**
- Automatic reconnection on connection loss
- Event parsing and type validation
- Error handling and logging

### useSSE Hook (`hooks/use-sse.ts`)

React hook for managing SSE connections:

```typescript
export function useSSE(
  conversationId: string | null,
  onEvent: (event: Event) => void
): void
```

**Features:**
- Automatic connection management
- Cleanup on unmount
- Reconnection handling

### useSendMessage Hook (`lib/api/hooks/use-send-message.ts`)

React hook for sending messages to the backend:

```typescript
export function useSendMessage(): {
  sendMessage: (message: string) => Promise<SendMessageResponse>;
  isLoading: boolean;
  error: Error | null;
}
```

**Features:**
- Loading state management
- Error handling
- Type-safe API calls

## Event Flow

### 1. User Sends Message

```typescript
// User types message and clicks send
const { conversationId } = await sendMessage("今日のタスクを教えて");

// Start SSE connection
useSSE(conversationId, handleEvent);
```

### 2. Backend Processing

The backend processes the request and sends events via SSE:

```
1. connected event      → SSE connection ready
2. tool_call event      → Agent decides to call get_tasks
3. tool_result event    → Tasks retrieved from Notion
4. text_chunk events    → Streaming explanation text
5. tool_call event      → Agent calls done_for_now
```

### 3. UI Updates

The ChatInterface updates in real-time:

```typescript
const handleEvent = (event: Event) => {
  switch (event.type) {
    case 'connected':
      // Connection established
      break;
    case 'tool_call':
      // Show tool execution badge
      break;
    case 'tool_result':
      // Display tool result
      break;
    case 'text_chunk':
      // Append text chunk to current message
      setMessages(prev => appendChunk(prev, event.data));
      break;
    case 'error':
      // Show error message
      break;
  }
};
```

## Styling

The UI uses Tailwind CSS with a modern, clean design:

- **Color Scheme**: Blue for user messages, gray for agent messages
- **Typography**: Clear, readable fonts with proper hierarchy
- **Spacing**: Consistent padding and margins
- **Responsive**: Mobile-friendly layout
- **Animations**: Smooth transitions and loading states

## Type Safety

The web-ui package imports types from `@shochan_ai/core` for consistency:

```typescript
import type { Event } from '@shochan_ai/core';
```

**Shared Types:**
- `Event`: All event types (tool_call, tool_result, text_chunk, etc.)
- `ToolCall`: Tool call structure
- Type guards: `isTextChunkEvent()`, `isConnectedEvent()`, etc.

## Available Scripts

- `pnpm dev` - Start development server (http://localhost:3000)
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Development Workflow

### Adding New Features

1. **Add Component**: Create new component in `components/`
2. **Add Types**: Define types in `types/` or import from `@shochan_ai/core`
3. **Add Hook**: Create custom hook in `hooks/` if needed
4. **Update ChatInterface**: Integrate new feature into main interface
5. **Style**: Add Tailwind classes for styling

### Testing Locally

1. Start the backend server:
   ```bash
   pnpm --filter @shochan_ai/web dev
   ```

2. Start the web-ui development server:
   ```bash
   pnpm --filter @shochan_ai/web-ui dev
   ```

3. Open http://localhost:3000 and test the chat interface

## Related Packages

- [`@shochan_ai/web`](../web/README.md): Backend API server with SSE streaming
- [`@shochan_ai/core`](../core/README.md): Business logic and shared types
- [`@shochan_ai/client`](../client/README.md): API clients for OpenAI and Notion

## Future Enhancements

- [ ] Approval UI for destructive operations
- [ ] Message editing and deletion
- [ ] Conversation history persistence
- [ ] Dark mode support
- [ ] Markdown rendering for agent responses
- [ ] File upload support
- [ ] Multi-conversation management

## License

ISC License
