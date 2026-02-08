# Implementation Patterns

Common implementation patterns for 12-factor agents in TypeScript/JavaScript environments.

## Pattern 1: The Agent Loop

The fundamental pattern for agent execution:

```typescript
async function agentLoop(
  initialInput: string,
  options: AgentOptions
): Promise<AgentResult> {
  const context: Message[] = [
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: initialInput }
  ];

  let shouldContinue = true;
  let iteration = 0;
  const maxIterations = 10;

  while (shouldContinue && iteration < maxIterations) {
    // 1. LLM decides next action
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: context,
      tools: options.tools
    });

    const message = response.choices[0].message;
    context.push(message);

    // 2. Check if done
    if (!message.tool_calls || message.tool_calls.length === 0) {
      shouldContinue = false;
      break;
    }

    // 3. Execute tool calls
    for (const toolCall of message.tool_calls) {
      const result = await executeToolCall(toolCall, options.executor);

      context.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }

    iteration++;
  }

  return {
    finalMessage: context[context.length - 1].content,
    context,
    iterations: iteration
  };
}
```

**When to use**: Basic agent workflows with straightforward tool execution.

## Pattern 2: Stateless Agent with State Management

Separate agent logic from state persistence:

```typescript
// Pure agent logic
class StatelessAgent {
  async step(
    state: AgentState,
    input: AgentInput
  ): Promise<{ state: AgentState; output: AgentOutput }> {
    const messages = [...state.messages, { role: 'user', content: input.message }];

    const response = await this.llm.decide(messages, this.tools);

    const newState: AgentState = {
      ...state,
      messages: [...messages, response],
      lastUpdate: Date.now()
    };

    return {
      state: newState,
      output: { message: response.content, toolCalls: response.tool_calls }
    };
  }
}

// State management layer
class AgentStateManager {
  constructor(
    private agent: StatelessAgent,
    private storage: StateStorage
  ) {}

  async execute(sessionId: string, input: AgentInput): Promise<AgentOutput> {
    // Load state
    const state = await this.storage.load(sessionId);

    // Execute agent step
    const { state: newState, output } = await this.agent.step(state, input);

    // Save state
    await this.storage.save(sessionId, newState);

    return output;
  }
}
```

**Benefits**:
- Agent is testable in isolation
- State can be persisted to any storage
- Easy to replay and debug

## Pattern 3: Tool Registry Pattern

Centralize tool definitions and execution:

```typescript
interface ToolDefinition {
  schema: OpenAI.Chat.ChatCompletionTool;
  executor: (params: unknown) => Promise<unknown>;
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(name: string, definition: ToolDefinition): void {
    this.tools.set(name, definition);
  }

  getSchemas(): OpenAI.Chat.ChatCompletionTool[] {
    return Array.from(this.tools.values()).map((def) => def.schema);
  }

  async execute(toolCall: ToolCall): Promise<unknown> {
    const tool = this.tools.get(toolCall.function.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolCall.function.name}`);
    }

    const params = JSON.parse(toolCall.function.arguments);
    return tool.executor(params);
  }
}

// Usage
const registry = new ToolRegistry();

registry.register('get_tasks', {
  schema: {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'Retrieve tasks',
      parameters: { type: 'object', properties: {} }
    }
  },
  executor: async (params) => {
    return await taskService.getTasks(params);
  }
});
```

**Benefits**:
- Single source of truth for tools
- Easy to add/remove tools
- Consistent execution pattern

## Pattern 4: Context Window Management

Intelligent context truncation and summarization:

```typescript
class ContextManager {
  private readonly maxTokens = 4000;
  private readonly systemPromptTokens = 500;

