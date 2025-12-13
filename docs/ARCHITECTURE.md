# Architecture Documentation

## Overview

Shochan AI is built as a conversational AI agent that bridges natural language requests with structured operations on external systems (Notion databases). The architecture follows the **Stateless Reducer Pattern**, prioritizing type safety, maintainability, scalability, and extensibility.

The project is structured as a **monorepo** using pnpm workspaces to enable code sharing and modular development.

## Monorepo Structure

```
shochan_ai/
├── packages/
│   ├── core/              # Business logic (zero dependencies)
│   │   ├── src/
│   │   │   ├── agent/     # Stateless Reducer, Orchestrator, Executors
│   │   │   ├── thread/    # Conversation state management
│   │   │   ├── state/     # State persistence interfaces
│   │   │   ├── types/     # Type definitions and guards
│   │   │   ├── utils/     # Utility functions
│   │   │   └── prompts/   # System prompts
│   │   └── package.json
│   │
│   ├── client/            # API clients (depends on core)
│   │   ├── src/
│   │   │   ├── openai.ts  # OpenAI client
│   │   │   └── notion.ts  # Notion client
│   │   └── package.json
│   │
│   └── cli/               # CLI implementation (depends on core + client)
│       ├── src/
│       │   ├── index.ts   # CLI entry point
│       │   └── agent/     # CLI-specific agent configuration
│       └── package.json
│
├── pnpm-workspace.yaml    # Workspace configuration
├── tsconfig.base.json     # Shared TypeScript config
└── package.json           # Root package with scripts
```

**Dependency Graph:**
```
packages/core (no dependencies)
    ↑
packages/client (depends on @shochan_ai/core)
    ↑
packages/cli (depends on @shochan_ai/core + @shochan_ai/client)
```

## High-Level Architecture

```mermaid
graph TD
    CLI[CLI Package<br/>packages/cli<br/>Entry point for user interaction] --> Orchestrator[Agent Orchestrator<br/>packages/core/src/agent<br/>Coordinates Reducer, Executor, StateStore]
    Orchestrator --> Reducer[LLM Agent Reducer<br/>packages/core/src/agent<br/>Stateless state transitions]
    Orchestrator --> Executor[Tool Executor<br/>packages/core/src/agent<br/>Side effects: API calls]
    Orchestrator --> StateStore[State Store<br/>packages/core/src/state<br/>State persistence]
    Reducer --> Thread[Thread<br/>packages/core/src/thread<br/>Event history data structure]
    Reducer --> OpenAI[OpenAI Client<br/>packages/client<br/>LLM integration]
    Executor --> Notion[Notion Client<br/>packages/client<br/>Notion API operations]

    style CLI fill:#e1f5fe
    style Orchestrator fill:#f3e5f5
    style Reducer fill:#fff3e0
    style Executor fill:#fce4ec
    style StateStore fill:#e8f5e8
    style Thread fill:#f1f8e9
    style OpenAI fill:#e8f5e8
    style Notion fill:#fce4ec
```

## Core Architecture Principles

### 1. Stateless Reducer Pattern

The architecture follows the **Stateless Reducer Pattern** where all state transitions are pure functions:

```typescript
(state, event) → newState
```

**Key Principles:**
- **Pure Functions**: No side effects in state transitions
- **Explicit State**: All state is passed explicitly, no hidden internal state
- **Reproducibility**: Every state transition is deterministic and traceable
- **Scalability**: State can be persisted and resumed on any server

### 2. Separation of Concerns

The architecture separates three key responsibilities:

1. **AgentReducer**: Pure state transitions (no side effects)
2. **ToolExecutor**: Side effects (API calls, I/O operations)
3. **AgentOrchestrator**: Coordination between Reducer, Executor, and StateStore

### 3. Type Safety

- **Discriminated Unions**: All events and tool calls use TypeScript discriminated unions
- **No `any`**: Strict type checking throughout the codebase
- **Runtime Validation**: Type guards for runtime type safety

## Core Components

### 1. CLI Interface (`packages/cli/src/index.ts`)

The command-line interface serves as the entry point for user interactions.

**Location:** `packages/cli/src/index.ts`

