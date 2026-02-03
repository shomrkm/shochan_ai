---
name: agent-architecture
description: Best practices for implementing 12-factor agents pattern. Use when building stateless agent reducers, orchestrators, tool executors, or working with Thread-based event sourcing.
allowed-tools: Read, Grep, Glob, Bash
---

# Agent Architecture - 12-Factor Agents Pattern

**Context**: Best practices for building AI agents following the 12-factor agents pattern in the shochan_ai system.

## Architecture Overview

The agent system follows **12-factor agents principles** for building reliable, maintainable AI agents:

```
┌─────────────────────────────────────────────────────────────────┐
│                     AgentOrchestrator                           │
│         (Mediator - coordinates components)                     │
├─────────────────────────────────────────────────────────────────┤
│                            │                                    │
│  ┌────────────────┐        │        ┌────────────────┐          │
│  │  AgentReducer  │◄───────┼───────►│  ToolExecutor  │          │
│  │  (Pure/Stateless)│      │        │  (Side Effects)│          │
│  └────────────────┘        │        └────────────────┘          │
│          │                 │               │                    │
│          ▼                 ▼               ▼                    │
│  ┌────────────────┐  ┌──────────┐  ┌────────────────┐           │
│  │     Thread     │  │StateStore│  │ External APIs  │           │
│  │ (Immutable)    │  │(Persist) │  │ (Notion, etc.) │           │
│  └────────────────┘  └──────────┘  └────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Thread (Immutable Event Store)

The `Thread` class maintains an immutable sequence of events. Every state change is captured as an event.

**Implementation**:
```typescript
// packages/core/src/thread/thread.ts
import type { Event } from '../types/event';
import { isToolCallEvent } from '../types/event';

export class Thread {
  readonly events: readonly Event[];

  constructor(events: readonly Event[]) {
    this.events = [...events]; // Immutable copy
  }

  get latestEvent(): Event | undefined {
    return this.events[this.events.length - 1];
  }

  // Serialize for LLM context
  serializeForLLM(): string {
    return this.events.map((e) => this.serializeOneEvent(e)).join('\n');
  }
}
```

**Key Principles**:
- Events are immutable once added
- Thread is the single source of truth for conversation state
- Serialization produces XML-based context for LLM

### 2. AgentReducer Interface (Pure State Transitions)

The reducer handles state transitions WITHOUT side effects.

**Interface**:
```typescript
// packages/core/src/agent/agent-reducer.ts
export interface AgentReducer<TState, TEvent> {
  /**
   * Pure function: (state, event) => newState
   * No side effects, no async operations
   */
  reduce(state: TState, event: TEvent): TState;
}
```

**LLMAgentReducer Implementation**:
```typescript
// packages/core/src/agent/llm-agent-reducer.ts
export class LLMAgentReducer<TLLMClient, TTools>
  implements AgentReducer<Thread, Event>
{
  constructor(
    private readonly llmClient: TLLMClient,
    private readonly tools: TTools,
    private readonly systemPromptBuilder: (threadContext: string) => string,
  ) {}

  // Pure function - adds event to thread
  reduce(state: Thread, event: Event): Thread {
    return new Thread([...state.events, event]);
  }

  // Generates next tool call via LLM
  async generateNextToolCall(state: Thread): Promise<ToolCallEvent | null> {
    const threadContext = state.serializeForLLM();
    const systemPrompt = this.systemPromptBuilder(threadContext);

    const { toolCall } = await this.llmClient.generateToolCall({
      systemPrompt,
      inputMessages: [{ role: 'user', content: systemPrompt }],
      tools: this.tools,
    });

    if (!toolCall) return null;

    return {
      type: 'tool_call',
      timestamp: Date.now(),
      data: toolCall,
    };
  }
}
```

### 3. ToolExecutor Interface (Side Effects)

The executor handles all side effects (API calls, database operations).

**Interface**:
```typescript
// packages/core/src/agent/tool-executor.ts
import type { Event, ToolCallEvent } from '../types/event';

