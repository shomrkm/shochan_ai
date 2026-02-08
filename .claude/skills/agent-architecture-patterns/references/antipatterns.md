# Common Anti-Patterns

Anti-patterns that violate 12-factor principles and how to fix them.

## Anti-Pattern 1: Text Parsing Hell

**Problem**: Parsing LLM text outputs with regex instead of using structured outputs.

```typescript
// ❌ BAD: Text parsing
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Create a task' }]
});

const text = response.choices[0].message.content;
const match = text.match(/ACTION: (\w+)\nPARAMS: (.*)/);
const action = match[1];
const params = JSON.parse(match[2]); // Fragile!
```

**Why It's Bad**:
- Brittle - breaks if LLM changes output format
- Error-prone - regex failures are common
- Hard to validate - no schema enforcement

**✅ FIX: Use structured outputs**

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Create a task' }],
  tools: [
    {
      type: 'function',
      function: {
        name: 'create_task',
        description: 'Create a new task',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            dueDate: { type: 'string' }
          },
          required: ['title']
        }
      }
    }
  ]
});

const toolCall = response.choices[0].message.tool_calls?.[0];
// Structured, type-safe, validated
```

**Violations**: Factor 1 (Natural Language to Tool Calls)

## Anti-Pattern 2: Framework Lock-In

**Problem**: Using frameworks that hide prompts and context management.

```typescript
// ❌ BAD: Framework controls everything
const agent = new MagicFramework({
  role: 'task assistant',
  tools: [...],
  // Where's the actual prompt? Hidden in framework!
});

const result = await agent.run(userInput);
// Can't see what was sent to LLM
```

**Why It's Bad**:
- Can't see or control prompts
- Hard to debug
- Difficult to optimize
- Framework updates can break behavior

**✅ FIX: Own your prompts**

```typescript
const SYSTEM_PROMPT = `You are a task management assistant.
Help users organize their tasks.

Available tools: get_tasks, create_task, update_task.`;

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userInput }
  ],
  tools: [...] // Explicit tools
});
// Full visibility and control
```

**Violations**: Factor 2 (Own Your Prompts)

## Anti-Pattern 3: Context Bloat

**Problem**: Accumulating unlimited message history without management.

```typescript
// ❌ BAD: Unlimited context accumulation
class ChatAgent {
  private messages: Message[] = [];

  async chat(userMessage: string) {
    this.messages.push({ role: 'user', content: userMessage });

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: this.messages // Growing forever!
    });

    this.messages.push(response.choices[0].message);
    return response;
  }
}
```

**Why It's Bad**:
- Exceeds context window limits
- Expensive (costs scale with tokens)
- Slower responses
- Includes irrelevant information

**✅ FIX: Manage context window**

```typescript
class ChatAgent {
  private readonly MAX_MESSAGES = 10;
  private messages: Message[] = [];

  async chat(userMessage: string) {
    this.messages.push({ role: 'user', content: userMessage });

    // Keep only recent messages
    const contextMessages =
      this.messages.length > this.MAX_MESSAGES
        ? [
            { role: 'system', content: 'Summary: ...' },
            ...this.messages.slice(-this.MAX_MESSAGES)
          ]
        : this.messages;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: contextMessages
    });

    this.messages.push(response.choices[0].message);
    return response;
  }
}
```

**Violations**: Factor 3 (Own Your Context Window)

## Anti-Pattern 4: Vague Tool Schemas

**Problem**: Tool parameters are too generic or poorly documented.

```typescript
// ❌ BAD: Vague schema
const tools = [
  {
    type: 'function',
    function: {
      name: 'do_thing',
      description: 'Does something',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string' }, // What data?
          options: { type: 'object' } // What options?
        }
      }
    }
  }
];
```

**Why It's Bad**:
- LLM doesn't know what to send
- High error rate
- Poor validation
- Ambiguous behavior

**✅ FIX: Specific, descriptive schemas**

```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task in the task management system',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Task title (1-255 characters)'
          },
          type: {
            type: 'string',
            enum: ['Today', 'Next Actions', 'Someday / Maybe'],
            description: 'Task type category'
          },
          dueDate: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: 'Due date in YYYY-MM-DD format'
          }
        },
        required: ['title', 'type']
      }
    }
  }
];
```

**Violations**: Factor 4 (Tools Are Structured Outputs)

## Anti-Pattern 5: State Drift

**Problem**: Agent state and business state are separate and can diverge.

```typescript
// ❌ BAD: Separate state stores
class Agent {
  private agentState = { currentStep: 0, context: [] }; // In memory

