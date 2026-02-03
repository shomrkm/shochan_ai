---
name: zod-validation
description: Best practices for runtime validation with Zod schemas. Use when defining type-safe schemas, validating API inputs, creating discriminated unions, or implementing the Single Source of Truth pattern.
allowed-tools: Read, Grep, Glob, Bash
---

# Zod Validation Patterns

**Context**: Best practices for type-safe runtime validation using Zod in the shochan_ai system.

## Core Principles

### Single Source of Truth (SSoT)

Define Zod schemas first, then infer TypeScript types. This ensures runtime validation and compile-time types stay in sync.

```typescript
// packages/core/src/types/tools.ts
import { z } from 'zod';

// 1. Define schema first
export const taskTypeSchema = z.enum([
  'Today',
  'Next Actions',
  'Someday / Maybe',
  'Wait for',
  'Routin',
]);

// 2. Infer type from schema
export type TaskType = z.infer<typeof taskTypeSchema>;
// Result: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin'
```

**Why This Matters**:
- Types are automatically in sync with validation logic
- No duplication of type definitions
- Changes to schema automatically update types

## Schema Patterns

### 1. Object Schemas

```typescript
export const createTaskSchema = z.object({
  intent: z.literal('create_task'),
  parameters: z.object({
    title: z.string(),
    description: z.string().optional(),
    task_type: taskTypeSchema.optional(),
    scheduled_date: z.string().optional(),
    project_id: z.string().optional(),
  }),
});

export type CreateTaskTool = z.infer<typeof createTaskSchema>;
```

### 2. Enum Schemas

```typescript
// String enum
export const importanceSchema = z.enum([
  '⭐',
  '⭐⭐',
  '⭐⭐⭐',
  '⭐⭐⭐⭐',
  '⭐⭐⭐⭐⭐',
]);

export type Importance = z.infer<typeof importanceSchema>;

// Usage in other schemas
export const createProjectSchema = z.object({
  intent: z.literal('create_project'),
  parameters: z.object({
    name: z.string(),
    description: z.string(),
    importance: importanceSchema, // Reuse enum schema
    action_plan: z.string().optional(),
  }),
});
```

### 3. Discriminated Unions

For handling multiple types based on a discriminator field.

```typescript
// Individual schemas with literal discriminator
export const getTasksSchema = z.object({
  intent: z.literal('get_tasks'),
  parameters: z.object({
    task_type: taskTypeSchema.optional(),
    limit: z.number().optional(),
  }),
});

export const deleteTaskSchema = z.object({
  intent: z.literal('delete_task'),
  parameters: z.object({
    task_id: z.string(),
    reason: z.string().optional(),
  }),
});

export const updateTaskSchema = z.object({
  intent: z.literal('update_task'),
  parameters: z.object({
    task_id: z.string(),
    title: z.string().optional(),
    task_type: taskTypeSchema.optional(),
    scheduled_date: z.string().nullable().optional(),
  }),
});

// Discriminated union - TypeScript auto-narrows based on 'intent'
export const toolCallSchema = z.discriminatedUnion('intent', [
  createTaskSchema,
  createProjectSchema,
  getTasksSchema,
  deleteTaskSchema,
  updateTaskSchema,
  getTaskDetailsSchema,
  requestMoreInformationSchema,
  doneForNowSchema,
]);

export type ToolCall = z.infer<typeof toolCallSchema>;
```

**Usage with Type Narrowing**:
```typescript
function handleToolCall(call: ToolCall) {
  switch (call.intent) {
    case 'create_task':
      // TypeScript knows: call.parameters has title, description, etc.
      return createTask(call.parameters);
    case 'delete_task':
      // TypeScript knows: call.parameters has task_id, reason
      return deleteTask(call.parameters);
    // ...
  }
}
```

### 4. Optional and Nullable Fields

```typescript
export const updateTaskSchema = z.object({
  intent: z.literal('update_task'),
  parameters: z.object({
    task_id: z.string(),                         // Required
    title: z.string().optional(),                // Optional (undefined)
    scheduled_date: z.string().nullable(),       // Required but can be null
    project_id: z.string().nullable().optional(),// Optional, can be null
  }),
});
```

**Differences**:
- `.optional()` - Field may be missing (undefined)
- `.nullable()` - Field exists but can be null
- `.nullable().optional()` - Field may be missing OR null

### 5. Validation with Constraints

```typescript
const getTasksSchema = z.object({
  parameters: z.object({
    limit: z.number()
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
      .optional()
      .default(10),
    sort_by: z.enum(['created_at', 'updated_at', 'scheduled_date']).optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
  }),
});
```

## Validation Patterns

### 1. Safe Parsing (Recommended)

Returns a result object instead of throwing.

```typescript
export function validateToolCall(data: unknown): ToolCall {
  const result = toolCallSchema.safeParse(data);

  if (!result.success) {
    // Handle validation errors
    console.error('Validation errors:', result.error.format());
    throw new Error(`Invalid tool call: ${result.error.message}`);
  }

  return result.data; // Typed as ToolCall
}
```

### 2. Direct Parsing (Throws on Error)

```typescript
export function parseToolCall(data: unknown): ToolCall {
  try {
    return toolCallSchema.parse(data); // Throws ZodError if invalid
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => i.message).join(', ');
      throw new Error(`Validation failed: ${issues}`);
    }
    throw error;
  }
}
```

