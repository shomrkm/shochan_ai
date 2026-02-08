# 12-Factor Agents: Principles

This document provides detailed explanations of the 12 factors for building production-grade LLM applications.

## Factor 1: Natural Language to Tool Calls

**Principle**: Convert LLM outputs into structured function calls rather than parsing unstructured text.

**Why It Matters**:
- Structured outputs are deterministic and type-safe
- Eliminates brittle text parsing logic
- Enables proper error handling and validation

**Implementation**:
Use OpenAI's function calling or tool calling features to get structured JSON outputs:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_tasks',
        description: 'Retrieve tasks from the database',
        parameters: {
          type: 'object',
          properties: {
            filter: { type: 'string' },
            limit: { type: 'number' }
          }
        }
      }
    }
  ]
});

const toolCall = response.choices[0].message.tool_calls?.[0];
```

**Key Takeaway**: Treat the LLM as a decision-making layer that outputs structured actions, not free-form text to be parsed.

## Factor 2: Own Your Prompts

**Principle**: Maintain direct control over prompt engineering rather than relying on framework abstractions.

**Why It Matters**:
- Prompts are the most critical part of agent quality
- Framework abstractions hide the actual prompts from you
- Direct control enables rapid iteration and debugging

**Implementation**:
- Store prompts as template strings in your codebase
- Use version control for prompt changes
- Make prompts visible and auditable

```typescript
const SYSTEM_PROMPT = `You are a task management assistant.
Your role is to help users organize their tasks.

Available tools:
- get_tasks: Retrieve tasks
- create_task: Create a new task
- update_task: Modify an existing task

Always use the appropriate tool for the user's request.`;

const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: userMessage }
];
```

**Key Takeaway**: Prompts are code. Treat them like first-class code assets, not configuration buried in frameworks.

## Factor 3: Own Your Context Window

**Principle**: Deliberately manage what information reaches the LLM (context engineering).

**Why It Matters**:
- Context window is limited and expensive
- Irrelevant information degrades decision quality
- Strategic context selection improves performance

**Implementation**:
- Curate message history selectively
- Summarize or truncate old messages
- Include only relevant tool results
- Use structured context formats

```typescript
function buildContext(userQuery: string, relevantHistory: Message[]): Message[] {
  // Only include last 5 relevant messages
  const recentMessages = relevantHistory.slice(-5);

  // Summarize older context if needed
  const summary = summarizeOlderMessages(relevantHistory.slice(0, -5));

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(summary ? [{ role: 'system', content: `Previous context: ${summary}` }] : []),
    ...recentMessages,
    { role: 'user', content: userQuery }
  ];
}
```

**Key Takeaway**: The context window is a scarce resource. Curate it deliberately.

## Factor 4: Tools Are Structured Outputs

**Principle**: Treat tool definitions as output schema specifications, not just function signatures.

**Why It Matters**:
- Tool schemas guide the LLM's output format
- Well-designed schemas reduce errors
- Schemas serve as contracts between LLM and executor

**Implementation**:
Design tool schemas with validation in mind:

```typescript
const CreateTaskTool = {
  type: 'function' as const,
  function: {
    name: 'create_task',
    description: 'Create a new task in the database',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Task title (required, 1-255 characters)'
        },
        type: {
          type: 'string',
          enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routine'],
          description: 'Task type category'
        },
        scheduledDate: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'Scheduled date in YYYY-MM-DD format'
        }
      },
      required: ['title', 'type', 'scheduledDate']
    }
  }
};
```

**Key Takeaway**: Tool definitions are how you communicate expected output format to the LLM.

## Factor 5: Unify Execution and Business State

**Principle**: Keep agent state synchronized with application state.

**Why It Matters**:
- Prevents state drift between agent and application
- Enables recovery from failures
- Simplifies debugging and monitoring

**Implementation**:
Store agent execution state alongside business data:

```typescript
interface AgentExecution {
  id: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  context: Message[];
  // Unified with business state:
  taskId?: string;  // Reference to the task being worked on
  userId: string;   // User context
}

async function executeStep(execution: AgentExecution) {
  // Agent state and business state update together
  const result = await performAction(execution);

  await db.transaction(async (tx) => {
    await tx.agentExecutions.update(execution.id, {
      status: result.status,
      currentStep: execution.currentStep + 1
    });

    if (result.taskCreated) {
      await tx.tasks.create(result.taskCreated);
    }
  });
}
```

**Key Takeaway**: Agent state and business state should update atomically.

## Factor 6: Launch/Pause/Resume APIs

**Principle**: Enable simple control over agent lifecycle management.

**Why It Matters**:
- Long-running operations need to be pausable
- Human-in-the-loop requires pausing
- Enables better resource management

**Implementation**:
Provide explicit control APIs:

```typescript
class AgentOrchestrator {
  async launch(input: string): Promise<{ executionId: string }> {
    const execution = await this.createExecution(input);
    await this.processUntilPause(execution);
    return { executionId: execution.id };
  }

  async pause(executionId: string): Promise<void> {
    await this.updateStatus(executionId, 'paused');
  }

  async resume(executionId: string, input?: string): Promise<void> {
    const execution = await this.loadExecution(executionId);
    if (input) {
      execution.context.push({ role: 'user', content: input });
    }
    await this.processUntilPause(execution);
  }
}
```

**Key Takeaway**: Make agent control explicit and simple, not hidden in framework magic.

## Factor 7: Contact Humans with Tool Calls

**Principle**: Use human-in-the-loop mechanisms as first-class operations via tool calls.

**Why It Matters**:
- Humans become part of the agent workflow
- No special handling needed for approvals
- Consistent pattern for all operations

**Implementation**:
Define human contact as a tool:

```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'request_human_approval',
      description: 'Request approval from a human before proceeding',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action requiring approval' },
          reason: { type: 'string', description: 'Why approval is needed' }
        },
        required: ['action', 'reason']
      }
    }
  }
];