  async execute() {
    // Update agent state
    this.agentState.currentStep++;

    // Update business state (separate operation!)
    await database.tasks.create({ title: 'New task' });

    // States can drift if one fails!
  }
}
```

**Why It's Bad**:
- State can become inconsistent
- Hard to recover from failures
- Debugging is difficult
- No atomic updates

**✅ FIX: Unified state updates**

```typescript
class Agent {
  async execute(executionId: string) {
    await database.transaction(async (tx) => {
      // Update agent execution state
      await tx.executions.update(executionId, {
        currentStep: execution.currentStep + 1,
        status: 'in_progress'
      });

      // Update business state in same transaction
      await tx.tasks.create({
        title: 'New task',
        executionId // Link to execution
      });

      // Both succeed or both fail - atomic!
    });
  }
}
```

**Violations**: Factor 5 (Unify Execution and Business State)

## Anti-Pattern 6: No Pause Capability

**Problem**: Agents run to completion with no way to pause.

```typescript
// ❌ BAD: No pause capability
async function runAgent(input: string) {
  let done = false;

  while (!done) {
    const response = await callLLM();
    const result = await executeTool(response);
    done = result.isComplete;
  }

  return 'Done'; // No way to pause mid-execution!
}
```

**Why It's Bad**:
- Can't implement human-in-the-loop
- Can't handle rate limits gracefully
- All-or-nothing execution
- Resource inefficient

**✅ FIX: Explicit pause/resume**

```typescript
class PausableAgent {
  async launch(input: string): Promise<string> {
    const execution = await this.createExecution(input);
    return execution.id;
  }

  async step(executionId: string): Promise<{ done: boolean; needsPause: boolean }> {
    const execution = await this.loadExecution(executionId);

    const response = await callLLM(execution.context);

    if (response.needsApproval) {
      await this.pause(executionId);
      return { done: false, needsPause: true };
    }

    await executeTool(response);
    return { done: response.isComplete, needsPause: false };
  }

  async resume(executionId: string, input?: string) {
    const execution = await this.loadExecution(executionId);
    if (input) {
      execution.context.push({ role: 'user', content: input });
    }
    return this.step(executionId);
  }
}
```

**Violations**: Factor 6 (Launch/Pause/Resume APIs)

## Anti-Pattern 7: Special Human Handling

**Problem**: Human interactions require special code paths.

```typescript
// ❌ BAD: Special handling for humans
async function executeAction(action: Action) {
  if (action.type === 'create_task') {
    return await createTask(action.params);
  } else if (action.requiresHumanApproval) {
    // Special code path!
    await sendEmail(admin, action);
    await waitForApproval();
    return await executeAction(action); // Then retry
  }
}
```

**Why It's Bad**:
- Inconsistent patterns
- Hard to track human interactions
- Special code paths increase complexity

**✅ FIX: Human contact as a tool**

```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'request_approval',
      description: 'Request human approval',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          reason: { type: 'string' }
        }
      }
    }
  }
];

async function executeTool(toolCall: ToolCall) {
  if (toolCall.function.name === 'request_approval') {
    await this.notifyHuman(toolCall.function.arguments);
    await this.pause();
    return { status: 'pending_approval' };
  }

  // All tools handled the same way
  return this.toolRegistry.execute(toolCall);
}
```

**Violations**: Factor 7 (Contact Humans with Tool Calls)

## Anti-Pattern 8: LLM for Everything

**Problem**: Every request goes through the LLM, even simple ones.

```typescript
// ❌ BAD: LLM decides everything
async function handleRequest(message: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }],
    tools: allTools
  });

  return executeTool(response.choices[0].message.tool_calls[0]);
}

// Even for "/help" command!
await handleRequest('/help'); // Wastes money and time
```

**Why It's Bad**:
- Expensive - LLM calls cost money
- Slow - adds latency
- Unreliable - LLM might choose wrong action
- Unnecessary - deterministic logic is better

**✅ FIX: Deterministic routing first**

```typescript
async function handleRequest(message: string, context: Context) {
  // Deterministic routing for known patterns
  if (message.startsWith('/help')) {
    return this.showHelp();
  }

  if (message.startsWith('/cancel')) {
    return this.cancelCurrentAction(context);
  }

  if (context.awaitingConfirmation) {
    return this.handleConfirmation(message);
  }

  // LLM only for ambiguous cases
  return this.llmDecision(message, context);
}
```

**Violations**: Factor 8 (Own Your Control Flow)

## Anti-Pattern 9: Verbose Error Context

**Problem**: Adding full stack traces and verbose errors to context.

```typescript
// ❌ BAD: Verbose errors
try {
  await createTask(params);
} catch (error) {
  messages.push({
    role: 'system',
    content: `Error occurred:

${error.stack}

Environment: ${JSON.stringify(process.env)}
Request: ${JSON.stringify(params)}
Timestamp: ${new Date().toISOString()}
...` // 500+ tokens!
  });
}
```

**Why It's Bad**:
- Wastes tokens
- Costs more money
- LLM doesn't need stack traces
- Reduces space for useful context

**✅ FIX: Compact, actionable errors**

```typescript
try {
  await createTask(params);
} catch (error) {
  messages.push({
    role: 'system',
    content: compactError(error, 'create_task')
  });
}