  async buildContext(
    systemPrompt: string,
    history: Message[],
    currentMessage: string
  ): Message[] {
    const messages: Message[] = [{ role: 'system', content: systemPrompt }];

    const availableTokens =
      this.maxTokens - this.systemPromptTokens - this.estimateTokens(currentMessage);

    // Strategy 1: Keep most recent messages
    const recentMessages = this.keepRecent(history, availableTokens * 0.7);

    // Strategy 2: Summarize older messages
    if (history.length > recentMessages.length) {
      const olderMessages = history.slice(0, -recentMessages.length);
      const summary = await this.summarize(olderMessages);

      messages.push({
        role: 'system',
        content: `Previous conversation summary: ${summary}`
      });
    }

    messages.push(...recentMessages);
    messages.push({ role: 'user', content: currentMessage });

    return messages;
  }

  private keepRecent(messages: Message[], tokenBudget: number): Message[] {
    const result: Message[] = [];
    let tokens = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens(messages[i].content);

      if (tokens + msgTokens > tokenBudget) break;

      result.unshift(messages[i]);
      tokens += msgTokens;
    }

    return result;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async summarize(messages: Message[]): Promise<string> {
    // Use LLM to summarize
    const text = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation in 2-3 sentences:\n\n${text}`
        }
      ]
    });

    return response.choices[0].message.content || '';
  }
}
```

**Benefits**:
- Stays within token limits
- Preserves important context
- Reduces costs

## Pattern 5: Human-in-the-Loop Pattern

Implement approval flows as tool calls:

```typescript
interface ApprovalRequest {
  executionId: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: number;
}

class HumanInTheLoopAgent {
  private pendingApprovals = new Map<string, ApprovalRequest>();

  async executeWithApproval(
    executionId: string,
    input: string
  ): Promise<AgentResult> {
    const tools = [
      ...this.standardTools,
      {
        type: 'function' as const,
        function: {
          name: 'request_approval',
          description: 'Request human approval before proceeding',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              details: { type: 'object' }
            },
            required: ['action']
          }
        }
      }
    ];

    const response = await this.agent.execute(input, tools);

    // Check if approval requested
    const approvalCall = response.toolCalls?.find(
      (tc) => tc.function.name === 'request_approval'
    );

    if (approvalCall) {
      const params = JSON.parse(approvalCall.function.arguments);

      // Pause execution and request approval
      this.pendingApprovals.set(executionId, {
        executionId,
        action: params.action,
        details: params.details,
        timestamp: Date.now()
      });

      await this.notifyHuman(executionId, params);

      return {
        status: 'pending_approval',
        message: `Waiting for approval: ${params.action}`
      };
    }

    return { status: 'completed', result: response };
  }

  async handleApproval(executionId: string, approved: boolean): Promise<void> {
    const request = this.pendingApprovals.get(executionId);
    if (!request) throw new Error('No pending approval');

    if (approved) {
      // Resume execution with approval
      await this.agent.resume(executionId, 'Approval granted. Please proceed.');
    } else {
      // Cancel execution
      await this.agent.cancel(executionId, 'Approval denied.');
    }

    this.pendingApprovals.delete(executionId);
  }
}
```

**Benefits**:
- Humans integrated naturally into workflow
- No special handling needed
- Clear audit trail

## Pattern 6: Error Recovery Pattern

Handle errors gracefully with retry and fallback:

```typescript
class ResilientAgent {
  async executeWithRetry(
    toolCall: ToolCall,
    maxRetries = 3
  ): Promise<ToolResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.executeToolCall(toolCall);
      } catch (error) {
        lastError = error as Error;

        // Compact error for context
        const errorContext = this.compactError(error as Error, toolCall);

        // Add error to context and let LLM retry with adjustment
        this.context.push({
          role: 'system',
          content: errorContext
        });

        // Exponential backoff
        if (attempt < maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // All retries failed, use fallback
    return this.handleFailure(toolCall, lastError!);
  }

  private compactError(error: Error, toolCall: ToolCall): string {
    return `Tool '${toolCall.function.name}' failed: ${error.message}.
Suggestion: Check parameters and try again with adjustments.`;
  }

  private async handleFailure(
    toolCall: ToolCall,
    error: Error
  ): Promise<ToolResult> {
    // Ask LLM for alternative approach
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        ...this.context,
        {
          role: 'system',
          content: `The action failed after retries. Please suggest an alternative approach or inform the user.`
        }
      ]
    });

    return {
      success: false,
      error: error.message,
      alternative: response.choices[0].message.content
    };
  }
}
```

**Benefits**:
- Graceful degradation
- Intelligent retry with LLM feedback
- Better user experience

## Pattern 7: Multi-Agent Orchestration

Coordinate multiple specialized agents:

```typescript
class AgentOrchestrator {
  private agents = new Map<string, SpecializedAgent>();

  constructor() {
    this.agents.set('tasks', new TaskAgent());
    this.agents.set('projects', new ProjectAgent());
    this.agents.set('calendar', new CalendarAgent());
  }

  async route(input: string): Promise<AgentResult> {
    // Use classifier agent to determine which specialized agent to use
    const classification = await this.classify(input);

    const agent = this.agents.get(classification.agentType);
    if (!agent) {
      throw new Error(`No agent for type: ${classification.agentType}`);
    }

    return agent.execute(input);
  }

  private async classify(input: string): Promise<{ agentType: string }> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Classify the user's request into one of: tasks, projects, calendar.
Return JSON: { "agentType": "..." }`
        },
        { role: 'user', content: input }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content!);
  }
}
```

**Benefits**:
- Specialized agents for quality
- Simple routing logic
- Easy to add new agents

## Pattern 8: Prompt Template Management

Version and manage prompts systematically:

```typescript
interface PromptTemplate {
  version: string;
  system: string;
  variables: Record<string, string>;
}