### 3. Partial Validation

For update operations where all fields are optional.

```typescript
const taskSchema = z.object({
  title: z.string(),
  description: z.string(),
  task_type: taskTypeSchema,
  scheduled_date: z.string(),
});

// All fields become optional
const updateTaskDataSchema = taskSchema.partial();

type UpdateTaskData = z.infer<typeof updateTaskDataSchema>;
// Result: { title?: string; description?: string; ... }
```

### 4. Pick and Omit

```typescript
// Pick specific fields
const taskTitleSchema = taskSchema.pick({ title: true, description: true });

// Omit specific fields
const taskWithoutIdSchema = taskSchema.omit({ id: true });
```

## API Input Validation

Always validate at system boundaries.

```typescript
// packages/client/src/notion.ts
import { z } from 'zod';

const CreateTaskInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional(),
  type: taskTypeSchema,
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export async function createTask(input: unknown): Promise<Task> {
  // Validate input at API boundary
  const validated = CreateTaskInputSchema.parse(input);

  // Now safe to use validated data
  return await notionClient.createTask(validated);
}
```

## LLM Response Validation

Validate tool calls from LLM responses.

```typescript
// packages/client/src/openai.ts
export function parseToolCallFromLLM(
  functionCall: { name: string; arguments: string }
): ToolCall {
  // Parse JSON arguments
  let args: unknown;
  try {
    args = JSON.parse(functionCall.arguments);
  } catch {
    throw new Error('Invalid JSON in function arguments');
  }

  // Create tool call object
  const toolCallData = {
    intent: functionCall.name,
    parameters: args,
  };

  // Validate with Zod schema
  const result = toolCallSchema.safeParse(toolCallData);

  if (!result.success) {
    throw new Error(
      `Invalid tool call from LLM: ${result.error.message}`
    );
  }

  return result.data;
}
```

## Type Guards with Zod

Use Zod for runtime type narrowing.

```typescript
// Type guard using Zod
export function isCreateTaskCall(call: unknown): call is CreateTaskTool {
  return createTaskSchema.safeParse(call).success;
}

// Usage
function processCall(call: unknown) {
  if (isCreateTaskCall(call)) {
    // TypeScript knows this is CreateTaskTool
    console.log(call.parameters.title);
  }
}
```

## Custom Error Messages

```typescript
const taskSchema = z.object({
  title: z.string({
    required_error: 'Task title is required',
    invalid_type_error: 'Task title must be a string',
  }).min(1, 'Task title cannot be empty'),

  task_type: taskTypeSchema.refine(
    (val) => val !== 'Routin' || someCondition,
    { message: 'Routine tasks require additional configuration' }
  ),
});
```

## Testing Validation

```typescript
import { describe, it, expect } from 'vitest';
import { toolCallSchema, createTaskSchema } from '../tools';

describe('toolCallSchema', () => {
  it('validates create_task calls', () => {
    const validCall = {
      intent: 'create_task',
      parameters: {
        title: 'Test Task',
        task_type: 'Today',
      },
    };

    const result = toolCallSchema.safeParse(validCall);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.intent).toBe('create_task');
    }
  });

  it('rejects invalid task type', () => {
    const invalidCall = {
      intent: 'create_task',
      parameters: {
        title: 'Test',
        task_type: 'InvalidType', // Not in enum
      },
    };

    const result = toolCallSchema.safeParse(invalidCall);
    expect(result.success).toBe(false);
  });

  it('discriminates union correctly', () => {
    const deleteCall = {
      intent: 'delete_task',
      parameters: { task_id: '123' },
    };

    const result = toolCallSchema.safeParse(deleteCall);
    expect(result.success).toBe(true);
    if (result.success && result.data.intent === 'delete_task') {
      expect(result.data.parameters.task_id).toBe('123');
    }
  });
});
```

## Best Practices

### 1. Define Schemas in Core Package

```
packages/core/src/types/
├── tools.ts       # Tool call schemas
├── notion.ts      # Notion entity schemas
└── task.ts        # Domain model schemas
```

### 2. Export Both Schema and Type

```typescript
// Export schema for runtime validation
export const taskTypeSchema = z.enum([...]);

// Export inferred type for compile-time checking
export type TaskType = z.infer<typeof taskTypeSchema>;
```

### 3. Validate at Boundaries

- API endpoints
- LLM responses
- External data sources
- User input

### 4. Use Discriminated Unions

For polymorphic data structures with a type discriminator.

### 5. Avoid `z.any()`

Use `z.unknown()` if type is truly unknown, then narrow with type guards.

```typescript
// WRONG
const dataSchema = z.object({ data: z.any() });

// CORRECT
const dataSchema = z.object({ data: z.unknown() });

// Then validate data separately
if (isExpectedType(data.data)) {
  // Safe to use
}
```

## Related Documentation

- Tool Schemas: `/packages/core/src/types/tools.ts`
- Type Guards: `/packages/core/src/types/toolGuards.ts`
- TypeScript Standards: `/.claude/rules/typescript-strict.md`
- API Security: `/.claude/rules/api-security.md`
- Zod Documentation: https://zod.dev/
