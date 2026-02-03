---
name: tool-definition
description: Best practices for defining OpenAI Function Calling tools. Use when creating new tools, implementing tool executors, or designing parameter schemas for AI agent systems.
allowed-tools: Read, Grep, Glob, Bash
---

# Tool Definition Patterns

**Context**: Best practices for defining OpenAI Function Calling tools in the shochan_ai agent system.

## Tool Definition Structure

Tools are defined using OpenAI's Function Calling format and validated with Zod schemas.

### OpenAI Tool Format

```typescript
// packages/core/src/tools/task-agent-tools.ts
import type OpenAI from 'openai';

export const taskAgentTools: OpenAI.Responses.FunctionTool[] = [
  {
    type: 'function',
    name: 'create_task',
    description: 'Create a new task in the GTD system',
    strict: null,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        task_type: {
          type: 'string',
          enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin'],
          description: 'Type of task in GTD system',
        },
        scheduled_date: { type: 'string', description: 'Scheduled date in ISO format' },
        project_id: { type: 'string', description: 'Related project ID' },
      },
      required: ['title'],
    },
  },
];
```

## Available Tools

The shochan_ai system provides 8 tools for GTD task management:

| Tool Name | Purpose | Required Params |
|-----------|---------|-----------------|
| `get_tasks` | Retrieve tasks with filtering | None |
| `get_task_details` | Get detailed task info | `task_id` |
| `create_task` | Create new task | `title` |
| `update_task` | Update existing task | `task_id` |
| `delete_task` | Delete task (approval needed) | `task_id` |
| `create_project` | Create new project | `name`, `description`, `importance` |
| `request_more_information` | Ask user for clarification | `message` |
| `done_for_now` | Complete conversation | `message` |

## Defining New Tools

### Step 1: Define OpenAI Tool Schema

```typescript
// packages/core/src/tools/task-agent-tools.ts
{
  type: 'function',
  name: 'get_task_details',
  description: 'Get detailed information about a specific task by its ID',
  strict: null,
  parameters: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'ID of the task to retrieve details for',
      },
    },
    required: ['task_id'],
  },
},
```

### Step 2: Define Zod Validation Schema

```typescript
// packages/core/src/types/tools.ts
import { z } from 'zod';

export const getTaskDetailsSchema = z.object({
  intent: z.literal('get_task_details'),
  parameters: z.object({
    task_id: z.string(),
  }),
});

export type GetTaskDetailsTool = z.infer<typeof getTaskDetailsSchema>;

// Add to discriminated union
export const toolCallSchema = z.discriminatedUnion('intent', [
  // ... other schemas
  getTaskDetailsSchema,
]);
```

### Step 3: Implement Tool Executor

```typescript
// packages/core/src/agent/notion-tool-executor.ts
export class NotionToolExecutor implements ToolExecutor {
  async execute(toolCall: ToolCall): Promise<ToolExecutionResult> {
    switch (toolCall.intent) {
      case 'get_task_details':
        return this.executeGetTaskDetails(toolCall.parameters);
      // ... other cases
    }
  }

  private async executeGetTaskDetails(
    params: GetTaskDetailsTool['parameters']
  ): Promise<ToolExecutionResult> {
    const task = await this.notionClient.getTaskDetails(params.task_id);

    return {
      event: {
        type: 'tool_response',
        timestamp: Date.now(),
        data: task,
      },
    };
  }
}
```

## Parameter Patterns

### Enum Parameters

```typescript
// OpenAI schema
task_type: {
  type: 'string',
  enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin'],
  description: 'Type of task in GTD system',
},

// Zod schema
task_type: z.enum([
  'Today',
  'Next Actions',
  'Someday / Maybe',
  'Wait for',
  'Routin',
]).optional(),
```

### Optional Parameters

```typescript
// OpenAI schema - NOT in required array
parameters: {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'New task title' },
    description: { type: 'string', description: 'New description' },
  },
  required: ['task_id'], // Only task_id is required
},

// Zod schema - use .optional()
parameters: z.object({
  task_id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
}),
```

### Nullable Parameters

For fields that can explicitly be set to null (e.g., removing a value).

```typescript
// OpenAI schema
scheduled_date: {
  anyOf: [
    { type: 'string', description: 'New scheduled date in ISO format' },
    { type: 'null', description: 'Remove scheduled date' }
  ],
  description: 'New scheduled date in ISO format, or null to remove',
},

// Zod schema
scheduled_date: z.string().nullable().optional(),
```

### Numeric Parameters with Constraints

```typescript
// OpenAI schema
limit: {
  type: 'number',
  minimum: 1,
  maximum: 100,
  description: 'Maximum number of tasks to return (default: 10)',
},

// Zod schema
limit: z.number().min(1).max(100).optional().default(10),
```

## Tool Categories

### 1. Query Tools (Read-Only)

Safe operations that don't modify data.

```typescript
// get_tasks - flexible filtering
{
  type: 'function',
  name: 'get_tasks',
  description: 'Retrieve tasks with optional filtering and sorting',
  parameters: {
    type: 'object',
    properties: {
      task_type: { type: 'string', enum: [...] },
      project_id: { type: 'string' },
      search_title: { type: 'string', description: 'Search by title' },
      limit: { type: 'number', minimum: 1, maximum: 100 },
      include_completed: { type: 'boolean' },
      sort_by: { type: 'string', enum: ['created_at', 'updated_at', 'scheduled_date'] },
      sort_order: { type: 'string', enum: ['asc', 'desc'] },
    },
    required: [], // All optional for flexibility
  },
},
```

### 2. Mutation Tools (Write Operations)

Operations that modify data. May require approval.