**Responsibilities:**
- Parse command-line arguments
- Initialize AgentOrchestrator with components
- Handle conversational loops for multi-turn interactions
- Manage user input/output for interactive sessions
- Implement CLI-specific business logic (approval flows, user prompts)

**Key Features:**
- Single-command execution mode
- Interactive conversation handling via recursion
- Approval flow for destructive operations (e.g., delete_task)
- Graceful error handling and process management
- Shebang support for direct execution (`#!/usr/bin/env node`)

**Package Configuration:**
```json
{
  "name": "@shochan_ai/cli",
  "bin": {
    "shochan-ai": "./dist/index.js"
  },
  "dependencies": {
    "@shochan_ai/core": "workspace:*",
    "@shochan_ai/client": "workspace:*"
  }
}
```

**Agent Loop Implementation:**
```typescript
// Add user input to thread
let currentThread = await orchestrator.processEvent(userInputEvent);

// Agent loop: LLM → Tool Execution → LLM
while (true) {
  // Generate next tool call via LLM
  const toolCallEvent = await reducer.generateNextToolCall(currentThread);

  if (!toolCallEvent) break;

  // CLI-specific logic: approval, termination, user input
  if (toolCall.intent === 'delete_task') {
    // Ask for approval
  }
  if (toolCall.intent === 'done_for_now') {
    // Display message and exit
  }
  if (toolCall.intent === 'request_more_information') {
    // Ask user and recurse
  }

  // Execute tool call
  currentThread = await orchestrator.executeToolCall(toolCallEvent);
}
```

### 2. Agent Orchestrator (`packages/core/src/agent/agent-orchestrator.ts`)

The central coordinator that manages the interaction between Reducer, Executor, and StateStore.

**Location:** `packages/core/src/agent/agent-orchestrator.ts`

**Package:** `@shochan_ai/core` (zero dependencies)

**Responsibilities:**
- Coordinate Reducer for state transitions
- Coordinate Executor for tool execution
- Manage state persistence via StateStore
- Provide clean API for event processing

**Core Methods:**
```typescript
class AgentOrchestrator {
  // Process an event (user input, etc.) through the reducer
  async processEvent(event: Event): Promise<Thread>

  // Execute a tool call via the executor
  async executeToolCall(toolCallEvent: ToolCallEvent): Promise<Thread>

  // Get current state
  getState(): Thread
}
```

**Design Pattern:**
The Orchestrator implements the **Mediator Pattern**, decoupling the Reducer, Executor, and StateStore from each other.

### 3. LLM Agent Reducer (`packages/core/src/agent/llm-agent-reducer.ts`)

Generic AgentReducer implementation that uses an LLM to determine next tool calls.

**Location:** `packages/core/src/agent/llm-agent-reducer.ts`

**Package:** `@shochan_ai/core` (zero dependencies)

**Responsibilities:**
- Implement pure state transitions (add events to thread)
- Generate next tool call via LLM
- Abstract LLM client interface for flexibility (OpenAI, Anthropic, etc.)

**Generic Type Constraints:**
```typescript
class LLMAgentReducer<
  TLLMClient extends {
    generateToolCall(params: {
      systemPrompt: string;
      inputMessages: Array<unknown>;
      tools?: Array<unknown>;
    }): Promise<{ toolCall: unknown | null }>;
  },
  TTools extends Array<unknown>
> implements AgentReducer<Thread, Event>
```

**Core Methods:**
```typescript
// Pure function: add event to thread state
reduce(state: Thread, event: Event): Thread

// Async LLM call: generate next tool call
async generateNextToolCall(state: Thread): Promise<ToolCallEvent | null>
```

### 4. Tool Executor (`packages/core/src/agent/tool-executor.ts`)

Interface for executing tools with side effects.

**Location:** `packages/core/src/agent/tool-executor.ts`

**Package:** `@shochan_ai/core` (zero dependencies)

**Responsibilities:**
- Define interface for tool execution
- Abstract side effects (API calls, I/O) from pure state transitions

**Interface:**
```typescript
interface ToolExecutor {
  execute(toolCall: ToolCall): Promise<ToolExecutionResult>;
}

type ToolExecutionResult =
  | { success: true; data: unknown }
  | { success: false; error: string };
```

