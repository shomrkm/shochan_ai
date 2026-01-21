# OpenAI Integration Patterns

**Context**: Best practices for OpenAI API integration in the shochan_ai agent system.

## Client Configuration

### Secure Setup

```typescript
import OpenAI from 'openai';

// Validate environment
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

// Configure client
export const openai = new OpenAI({
  apiKey,
  timeout: 30000,      // 30 seconds
  maxRetries: 2,       // Retry failed requests
});
```

## Agent Patterns

### 1. Tool-Based Agent (Function Calling)

**Tool Definition**:
```typescript
const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'Retrieve tasks from Notion database',
      parameters: {
        type: 'object',
        properties: {
          taskType: {
            type: 'string',
            enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routine'],
          },
          limit: { type: 'number', default: 10 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task in Notion',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routine'] },
          scheduledDate: { type: 'string', format: 'date' },
        },
        required: ['title', 'type'],
      },
    },
  },
];
```

**Agent Loop**:
```typescript
export async function runAgent(userMessage: string) {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  while (true) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      tools,
      tool_choice: 'auto',
    });

    const message = response.choices[0].message;
    messages.push(message);

    // If no tool calls, agent is done
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content;
    }

    // Execute tool calls
    for (const toolCall of message.tool_calls) {
      const result = await executeToolCall(toolCall);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }
}
```

### 2. System Prompt Design

**Effective System Prompt**:
```typescript
export const SYSTEM_PROMPT = `You are a GTD (Getting Things Done) task management assistant.

## Your Capabilities
- Retrieve tasks from Notion database
- Create, update, and delete tasks
- Manage projects and task relationships
- Provide task recommendations based on GTD methodology

## Task Types
- Today: Tasks to complete today
- Next Actions: Tasks ready to be worked on
- Someday / Maybe: Ideas for future consideration
- Wait for: Tasks waiting on others
- Routine: Recurring tasks

## Guidelines
1. Always confirm task details before creating
2. Ask for clarification if request is ambiguous
3. Provide helpful summaries of task lists
4. Follow GTD principles in recommendations

## Response Format
- Be concise and action-oriented
- Use structured output for task lists
- Confirm successful operations`;
```

### 3. Token Management

**Monitor Usage**:
```typescript
export async function callOpenAIWithMonitoring(
  messages: ChatCompletionMessageParam[]
) {
  const startTime = Date.now();

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    tools,
  });

  const duration = Date.now() - startTime;
  const usage = response.usage;

  // Log for cost tracking
  console.log('OpenAI API Call:', {
    model: 'gpt-4',
    duration_ms: duration,
    prompt_tokens: usage?.prompt_tokens,
    completion_tokens: usage?.completion_tokens,
    total_tokens: usage?.total_tokens,
    estimated_cost_usd: calculateCost(usage),
  });

  return response;
}

function calculateCost(usage: any): number {
  // GPT-4 pricing (example, check current rates)
  const promptCost = (usage.prompt_tokens / 1000) * 0.03;
  const completionCost = (usage.completion_tokens / 1000) * 0.06;
  return promptCost + completionCost;
}
```

### 4. Error Handling

**Comprehensive Error Handling**:
```typescript
export async function safeOpenAICall(params: ChatCompletionCreateParams) {
  try {
    return await openai.chat.completions.create(params);
  } catch (error) {
    console.error('OpenAI API error:', error);

    if (error instanceof OpenAI.APIError) {
      switch (error.status) {
        case 401:
          throw new Error('Invalid OpenAI API key');
        case 429:
          // Rate limit - implement backoff
          await sleep(2000);
          return safeOpenAICall(params); // Retry
        case 500:
        case 503:
          throw new Error('OpenAI service unavailable. Please try again later.');
        default:
          throw new Error(`OpenAI API error: ${error.message}`);
      }
    }

    throw error;
  }
}
```

### 5. Rate Limiting

**Simple Rate Limiter**:
```typescript
class RateLimiter {
  private calls: number[] = [];
  private readonly maxCalls: number;
  private readonly windowMs: number;

  constructor(maxCalls: number, windowMs: number) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.calls = this.calls.filter((time) => now - time < this.windowMs);

    if (this.calls.length >= this.maxCalls) {
      const waitTime = this.windowMs - (now - this.calls[0]);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.calls.push(now);
  }
}

// Usage: 60 calls per minute
const limiter = new RateLimiter(60, 60000);

export async function rateLimitedCall(params: ChatCompletionCreateParams) {
  await limiter.acquire();
  return openai.chat.completions.create(params);
}
```

## Streaming Responses

### SSE Streaming

```typescript
export async function* streamCompletion(
  messages: ChatCompletionMessageParam[]
) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

// Usage in web API
app.post('/api/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  for await (const chunk of streamCompletion(req.body.messages)) {
    res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
  }

  res.end();
});
```

## Testing Patterns

### Mock OpenAI

```typescript
import { vi } from 'vitest';

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Mocked response',
                tool_calls: [
                  {
                    id: 'call_123',
                    type: 'function',
                    function: {
                      name: 'get_tasks',
                      arguments: '{"taskType":"Today"}',
                    },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      },
    },
  })),
}));
```

## Best Practices

### 1. Model Selection

```typescript
// Use GPT-4 for complex reasoning
const complexResponse = await openai.chat.completions.create({
  model: 'gpt-4',
  messages,
  tools,
});

// Use GPT-3.5-turbo for simple tasks
const simpleResponse = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Summarize this text' }],
});
```

### 2. Temperature Control

```typescript
// Creative tasks: higher temperature
const creative = await openai.chat.completions.create({
  model: 'gpt-4',
  messages,
  temperature: 0.8,
});

// Deterministic tasks: lower temperature
const deterministic = await openai.chat.completions.create({
  model: 'gpt-4',
  messages,
  temperature: 0.1,
});
```

### 3. Max Tokens

```typescript
// Limit response length
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages,
  max_tokens: 500, // Prevent overly long responses
});
```

## Security Checklist

- [ ] API key from environment variable only
- [ ] Never log API key
- [ ] Validate user input before sending to OpenAI
- [ ] Sanitize tool call arguments
- [ ] Rate limiting implemented
- [ ] Timeouts configured
- [ ] Error messages don't expose API key

## Cost Optimization

1. **Use GPT-3.5-turbo when possible** - 10x cheaper than GPT-4
2. **Implement caching** - Cache similar requests
3. **Optimize system prompts** - Shorter prompts = lower cost
4. **Set max_tokens** - Prevent unexpectedly long responses
5. **Monitor usage** - Track costs per user/session

## Related Documentation

- API Security: `/.claude/rules/api-security.md`
- Client Package: `/packages/client/src/openai.ts`
- OpenAI API Docs: `https://platform.openai.com/docs/api-reference`