```typescript
// create_task
{
  type: 'function',
  name: 'create_task',
  description: 'Create a new task in the GTD system',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title' },
      // ... other fields
    },
    required: ['title'], // Minimum required field
  },
},

// delete_task - requires approval
{
  type: 'function',
  name: 'delete_task',
  description: 'Delete a task from the GTD system',
  parameters: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'ID of the task to delete' },
      reason: { type: 'string', description: 'Reason for deletion (optional)' },
    },
    required: ['task_id'],
  },
},
```

### 3. Conversation Tools

Tools for managing the conversation flow.

```typescript
// request_more_information - ask for clarification
{
  type: 'function',
  name: 'request_more_information',
  description: 'Request more information from the user',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Message to request more information' },
    },
    required: ['message'],
  },
},

// done_for_now - complete conversation
{
  type: 'function',
  name: 'done_for_now',
  description: 'Complete conversation with natural response',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Natural language response to user' },
    },
    required: ['message'],
  },
},
```

## Tool Execution Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ LLM Response │───►│ Parse Tool   │───►│ Validate     │
│ (tool_call)  │    │ Call JSON    │    │ with Zod     │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                                               ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Format       │◄───│ Execute      │◄───│ Check        │
│ Response     │    │ Tool Call    │    │ Approval     │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Parsing LLM Tool Calls

```typescript
export function parseToolCall(
  functionCall: { name: string; arguments: string }
): ToolCall {
  // 1. Parse JSON arguments
  const args = JSON.parse(functionCall.arguments);

  // 2. Create tool call object with intent
  const toolCallData = {
    intent: functionCall.name,
    parameters: args,
  };

  // 3. Validate with Zod
  return toolCallSchema.parse(toolCallData);
}
```

## Human-in-the-Loop Pattern

For dangerous operations, require human approval.

```typescript
// In ToolExecutor
async execute(toolCall: ToolCall): Promise<ToolExecutionResult> {
  // Check if approval is required
  if (this.requiresApproval(toolCall)) {
    return {
      event: {
        type: 'awaiting_approval',
        timestamp: Date.now(),
        data: toolCall,
      },
      requiresApproval: true,
    };
  }

  // Execute normally
  return this.executeToolCall(toolCall);
}

private requiresApproval(toolCall: ToolCall): boolean {
  // Delete operations require approval
  return toolCall.intent === 'delete_task';
}
```

## Best Practices

### 1. Clear Descriptions

Help the LLM understand when to use each tool.

```typescript
// GOOD: Specific and actionable
description: 'Retrieve tasks with optional filtering by type, project, or title search',

// BAD: Vague
description: 'Get tasks',
```

### 2. Minimal Required Parameters

Only require what's absolutely necessary.

```typescript
// GOOD: Flexible
required: ['task_id'], // Only ID required for update

// BAD: Over-constrained
required: ['task_id', 'title', 'type', 'date'], // Too many required
```

### 3. Sensible Defaults

Document default values in descriptions.

```typescript
limit: {
  type: 'number',
  minimum: 1,
  maximum: 100,
  description: 'Maximum number of tasks to return (default: 10)',
},
```

### 4. Keep Schemas in Sync

OpenAI tool definitions and Zod schemas must match.

```typescript
// OpenAI
enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin']

// Zod (must match exactly)
z.enum(['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin'])
```

### 5. Error Handling in Executors

```typescript
async executeGetTaskDetails(params: { task_id: string }): Promise<ToolExecutionResult> {
  try {
    const task = await this.notionClient.getTaskDetails(params.task_id);

    if (!task) {
      return {
        event: {
          type: 'error',
          timestamp: Date.now(),
          data: {
            error: `Task not found: ${params.task_id}`,
            code: 'TASK_NOT_FOUND',
          },
        },
      };
    }

    return {
      event: {
        type: 'tool_response',
        timestamp: Date.now(),
        data: task,
      },
    };
  } catch (error) {
    return {
      event: {
        type: 'error',
        timestamp: Date.now(),
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'EXECUTION_ERROR',
        },
      },
    };
  }
}
```

## Testing Tools

### Unit Testing Schemas

```typescript
describe('Tool Schemas', () => {
  it('validates create_task with required fields', () => {
    const call = {
      intent: 'create_task',
      parameters: { title: 'Test Task' },
    };

    const result = createTaskSchema.safeParse(call);
    expect(result.success).toBe(true);
  });

  it('rejects invalid task type', () => {
    const call = {
      intent: 'create_task',
      parameters: {
        title: 'Test',
        task_type: 'Invalid',
      },
    };

    const result = createTaskSchema.safeParse(call);
    expect(result.success).toBe(false);
  });
});
```

### Integration Testing Executors

```typescript
describe('NotionToolExecutor', () => {
  it('executes get_tasks successfully', async () => {
    const mockNotionClient = {
      getTasks: vi.fn().mockResolvedValue([
        { id: '1', title: 'Task 1' },
        { id: '2', title: 'Task 2' },
      ]),
    };

    const executor = new NotionToolExecutor(mockNotionClient);

    const result = await executor.execute({
      intent: 'get_tasks',
      parameters: { task_type: 'Today' },
    });

    expect(result.event.type).toBe('tool_response');
    expect(result.event.data).toHaveLength(2);
  });
});
```

## Related Documentation

- Tool Definitions: `/packages/core/src/tools/task-agent-tools.ts`
- Zod Schemas: `/packages/core/src/types/tools.ts`
- Tool Executor: `/packages/core/src/agent/notion-tool-executor.ts`
- OpenAI Patterns: `/.claude/skills/openai-patterns/SKILL.md`
- Zod Validation: `/.claude/skills/zod-validation/SKILL.md`
- OpenAI Function Calling Docs: https://platform.openai.com/docs/guides/function-calling