**Implementation:** `NotionToolExecutor` (`packages/core/src/agent/notion-tool-executor.ts`)

**Supported Tools:**
- `get_tasks`: Retrieve tasks from Notion with filtering options
- `get_task_details`: Get detailed information about a specific task
- `create_task`: Create new tasks in Notion GTD system
- `update_task`: Modify existing tasks
- `delete_task`: Remove tasks (requires approval in CLI)
- `create_project`: Create new projects with importance levels
- `request_more_information`: Ask user for clarification (no API call)
- `done_for_now`: Provide final response to user (no API call)

### 5. Thread Management (`packages/core/src/thread/thread.ts`)

Immutable data structure for conversation state.

**Location:** `packages/core/src/thread/thread.ts`

**Package:** `@shochan_ai/core` (zero dependencies)

**Responsibilities:**
- Store conversation events in chronological order (immutable)
- Serialize conversation context for LLM consumption
- Provide recursive object serialization for complex data structures

**Event Structure:**
```typescript
type Event =
  | { type: 'user_input'; timestamp: number; data: string }
  | { type: 'tool_call'; timestamp: number; data: ToolCall }
  | { type: 'tool_response'; timestamp: number; data: unknown }
  | { type: 'error'; timestamp: number; data: { error: string } }
  | { type: 'complete'; timestamp: number; data: unknown }
  | { type: 'awaiting_approval'; timestamp: number; data: ToolCall };
```

**Serialization Features:**
- XML-based context serialization for LLM
- Recursive handling of nested objects and arrays
- Intelligent filtering of internal fields (e.g., 'intent')

**Example Serialization:**
```xml
<user_input>
今週のタスクを10件教えて
</user_input>

<get_tasks>
limit: 10
task_type: Today
</get_tasks>

<tool_response>
tasks: [
  {title: "レポート作成", scheduled_date: "2025-01-24"},
  {title: "会議準備", scheduled_date: "2025-01-25"}
]
</tool_response>
```

### 6. State Store (`packages/core/src/state/state-store.ts`)

Interface for state persistence with multiple implementations.

**Location:** `packages/core/src/state/state-store.ts`

**Package:** `@shochan_ai/core` (zero dependencies)

**Interface:**
```typescript
interface StateStore<T> {
  get(id: string): Promise<T | null>;
  set(id: string, state: T): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<Array<{ id: string; state: T }>>;
}
```

**Implementations:**
- **InMemoryStateStore** (`packages/core/src/state/in-memory-state-store.ts`): For CLI
- **RedisStateStore** (planned for Web): For production web deployment

### 7. External Clients

#### OpenAI Client (`packages/client/src/openai.ts`)

Handles integration with OpenAI's API via Responses API.

**Location:** `packages/client/src/openai.ts`

**Package:** `@shochan_ai/client` (depends on `@shochan_ai/core`)

**Responsibilities:**
- Generate structured function calls from natural language using GPT-4o
- Manage API communication with retry logic
- Handle rate limiting and error recovery

**Features:**
- OpenAI Responses API for server-side conversation management
- Automatic JSON parsing of function arguments
- Configurable retry mechanism (3 attempts with exponential backoff)
- Support for function calling with 8 tools
- Cost optimization via server-side conversation caching

#### Notion Client (`packages/client/src/notion.ts`)

Manages all interactions with Notion databases.

**Location:** `packages/client/src/notion.ts`

**Package:** `@shochan_ai/client` (depends on `@shochan_ai/core`)

**Responsibilities:**
- CRUD operations on tasks and projects
- Database querying with filtering and sorting
- Data transformation between internal and Notion formats

**Supported Operations:**
- Task creation with GTD categorization
- Task retrieval with advanced filtering options
- Task detail retrieval including page content
- Task updating (title, type, scheduled date, project, archive status)
- Task deletion with archival
- Project creation with importance levels
- Proper error handling and validation

### 8. Type System (`packages/core/src/types/`)

Comprehensive type definitions ensuring type safety across the application.

**Location:** `packages/core/src/types/`

**Package:** `@shochan_ai/core` (zero dependencies)