// Execute like any other tool:
if (toolCall.function.name === 'request_human_approval') {
  await this.pause(executionId);
  await this.notifyHuman(toolCall.function.arguments);
}
```

**Key Takeaway**: Humans are just another "tool" in the agent's toolkit.

## Factor 8: Own Your Control Flow

**Principle**: Explicitly define decision logic rather than leaving it entirely to the LLM.

**Why It Matters**:
- Critical paths need deterministic behavior
- LLM decisions should be deliberate, not accidental
- Reduces cost and latency for known patterns

**Implementation**:
Combine deterministic logic with LLM decisions:

```typescript
async function processMessage(message: string, context: Context) {
  // Deterministic routing first
  if (message.startsWith('/help')) {
    return this.handleHelp();
  }

  if (context.awaitingApproval) {
    return this.handleApproval(message);
  }

  // LLM decision only when needed
  const decision = await this.llm.decide({
    message,
    availableActions: this.getAvailableActions(context)
  });

  return this.executeAction(decision);
}
```

**Key Takeaway**: Use deterministic code for known patterns, LLM for ambiguous decisions.

## Factor 9: Compact Errors into Context

**Principle**: Efficiently encode error information for the model within token constraints.

**Why It Matters**:
- Full stack traces waste tokens
- Models need actionable error info, not raw dumps
- Better error summaries improve recovery

**Implementation**:
Transform errors into concise, actionable context:

```typescript
function compactError(error: Error, context: string): string {
  // Bad: Full stack trace (500+ tokens)
  // return error.stack;

  // Good: Concise summary (50 tokens)
  return `Error in ${context}: ${error.message}.
Common causes: [check input format, verify permissions, confirm resource exists].`;
}

// Add to context:
messages.push({
  role: 'system',
  content: compactError(error, 'create_task')
});
```

**Key Takeaway**: Summarize errors into actionable insights, not verbose logs.

## Factor 10: Small, Focused Agents

**Principle**: Build specialized agents rather than universal ones.

**Why It Matters**:
- Smaller scope = higher quality
- Easier to prompt and maintain
- Better performance with focused context

**Implementation**:
Create domain-specific agents:

```typescript
// Bad: Universal agent
class UniversalAgent {
  async process(request: string) {
    // Handles tasks, projects, notes, calendar, email...
  }
}

// Good: Focused agents
class TaskAgent {
  async process(request: string) {
    // Only handles task management
  }
}

class ProjectAgent {
  async process(request: string) {
    // Only handles project management
  }
}

// Route to appropriate agent:
function routeToAgent(request: string): Agent {
  const category = classifyRequest(request);
  return agentRegistry.get(category);
}
```

**Key Takeaway**: Narrow scope = better quality. Build focused agents, not do-everything agents.

## Factor 11: Trigger from Anywhere

**Principle**: Meet users where they are - enable multi-channel invocation.

**Why It Matters**:
- Users interact through various channels
- Agents should be channel-agnostic
- Enables broader adoption

**Implementation**:
Decouple agent logic from trigger mechanism:

```typescript
// Core agent logic (channel-agnostic)
class AgentCore {
  async process(input: string, userId: string) {
    // Agent logic
  }
}

// Multiple trigger points:
// 1. API endpoint
app.post('/api/agent', async (req, res) => {
  const result = await agentCore.process(req.body.message, req.user.id);
  res.json(result);
});

// 2. Webhook
app.post('/webhook/slack', async (req, res) => {
  const result = await agentCore.process(req.body.text, req.body.user_id);
  await slack.send(result);
});

// 3. Scheduled job
cron.schedule('0 9 * * *', async () => {
  const users = await getActiveUsers();
  for (const user of users) {
    await agentCore.process('daily summary', user.id);
  }
});
```

**Key Takeaway**: Build once, trigger from anywhere - API, webhooks, cron, CLI, etc.

## Factor 12: Stateless Reducer Pattern

**Principle**: Design agents as pure functions reducing state.

**Why It Matters**:
- Easier to test and reason about
- Enables horizontal scaling
- Simplifies debugging and replay

**Implementation**:
Treat agent as a reducer function:

```typescript
type AgentState = {
  messages: Message[];
  executionState: ExecutionState;
  businessContext: BusinessContext;
};

type AgentAction =
  | { type: 'USER_MESSAGE'; message: string }
  | { type: 'TOOL_RESULT'; result: ToolResult }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };

// Pure function: (state, action) => newState
async function agentReducer(
  state: AgentState,
  action: AgentAction
): Promise<AgentState> {
  switch (action.type) {
    case 'USER_MESSAGE':
      const response = await llm.process(state.messages, action.message);
      return {
        ...state,
        messages: [...state.messages, action.message, response]
      };

    case 'TOOL_RESULT':
      return {
        ...state,
        messages: [...state.messages, formatToolResult(action.result)]
      };

    // ... other cases
  }
}
```

**Key Takeaway**: Stateless, functional design enables better testing, scaling, and debugging.

## Relationships Between Factors

The 12 factors work together:

- **Factors 1-4** (Natural Language → Tools, Prompts, Context, Tools) define the **LLM Interface Layer**
- **Factors 5-7** (State, Launch/Pause/Resume, Human Contact) define the **Execution Management Layer**
- **Factors 8-10** (Control Flow, Errors, Small Agents) define the **Architecture Patterns**
- **Factors 11-12** (Trigger Anywhere, Stateless) define the **Deployment Strategy**

Following all 12 factors creates production-ready, maintainable, scalable agent systems.