export interface ToolExecutionResult {
  event: Event;
  requiresApproval?: boolean;
}

export interface ToolExecutor {
  /**
   * Executes tool call and returns result event.
   * This is where side effects happen (API calls, DB writes).
   */
  execute(toolCall: ToolCallEvent['data']): Promise<ToolExecutionResult>;
}
```

**NotionToolExecutor Implementation**:
```typescript
// packages/core/src/agent/notion-tool-executor.ts
export class NotionToolExecutor implements ToolExecutor {
  constructor(private readonly notionClient: NotionClient) {}

  async execute(toolCall: ToolCall): Promise<ToolExecutionResult> {
    switch (toolCall.intent) {
      case 'get_tasks':
        return this.executeGetTasks(toolCall.parameters);
      case 'create_task':
        return this.executeCreateTask(toolCall.parameters);
      case 'delete_task':
        return this.executeDeleteTask(toolCall.parameters);
      // ... other tools
    }
  }
}
```

### 4. AgentOrchestrator (Mediator Pattern)

The orchestrator coordinates all components without them knowing about each other.

**Implementation**:
```typescript
// packages/core/src/agent/agent-orchestrator.ts
export class AgentOrchestrator {
  constructor(
    private readonly reducer: AgentReducer<Thread, Event>,
    private readonly executor: ToolExecutor,
    private readonly stateStore: StateStore<Thread>,
  ) {}

  async processEvent(event: Event): Promise<Thread> {
    const currentState = this.stateStore.getState();
    const newState = this.reducer.reduce(currentState, event);
    this.stateStore.setState(newState);
    return newState;
  }

  async executeToolCall(toolCallEvent: ToolCallEvent): Promise<Thread> {
    // 1. Add tool call event to state
    await this.processEvent(toolCallEvent);

    // 2. Execute the tool (side effects)
    const result = await this.executor.execute(toolCallEvent.data);

    // 3. Add result event to state
    const finalState = await this.processEvent(result.event);

    return finalState;
  }

  getState(): Thread {
    return this.stateStore.getState();
  }
}
```

### 5. StateStore Interface (Persistence)

State can be stored in memory, Redis, or other backends.

**Interface**:
```typescript
// packages/core/src/state/state-store.ts
export interface StateStore<T> {
  getState(): T;
  setState(state: T): void;
}
```

**In-Memory Implementation**:
```typescript
// packages/core/src/state/in-memory-state-store.ts
export class InMemoryStateStore<T> implements StateStore<T> {
  private state: T;

  constructor(initialState: T) {
    this.state = initialState;
  }

  getState(): T {
    return this.state;
  }

  setState(state: T): void {
    this.state = state;
  }
}
```

## Event Types

The system uses discriminated unions for type-safe event handling.

**Event Definitions**:
```typescript
// packages/core/src/types/event.ts
interface BaseEvent<T extends string> {
  type: T;
  timestamp: number;
}

export interface UserInputEvent extends BaseEvent<'user_input'> {
  data: string;
}

export interface ToolCallEvent extends BaseEvent<'tool_call'> {
  data: ToolCall;
}

export interface ToolResponseEvent extends BaseEvent<'tool_response'> {
  data: unknown;
}

export interface ErrorEvent extends BaseEvent<'error'> {
  data: { error: string; code?: string };
}

export interface AwaitingApprovalEvent extends BaseEvent<'awaiting_approval'> {
  data: ToolCall;
}

export interface CompleteEvent extends BaseEvent<'complete'> {
  data: { message: string };
}

export type Event =
  | UserInputEvent
  | ToolCallEvent
  | ToolResponseEvent
  | ErrorEvent
  | AwaitingApprovalEvent
  | CompleteEvent;
```

**Type Guards**:
```typescript
export function isToolCallEvent(event: Event): event is ToolCallEvent {
  return event.type === 'tool_call';
}