**Key Type Categories:**
- **Event Types**: Discriminated union of all event types
- **Tool Types**: Discriminated union of all tool calls
- **Notion Types**: Database schema and API response types
- **Task Types**: GTD system task categorizations
- **Tool Guards**: Runtime type validation functions

**Type Safety Features:**
- Strict TypeScript configuration
- Runtime type validation via type guards
- Discriminated unions for events and tool calls
- No use of `any` type

**Tool Call Discriminated Union:**
```typescript
type ToolCall =
  | { intent: 'create_task'; parameters: CreateTaskParams }
  | { intent: 'create_project'; parameters: CreateProjectParams }
  | { intent: 'update_task'; parameters: UpdateTaskParams }
  | { intent: 'delete_task'; parameters: DeleteTaskParams }
  | { intent: 'get_tasks'; parameters: GetTasksParams }
  | { intent: 'get_task_details'; parameters: GetTaskDetailsParams }
  | { intent: 'done_for_now'; parameters: DoneParams }
  | { intent: 'request_more_information'; parameters: RequestInfoParams };
```

### 9. Utilities (`packages/core/src/utils/`)

Supporting utilities for data processing and API interactions.

**Location:** `packages/core/src/utils/`

**Package:** `@shochan_ai/core` (zero dependencies)

**Components:**
- **Notion Query Builder**: Constructs complex database queries with filtering and sorting
- **Notion Task Parser**: Transforms Notion responses to internal format, includes block content parsing
- **Notion Utils**: Helper functions for API parameter construction and page updates

## Data Flow

### 1. Request Processing Flow

```mermaid
flowchart LR
    A[User Input] --> B[CLI]
    B --> C[AgentOrchestrator]
    C --> D[LLMAgentReducer]
    D --> E[LLM Client]
    E --> F[Tool Call Event]
    F --> C
    C --> G[ToolExecutor]
    G --> H[Notion Client]
    H --> I[Tool Response]
    I --> C
    C --> J[StateStore]
    J --> K[Updated Thread]
    K --> D
    D --> E
    E --> L[done_for_now]
    L --> B
    B --> M[User Output]

    style A fill:#e3f2fd
    style M fill:#e3f2fd
    style C fill:#f3e5f5
    style D fill:#fff3e0
    style G fill:#fce4ec
    style J fill:#e8f5e8
```

### 2. State Transition Flow

```mermaid
sequenceDiagram
    participant CLI
    participant Orchestrator
    participant Reducer
    participant Executor
    participant StateStore
    participant LLM
    participant NotionAPI

    CLI->>Orchestrator: processEvent(userInputEvent)
    Orchestrator->>Reducer: reduce(state, userInputEvent)
    Reducer-->>Orchestrator: newState (Thread)
    Orchestrator->>StateStore: setState(newState)
    StateStore-->>Orchestrator: success
    Orchestrator-->>CLI: Thread

    CLI->>Reducer: generateNextToolCall(state)
    Reducer->>LLM: generateToolCall(context, tools)
    LLM-->>Reducer: toolCall
    Reducer-->>CLI: ToolCallEvent

    CLI->>Orchestrator: executeToolCall(toolCallEvent)
    Orchestrator->>Reducer: reduce(state, toolCallEvent)
    Reducer-->>Orchestrator: newState
    Orchestrator->>Executor: execute(toolCall)
    Executor->>NotionAPI: API call
    NotionAPI-->>Executor: response
    Executor-->>Orchestrator: result
    Orchestrator->>Reducer: reduce(state, toolResponseEvent)
    Reducer-->>Orchestrator: newState
    Orchestrator->>StateStore: setState(newState)
    StateStore-->>Orchestrator: success
    Orchestrator-->>CLI: Thread
```

### 3. Conversation State Management

The system maintains conversation state through an event-driven model:

1. **User Input Events**: Capture user requests and responses
2. **Tool Call Events**: Record LLM decisions and tool invocations
3. **Tool Response Events**: Store external system responses
4. **Error Events**: Track errors and failures
5. **Complete Events**: Mark conversation completion

**Immutability:**
Every state transition creates a new `Thread` instance. The original state is never mutated.

```typescript
// Pure state transition
reduce(state: Thread, event: Event): Thread {
  return new Thread([...state.events, event]);
}
```

## Design Patterns

