# @shochan_ai/web

Web API server for Shochan AI with real-time Server-Sent Events (SSE) streaming support.

## Overview

`@shochan_ai/web` provides a RESTful API server built with Express that enables client applications to interact with the Shochan AI agent through HTTP endpoints. It features real-time event streaming using SSE for monitoring agent execution progress, Redis-based state persistence for conversation management, and a clean dependency injection architecture.

## Features

- **RESTful API**: Submit queries and manage agent conversations via HTTP endpoints
- **Real-time SSE Streaming**: Monitor agent execution progress with Server-Sent Events
- **Redis State Persistence**: Conversation state stored in Redis with automatic TTL (1 hour)
- **Dependency Injection**: Clean architecture with testable router factory functions
- **CORS Support**: Cross-Origin Resource Sharing enabled for client applications
- **Health Monitoring**: Built-in health check endpoint for service monitoring

## Architecture

### Core Components

```
packages/web/
├── src/
│   ├── server.ts                    # Server initialization and dependency setup
│   ├── app.ts                       # Express app configuration
│   ├── routes/
│   │   ├── agent.ts                 # Agent query and approval endpoints
│   │   └── stream.ts                # SSE streaming endpoint
│   ├── state/
│   │   └── redis-store.ts           # Redis-based Thread state persistence
│   ├── streaming/
│   │   └── manager.ts               # SSE session management
│   └── middleware/
│       └── fallback-handlers.ts     # Error and 404 handlers
└── package.json
```

### Component Roles

- **Server**: Initializes dependencies and wires up routes
- **App**: Configures Express middleware (CORS, JSON parsing, logging)
- **Agent Router**: Handles query submission and tool approval
- **Stream Router**: Manages SSE connections for real-time updates
- **RedisStateStore**: Persists Thread state with conversation IDs as keys
- **StreamManager**: Manages active SSE sessions and event broadcasting

## API Endpoints

### Health Check

```
GET /health
```

Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-31T12:00:00.000Z"
}
```

### Submit Query

```
POST /api/agent/query
```

Submit a new query to the agent and start processing.

**Request Body:**
```json
{
  "message": "今日のタスクを教えて"
}
```

**Response:**
```json
{
  "conversationId": "f217bba2-68ea-4a75-9355-a686f4bc064b"
}
```

**Process Flow:**
1. Server receives query and generates unique `conversationId`
2. Creates initial Thread with `user_input` event
3. Stores Thread in Redis
4. Starts background agent processing
5. Returns `conversationId` to client

### Stream Events (SSE)

```
GET /api/stream/:conversationId
```

Establishes SSE connection to receive real-time agent events.

**Request:**
```
GET /api/stream/f217bba2-68ea-4a75-9355-a686f4bc064b
```

**Response (SSE Stream):**
```
event: connected
data: {"type":"connected","timestamp":1735646400000,"data":{"conversationId":"f217bba2-68ea-4a75-9355-a686f4bc064b"}}

event: tool_call
data: {"type":"tool_call","timestamp":1735646401000,"data":{"intent":"get_tasks","parameters":{...}}}

event: tool_result
data: {"type":"tool_result","timestamp":1735646402000,"data":{"intent":"get_tasks","result":{...}}}

event: tool_call
data: {"type":"tool_call","timestamp":1735646403000,"data":{"intent":"done_for_now","parameters":{...}}}
```

**Event Types:**
- `connected`: SSE connection established
- `tool_call`: Agent generated a tool call
- `tool_result`: Tool execution completed
- `awaiting_approval`: Approval required (for `delete_task`)
- `error`: Error occurred during processing

### Approve Tool Call

```
POST /api/agent/approve/:conversationId
```

Approve or deny a pending tool call (used for `delete_task`).

**Request Body:**
```json
{
  "approved": true
}
```

**Response:**
```json
{
  "success": true
}
```

**Process Flow (Approval):**
1. Verify conversation is awaiting approval
2. Add `user_input: "approved"` event to Thread
3. Execute the approved tool call
4. Send `tool_result` event via SSE
5. Resume agent processing

**Process Flow (Denial):**
1. Verify conversation is awaiting approval
2. Add `user_input: "denied"` event to Thread
3. Resume agent processing (without executing the tool)

## Usage

### Prerequisites

- Node.js (v18 or higher)
- pnpm (v8 or higher)
- Redis server running on `localhost:6379` (or custom URL via `REDIS_URL`)
- Environment variables configured (see below)

### Environment Variables

Create a `.env` file in the repository root:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Notion API
NOTION_API_KEY=your_notion_api_key_here
NOTION_TASKS_DATABASE_ID=your_notion_tasks_database_id
NOTION_PROJECTS_DATABASE_ID=your_notion_projects_database_id

# Redis (optional, defaults to localhost:6379)
REDIS_URL=redis://localhost:6379

# Server Port (optional, defaults to 3001)
PORT=3001
```

### Running the Server

#### Development Mode

```bash
# Start Redis (if using Docker)
docker compose up -d redis

# Run development server with auto-reload
pnpm --filter @shochan_ai/web dev
```

Server starts at `http://localhost:3001` (default).

#### Production Build

```bash
# Build TypeScript
pnpm --filter @shochan_ai/web build

# Start production server
pnpm --filter @shochan_ai/web start
```

### Testing

```bash
# Run all tests
pnpm --filter @shochan_ai/web test

# Run tests in watch mode
pnpm --filter @shochan_ai/web test:watch
```

## Example Usage

### Using cURL

#### 1. Submit a Query

```bash
curl -X POST http://localhost:3001/api/agent/query \
  -H "Content-Type: application/json" \
  -d '{"message": "今日のタスクを10件教えて"}'
```