export function isCompleteEvent(event: Event): event is CompleteEvent {
  return event.type === 'complete';
}
```

## Agent Loop Pattern

The typical agent execution flow:

```typescript
async function runAgentLoop(userMessage: string): Promise<string> {
  // 1. Initialize state
  const thread = new Thread([]);
  const stateStore = new InMemoryStateStore(thread);

  const orchestrator = new AgentOrchestrator(
    reducer,
    executor,
    stateStore,
  );

  // 2. Add user input
  await orchestrator.processEvent({
    type: 'user_input',
    timestamp: Date.now(),
    data: userMessage,
  });

  // 3. Agent loop
  while (true) {
    const toolCallEvent = await reducer.generateNextToolCall(
      orchestrator.getState(),
    );

    if (!toolCallEvent) {
      break; // No more tool calls needed
    }

    // 4. Execute tool
    const state = await orchestrator.executeToolCall(toolCallEvent);

    // 5. Check for completion
    const latestEvent = state.latestEvent;
    if (isCompleteEvent(latestEvent)) {
      return latestEvent.data.message;
    }
  }

  return 'Agent loop completed without response';
}
```

## Best Practices

### 1. Separation of Concerns

| Component | Responsibility | Side Effects |
|-----------|---------------|--------------|
| Thread | State storage | None |
| AgentReducer | State transitions | None |
| ToolExecutor | Tool execution | All side effects |
| StateStore | Persistence | I/O only |
| Orchestrator | Coordination | None (delegates) |

### 2. Immutability

```typescript
// CORRECT: Create new Thread
reduce(state: Thread, event: Event): Thread {
  return new Thread([...state.events, event]);
}

// WRONG: Mutate existing state
reduce(state: Thread, event: Event): Thread {
  state.events.push(event); // Mutation!
  return state;
}
```

### 3. Event Sourcing

- Every action is recorded as an event
- State can be reconstructed by replaying events
- Enables debugging, auditing, and time-travel

### 4. Human-in-the-Loop

```typescript
// Check for dangerous operations
if (toolCall.intent === 'delete_task') {
  return {
    event: {
      type: 'awaiting_approval',
      timestamp: Date.now(),
      data: toolCall,
    },
    requiresApproval: true,
  };
}
```

## Testing Patterns

### Unit Testing Reducer

```typescript
describe('LLMAgentReducer', () => {
  it('adds event to thread immutably', () => {
    const reducer = new LLMAgentReducer(mockClient, tools, promptBuilder);
    const initialThread = new Thread([]);

    const event: UserInputEvent = {
      type: 'user_input',
      timestamp: Date.now(),
      data: 'Hello',
    };

    const newThread = reducer.reduce(initialThread, event);

    expect(initialThread.events).toHaveLength(0); // Unchanged
    expect(newThread.events).toHaveLength(1);
    expect(newThread.events[0]).toEqual(event);
  });
});
```

### Integration Testing Orchestrator

```typescript
describe('AgentOrchestrator', () => {
  it('coordinates reducer and executor', async () => {
    const mockExecutor: ToolExecutor = {
      execute: vi.fn().mockResolvedValue({
        event: { type: 'tool_response', timestamp: Date.now(), data: [] },
      }),
    };

    const orchestrator = new AgentOrchestrator(reducer, mockExecutor, stateStore);

    const toolCallEvent: ToolCallEvent = {
      type: 'tool_call',
      timestamp: Date.now(),
      data: { intent: 'get_tasks', parameters: {} },
    };

    await orchestrator.executeToolCall(toolCallEvent);

    expect(mockExecutor.execute).toHaveBeenCalledWith(toolCallEvent.data);
  });
});
```

## Related Documentation

- Thread Implementation: `/packages/core/src/thread/thread.ts`
- Orchestrator: `/packages/core/src/agent/agent-orchestrator.ts`
- LLM Reducer: `/packages/core/src/agent/llm-agent-reducer.ts`
- Tool Executor: `/packages/core/src/agent/notion-tool-executor.ts`
- Event Types: `/packages/core/src/types/event.ts`
- 12-Factor Agents Reference: https://github.com/humanlayer/12-factor-agents