### 1. Stateless Reducer Pattern

**Implementation:**
```typescript
interface AgentReducer<TState, TEvent> {
  reduce(state: TState, event: TEvent): TState;
}
```

**Benefits:**
- Horizontal scalability (state can be persisted and resumed anywhere)
- Debuggability (state transitions are traceable)
- Testability (pure functions are easy to test)
- Time-travel debugging (state snapshots enable replay)

### 2. Mediator Pattern (Orchestrator)

The `AgentOrchestrator` mediates between:
- **Reducer**: State transitions
- **Executor**: Side effects
- **StateStore**: Persistence

**Benefits:**
- Decoupling of components
- Single point of coordination
- Easy to swap implementations

### 3. Strategy Pattern

The system uses strategy pattern for:
- **Tool Execution Strategies**: Different handling for different tool types
- **State Persistence Strategies**: InMemoryStateStore vs RedisStateStore
- **LLM Client Strategies**: OpenAI, Anthropic, or custom LLM clients

### 4. Command Pattern

Tool calls implement the command pattern:
- **Command Interface**: `ToolCall` discriminated union
- **Concrete Commands**: `CreateTaskTool`, `GetTasksTool`, etc.
- **Invoker**: `AgentOrchestrator` orchestrates execution
- **Receiver**: `NotionToolExecutor` executes actual operations

## Configuration Management

### Environment Variables

```env
OPENAI_API_KEY             # OpenAI API access
NOTION_API_KEY             # Notion integration token
NOTION_TASKS_DATABASE_ID   # Tasks database identifier
NOTION_PROJECTS_DATABASE_ID # Projects database identifier
```

### System Configuration

- **OpenAI Model**: gpt-4o (GPT-4 Optimized)
- **Max Tokens**: 1024 for function call generation
- **Retry Policy**: 3 attempts with exponential backoff
- **Default Limits**: 10 tasks per query, configurable up to 100
- **API Type**: OpenAI Responses API with server-side conversation storage

## Error Handling Strategy

### 1. Layered Error Handling

```mermaid
graph TD
    A[CLI Layer<br/>User-friendly error messages] --> B[Orchestrator Layer<br/>Coordination error recovery]
    B --> C[Reducer Layer<br/>Pure function guarantees]
    C --> D[Executor Layer<br/>API-specific error handling]
    D --> E[Client Layer<br/>Retry logic and validation]

    style A fill:#ffebee
    style B fill:#fff3e0
    style C fill:#e8f5e8
    style D fill:#f3e5f5
    style E fill:#e1f5fe
```

### 2. Error Types

- **Configuration Errors**: Missing environment variables
- **API Errors**: External service failures with retry logic
- **Validation Errors**: Invalid tool parameters or data structures
- **Business Logic Errors**: GTD system constraint violations

### 3. Recovery Mechanisms

- **Automatic Retry**: For transient API failures (Executor layer)
- **Error Events**: Errors are added to thread as events
- **Graceful Degradation**: Partial functionality when services are limited
- **User Feedback**: Clear error messages with suggested actions

## Performance Considerations

### 1. Stateless Design Benefits

- **No Server Affinity**: Requests can be handled by any server
- **Easy Scaling**: State can be persisted to Redis and resumed anywhere
- **Replay Capability**: State snapshots enable debugging and recovery

### 2. Memory Management

- **Conversation History**: Grows linearly with interaction length
- **Object Serialization**: Recursive but bounded by conversation depth
- **State Persistence**: Can be moved to external store (Redis) for production

### 3. Scalability Factors

- **Stateless Design**: Supports horizontal scaling
- **Pluggable StateStore**: InMemory for CLI, Redis for Web
- **Resource Usage**: Bounded by conversation length and tool complexity

## Security Considerations

### 1. API Key Management

- Environment variable storage only
- No key logging or persistence
- Secure client initialization patterns

### 2. Data Privacy

- State can be persisted (CLI: memory, Web: Redis)
- Notion data access limited to configured databases
- User data never logged or transmitted beyond necessary APIs

### 3. Input Validation

- Comprehensive type checking at API boundaries
- Runtime validation of tool parameters via type guards
- Sanitization of user inputs before external API calls