function compactError(error: Error, operation: string): string {
  return `${operation} failed: ${error.message}.
Check: input format, permissions, resource availability.`;
}
// ~30 tokens instead of 500+
```

**Violations**: Factor 9 (Compact Errors into Context)

## Anti-Pattern 10: Universal Agent

**Problem**: One agent that handles everything.

```typescript
// ❌ BAD: Universal agent
class UniversalAgent {
  async execute(request: string) {
    // Handles tasks, projects, calendar, email, notes, files...
    // Massive system prompt (2000+ words)
    // 50+ tools available
    // Confused decision making
  }
}
```

**Why It's Bad**:
- Low quality - too much scope
- Expensive - large prompts
- Slow - too many tools to consider
- Hard to maintain

**✅ FIX: Specialized agents**

```typescript
class TaskAgent {
  // Only handles task management
  // Focused system prompt (200 words)
  // 5 task-specific tools
  async execute(request: string) {
    // High quality, fast, cheap
  }
}

class ProjectAgent {
  // Only handles projects
  async execute(request: string) {
    // Specialized for project management
  }
}

// Route to appropriate agent
function route(request: string): Agent {
  const category = classifyRequest(request);
  return agentRegistry.get(category);
}
```

**Violations**: Factor 10 (Small, Focused Agents)

## Anti-Pattern 11: Interface Coupling

**Problem**: Agent logic is tightly coupled to one interface.

```typescript
// ❌ BAD: Coupled to HTTP
class WebAgent {
  async handleHTTPRequest(req: Request, res: Response) {
    const userMessage = req.body.message;

    // Business logic mixed with HTTP handling
    const result = await this.processMessage(userMessage);

    res.json(result);
    // Can't use from CLI, webhook, cron, etc.
  }
}
```

**Why It's Bad**:
- Can only trigger from one place
- Hard to test
- Duplicated logic for new interfaces
- Not reusable

**✅ FIX: Decouple from trigger mechanism**

```typescript
class AgentCore {
  // Pure business logic
  async processMessage(message: string, userId: string): Promise<Result> {
    // No knowledge of HTTP, webhooks, etc.
    return this.executeWorkflow(message, userId);
  }
}

// Trigger adapters
class HTTPAdapter {
  constructor(private agent: AgentCore) {}

  async handle(req: Request, res: Response) {
    const result = await this.agent.processMessage(req.body.message, req.user.id);
    res.json(result);
  }
}

class WebhookAdapter {
  constructor(private agent: AgentCore) {}

  async handle(webhook: WebhookPayload) {
    const result = await this.agent.processMessage(webhook.text, webhook.user_id);
    await this.sendResponse(result);
  }
}
```

**Violations**: Factor 11 (Trigger from Anywhere)

## Anti-Pattern 12: Stateful Singleton

**Problem**: Agent stores mutable state in class properties.

```typescript
// ❌ BAD: Stateful singleton
class Agent {
  private currentUser: string;
  private conversationHistory: Message[] = [];

  async process(message: string) {
    this.conversationHistory.push({ role: 'user', content: message });
    // State shared across all requests!
    // Can't scale horizontally
    // Can't replay
  }
}

const agent = new Agent(); // Single instance
```

**Why It's Bad**:
- Can't scale (single instance)
- State leaks between users
- Hard to test
- Can't replay executions

**✅ FIX: Stateless with explicit state**

```typescript
interface AgentState {
  userId: string;
  messages: Message[];
  context: Record<string, unknown>;
}

class StatelessAgent {
  // Pure function: (state, input) => (newState, output)
  async process(
    state: AgentState,
    input: string
  ): Promise<{ state: AgentState; output: string }> {
    const newMessages = [...state.messages, { role: 'user', content: input }];

    const response = await this.llm.generate(newMessages);

    const newState: AgentState = {
      ...state,
      messages: [...newMessages, response]
    };

    return {
      state: newState,
      output: response.content
    };
  }
}

// Can run multiple instances, easy to test, replayable
```

**Violations**: Factor 12 (Stateless Reducer Pattern)

## Summary: Spotting Anti-Patterns

**Quick questions to identify anti-patterns:**

1. Are you parsing LLM text with regex? → Anti-pattern 1
2. Can you see the exact prompts? → Anti-pattern 2
3. Does context grow forever? → Anti-pattern 3
4. Are tool schemas vague? → Anti-pattern 4
5. Can state become inconsistent? → Anti-pattern 5
6. Can you pause execution? → Anti-pattern 6
7. Is human contact special-cased? → Anti-pattern 7
8. Does `/help` call the LLM? → Anti-pattern 8
9. Are stack traces in context? → Anti-pattern 9
10. Does one agent do everything? → Anti-pattern 10
11. Can you trigger from CLI and API? → Anti-pattern 11
12. Is state in class properties? → Anti-pattern 12

If you answered "yes" to any, consult this guide for the fix!
