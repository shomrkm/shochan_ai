# TypeScript Strict Mode Standards

> **Context**: This project enforces TypeScript strict mode with runtime validation using Zod.

## Type Safety Principles (CRITICAL)

### 1. Avoid Type Assertions

**❌ NEVER use `as any`:**
```typescript
// WRONG: Type assertion bypasses type safety
const data = response as any;
const user = data.user as User;
```

**✅ ALWAYS use proper type definitions and guards:**
```typescript
// CORRECT: Runtime validation with Zod
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
});

type User = z.infer<typeof UserSchema>;

const result = UserSchema.safeParse(response);
if (!result.success) {
  throw new Error('Invalid user data');
}
const user: User = result.data;
```

### 2. Strict Type Definitions

**Use specific literal types:**
```typescript
// ✅ CORRECT: Narrow, specific types
type TaskType = 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routine';
type ToolName = 'get_tasks' | 'create_task' | 'update_task' | 'delete_task';

// ❌ WRONG: Broad types
type TaskType = string;
type ToolName = string;
```

**Define exact object shapes:**
```typescript
// ✅ CORRECT: Explicit required/optional properties
interface TaskInput {
  title: string;
  description?: string;
  type: TaskType;
  scheduledDate: string;
  projectId?: string;
}

// ❌ WRONG: Using any or unknown inappropriately
interface TaskInput {
  [key: string]: any;
}
```

### 3. Union Types & Type Safety

**Discriminated Unions:**
```typescript
// ✅ CORRECT: Discriminated union for polymorphic data
type ToolCall =
  | { type: 'get_tasks'; parameters: GetTasksParams }
  | { type: 'create_task'; parameters: CreateTaskParams }
  | { type: 'update_task'; parameters: UpdateTaskParams };

function handleToolCall(call: ToolCall) {
  switch (call.type) {
    case 'get_tasks':
      // TypeScript knows call.parameters is GetTasksParams
      return getTasks(call.parameters);
    case 'create_task':
      return createTask(call.parameters);
    case 'update_task':
      return updateTask(call.parameters);
  }
}
```

**Type Guards:**
```typescript
// ✅ CORRECT: Proper type guard implementation
function isTaskEvent(event: unknown): event is TaskEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    typeof event.type === 'string' &&
    ['create_task', 'update_task', 'delete_task'].includes(event.type)
  );
}

// Usage
if (isTaskEvent(data)) {
  // TypeScript knows data is TaskEvent here
  console.log(data.type);
}
```

### 4. Generic Type Parameters

**Constrained Generics:**
```typescript
// ✅ CORRECT: Constrained generic with proper bounds
type EventType = 'create_task' | 'update_task' | 'delete_task';

interface EventHandler<K extends EventType> {
  type: K;
  execute(params: EventParams[K]): Promise<EventResult[K]>;
}

// ❌ WRONG: Unconstrained generic
interface EventHandler<T> {
  type: T;
  execute(params: any): Promise<any>;
}
```

**Default Type Parameters:**
```typescript
// ✅ CORRECT: Provide sensible defaults
interface ApiResponse<T = unknown, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}
```

### 5. Runtime Validation with Zod

**Schema Definition (in packages/core):**
```typescript
// packages/core/src/types/tools.ts
import { z } from 'zod';

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routine']),
  scheduledDate: z.string(),
  projectId: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
```

**Runtime Validation:**
```typescript
// ✅ CORRECT: Validate at system boundaries
export function createTask(input: unknown): Promise<TaskResult> {
  const validation = CreateTaskInputSchema.safeParse(input);

  if (!validation.success) {
    throw new Error(`Invalid input: ${validation.error.message}`);
  }

  // validation.data is now properly typed
  return executeCreateTask(validation.data);
}

// ❌ WRONG: Trust external data without validation
export function createTask(input: any): Promise<TaskResult> {
  return executeCreateTask(input); // No validation!
}
```

## Type Inference

**Let TypeScript infer when possible:**
```typescript
// ✅ CORRECT: Inference is clear
const tasks = await getTasks(); // Type inferred from function return
const taskIds = tasks.map(t => t.id); // Type: string[]

// ❌ UNNECESSARY: Redundant type annotation
const tasks: Task[] = await getTasks();
const taskIds: string[] = tasks.map((t: Task) => t.id);
```

**Be explicit when clarity is needed:**
```typescript
// ✅ CORRECT: Explicit when inference would be unclear
const emptyTasks: Task[] = []; // Otherwise inferred as never[]

// ✅ CORRECT: Explicit callback parameter types
tasks.forEach((task: Task) => {
  console.log(task.title);
});
```

## Avoid `any` Type

```typescript
// ❌ NEVER use any
function processData(data: any) { }

// ✅ Use unknown for truly unknown types
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // Narrow the type with type guards
  }
}

// ✅ Or use proper generic constraints
function processData<T extends Record<string, unknown>>(data: T) {
  // T is constrained but flexible
}
```

## Common Patterns in This Project

### Event System
```typescript
// packages/core/src/types/event.ts
export type AgentEvent =
  | { type: 'tool_call'; tool: ToolCall }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'message'; content: string };

export type EventHandler = (event: AgentEvent) => Promise<void>;
```

### API Response Types
```typescript
// Consistent response structure
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Usage
export async function getTasks(): Promise<ApiResponse<Task[]>> {
  try {
    const tasks = await fetchTasks();
    return { success: true, data: tasks };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

## Pre-Commit Verification

Always run before committing:
```bash
# Type check (no emitted files)
npx tsc --noEmit

# Should show no errors
```

## Resources

- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- Zod Documentation: https://zod.dev/
- Project tsconfig: `/tsconfig.base.json`
- Core Types: `/packages/core/src/types/`