## Testing Strategy

### 1. Unit Testing

- Individual component testing with Vitest
- Mock external dependencies (OpenAI, Notion APIs) using Test Doubles
- Type guard validation testing
- Utility function testing

**Test Approach:**
- **Classical Testing**: Test real business logic with Test Doubles
- **Pure Function Testing**: Reducer tests are deterministic
- **Mock Verification**: Use `vi.fn()` to verify interactions

### 2. Integration Testing

- End-to-end CLI testing scenarios
- API client integration verification
- Error handling pathway testing

### 3. Type Testing

- TypeScript strict mode enforcement
- Runtime type validation testing
- Tool call structure validation

## Deployment & Operations

### 1. Build Process

**Monorepo Build Commands:**
```bash
# Build all packages
pnpm build          # Builds packages/core, packages/client, packages/cli

# Build specific package
pnpm --filter @shochan_ai/core build
pnpm --filter @shochan_ai/client build
pnpm --filter @shochan_ai/cli build

# Run CLI
pnpm cli "your message here"

# Testing
pnpm test           # Run all tests (vitest)
pnpm test:watch     # Watch mode

# Code Quality
pnpm check          # Biome linting and formatting
pnpm check:fix      # Auto-fix issues
```

**Build Order:**
TypeScript project references ensure correct build order:
1. `packages/core` (no dependencies)
2. `packages/client` (depends on core)
3. `packages/cli` (depends on core + client)

### 2. Runtime Requirements

- Node.js 18+ environment
- pnpm 8+ (for workspace support)
- Environment variable configuration (`.env` in repository root)
- Network access to OpenAI and Notion APIs

**Environment Variables:**
The CLI automatically loads `.env` from the repository root:
```typescript
// packages/cli/src/index.ts
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });
```

### 3. Monitoring

- Console-based logging for development
- Error tracking through CLI exit codes
- StateStore enables conversation replay for debugging

## Future Extensibility

### 1. Web UI Integration

The Stateless Reducer architecture is designed for web deployment:

```mermaid
graph TD
    WebUI[Web UI<br/>Next.js] --> API[Web API<br/>Express]
    API --> Orchestrator[AgentOrchestrator]
    Orchestrator --> Reducer[LLMAgentReducer]
    Orchestrator --> Executor[NotionToolExecutor]
    Orchestrator --> Redis[RedisStateStore]

    style WebUI fill:#e1f5fe
    style API fill:#f3e5f5
    style Orchestrator fill:#fff3e0
    style Redis fill:#e8f5e8
```

**Key Features for Web:**
- **REST API**: `POST /api/agent/query` returns conversation ID
- **SSE Streaming**: `GET /api/stream/:conversationId` for real-time updates
- **Redis StateStore**: Horizontal scaling with state persistence
- **Launch/Pause/Resume**: Long-running tasks and approval flows

### 2. New Tool Integration

The architecture supports easy addition of new tools:

1. Define tool interface in `packages/core/src/types/tools.ts`
2. Add type guard function in `packages/core/src/types/toolGuards.ts`
3. Add tool to system prompt and tool definitions
4. Implement tool execution in `ToolExecutor`
5. Update Notion client if needed

### 3. Additional Clients

New external service integration follows the pattern:

1. Create client class in `packages/client/src/`
2. Define service-specific types in `packages/core/src/types/`
3. Implement ToolExecutor for the new service
4. Add error handling and retry logic

### 4. Alternative LLM Providers

The generic `LLMAgentReducer` supports any LLM client:

```typescript
// OpenAI
const reducer = new LLMAgentReducer(openaiClient, tools, buildPrompt);

// Anthropic (future)
const reducer = new LLMAgentReducer(anthropicClient, tools, buildPrompt);

// Custom
const reducer = new LLMAgentReducer(customClient, tools, buildPrompt);
```

## Conclusion

Shochan AI's architecture prioritizes **statelessness**, **type safety**, and **scalability** through the Stateless Reducer Pattern. The monorepo structure enables code sharing and modular development, while maintaining clean separation of concerns between pure state transitions (Reducer), side effects (Executor), and coordination (Orchestrator). This foundation supports both CLI and future Web UI deployment with minimal changes to core business logic.