Response:
```json
{"conversationId": "f217bba2-68ea-4a75-9355-a686f4bc064b"}
```

#### 2. Stream Events

```bash
curl -N http://localhost:3001/api/stream/f217bba2-68ea-4a75-9355-a686f4bc064b
```

You'll see events streaming in real-time as the agent processes the query.

#### 3. Approve Tool Call (if needed)

```bash
curl -X POST http://localhost:3001/api/agent/approve/f217bba2-68ea-4a75-9355-a686f4bc064b \
  -H "Content-Type: application/json" \
  -d '{"approved": true}'
```

### Using JavaScript/TypeScript

```typescript
// Submit query
const queryResponse = await fetch('http://localhost:3001/api/agent/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '今日のタスクを10件教えて' }),
});
const { conversationId } = await queryResponse.json();

// Stream events
const eventSource = new EventSource(
  `http://localhost:3001/api/stream/${conversationId}`
);

eventSource.addEventListener('connected', (event) => {
  console.log('Connected:', JSON.parse(event.data));
});

eventSource.addEventListener('tool_call', (event) => {
  console.log('Tool Call:', JSON.parse(event.data));
});

eventSource.addEventListener('tool_result', (event) => {
  console.log('Tool Result:', JSON.parse(event.data));
});

eventSource.addEventListener('awaiting_approval', async (event) => {
  console.log('Approval Required:', JSON.parse(event.data));

  // Approve the tool call
  await fetch(`http://localhost:3001/api/agent/approve/${conversationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: true }),
  });
});

eventSource.addEventListener('error', (event) => {
  console.error('Error:', JSON.parse(event.data));
  eventSource.close();
});
```

## State Management

### Redis State Store

The `RedisStateStore` class manages conversation state persistence:

- **Key Pattern**: `shochan_ai:conversation:{conversationId}`
- **TTL**: 3600 seconds (1 hour)
- **Storage Format**: JSON-serialized Thread with events array

**Methods:**
- `connect()`: Connect to Redis server
- `disconnect()`: Disconnect from Redis
- `get(conversationId)`: Retrieve Thread by ID
- `set(conversationId, thread)`: Store Thread with TTL
- `delete(conversationId)`: Delete Thread
- `clear()`: Clear all conversations
- `list()`: List all conversation IDs

### Stream Manager

The `StreamManager` class manages active SSE sessions:

- **Session Storage**: In-memory Map keyed by `conversationId`
- **Event Broadcasting**: Send events to specific conversation sessions
- **Auto-cleanup**: Unregister sessions on connection close or error

**Methods:**
- `register(conversationId, session)`: Register SSE session
- `send(conversationId, event)`: Send event to session
- `unregister(conversationId)`: Clean up session
- `hasSession(conversationId)`: Check if session exists
- `getActiveSessionCount()`: Get count of active sessions
- `closeAll()`: Close all sessions (graceful shutdown)

## Agent Processing

The `processAgent` function in [agent.ts](src/routes/agent.ts) orchestrates the agent execution loop:

1. **Load Thread**: Retrieve current Thread state from Redis
2. **Generate Tool Call**: Use LLMAgentReducer to generate next tool call
3. **Stream Event**: Send `tool_call` event via SSE
4. **Check Terminal Conditions**:
   - Break if `done_for_now` or `request_more_information`
   - Break if `delete_task` (awaiting approval)
5. **Execute Tool**: Use NotionToolExecutor to execute tool
6. **Stream Result**: Send `tool_result` event via SSE
7. **Update State**: Apply reducer and save to Redis
8. **Repeat**: Continue loop until terminal condition or max iterations (50)

## Error Handling

### HTTP Error Responses

- **400 Bad Request**: Invalid request parameters
- **404 Not Found**: Conversation not found or no pending approval
- **500 Internal Server Error**: Server-side errors

### SSE Error Events

```json
{
  "type": "error",
  "timestamp": 1735646400000,
  "data": {
    "error": "Maximum iterations (50) reached without completion",
    "code": "AGENT_PROCESSING_FAILED"
  }
}
```

### Graceful Degradation

- If SSE session doesn't exist, events are logged but not sent
- If Redis connection fails, server exits with error code
- If tool execution fails, error event is sent via SSE

## Development

### Project Structure

```
packages/web/
├── src/
│   ├── server.ts              # Server entry point
│   ├── server.test.ts         # Server integration tests
│   ├── app.ts                 # Express app factory
│   ├── routes/
│   │   ├── agent.ts           # Agent router factory
│   │   ├── agent.test.ts      # Agent route tests
│   │   ├── stream.ts          # Stream router factory
│   │   └── stream.test.ts     # Stream route tests
│   ├── state/
│   │   ├── redis-store.ts     # Redis state persistence
│   │   └── redis-store.test.ts
│   ├── streaming/
│   │   ├── manager.ts         # SSE session manager
│   │   └── manager.test.ts
│   └── middleware/
│       └── fallback-handlers.ts
├── dist/                      # TypeScript build output
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Testing Strategy

- **Unit Tests**: Individual component testing (RedisStateStore, StreamManager)
- **Integration Tests**: Router testing with supertest
- **Test Fixtures**: Shared test utilities for Redis cleanup and SSE testing

### Code Quality

- **TypeScript Strict Mode**: Full type safety
- **Dependency Injection**: Factory functions for testable routers
- **Clean Architecture**: Separation of concerns (routes, state, streaming)
- **Error Logging**: Comprehensive console logging with emoji indicators

## Related Packages

- [`@shochan_ai/core`](../core/README.md): Business logic and agent core
- [`@shochan_ai/client`](../client/README.md): API clients for OpenAI and Notion
- [`@shochan_ai/cli`](../cli/README.md): Command-line interface

## License

ISC License