class PromptManager {
  private templates = new Map<string, PromptTemplate>();

  register(name: string, template: PromptTemplate): void {
    this.templates.set(`${name}:${template.version}`, template);
  }

  render(name: string, version: string, context: Record<string, unknown>): string {
    const template = this.templates.get(`${name}:${version}`);
    if (!template) {
      throw new Error(`Template not found: ${name}:${version}`);
    }

    let prompt = template.system;

    // Replace variables
    for (const [key, value] of Object.entries(context)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return prompt;
  }
}

// Usage
const promptManager = new PromptManager();

promptManager.register('task-agent', {
  version: '1.0',
  system: `You are a task management assistant for {{userName}}.
Available task types: {{taskTypes}}.

Your role is to help organize tasks efficiently.`,
  variables: {
    userName: 'string',
    taskTypes: 'string'
  }
});

const prompt = promptManager.render('task-agent', '1.0', {
  userName: 'Alice',
  taskTypes: 'Today, Next Actions, Someday'
});
```

**Benefits**:
- Version control for prompts
- Easy A/B testing
- Consistent formatting

## Combining Patterns

In production, combine multiple patterns:

```typescript
class ProductionAgent {
  constructor(
    private toolRegistry: ToolRegistry,
    private contextManager: ContextManager,
    private stateManager: AgentStateManager,
    private promptManager: PromptManager
  ) {}

  async execute(sessionId: string, input: string): Promise<AgentResult> {
    // Load state
    const state = await this.stateManager.loadState(sessionId);

    // Build context with window management
    const context = await this.contextManager.buildContext(
      this.promptManager.render('agent', '1.0', state.context),
      state.history,
      input
    );

    // Execute with tool registry
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: context,
      tools: this.toolRegistry.getSchemas()
    });

    // Handle tool calls
    const results = await Promise.all(
      response.choices[0].message.tool_calls?.map((tc) =>
        this.toolRegistry.execute(tc)
      ) || []
    );

    // Update state
    await this.stateManager.saveState(sessionId, {
      ...state,
      history: [...state.history, ...context, response.choices[0].message],
      lastUpdate: Date.now()
    });

    return { message: response.choices[0].message.content, results };
  }
}
```

This combines:
- Tool registry for organized tool management
- Context manager for efficient token usage
- State manager for persistence
- Prompt manager for version control
