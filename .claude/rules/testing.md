# Testing Standards

> **Context**: This project uses Vitest for unit and integration testing, with Testing Library for React components.

## Testing Requirements

### Minimum Coverage
- **80% code coverage** across all packages
- Unit tests for all business logic
- Integration tests for API interactions
- Component tests for React components

### Test Types

1. **Unit Tests**: Isolated function and class testing
2. **Integration Tests**: API and database operations
3. **Component Tests**: React component behavior (web-ui)

## Vitest Configuration

The project uses Vitest as the test runner:

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Unit Testing Patterns

### Pure Functions (packages/core)

**✅ CORRECT: Test pure functions thoroughly**
```typescript
// packages/core/src/utils/notion-query-builder.ts
export function buildTaskFilter(taskType: TaskType) {
  return {
    property: 'Task Type',
    select: {
      equals: taskType,
    },
  };
}

// packages/core/src/utils/__tests__/notion-query-builder.test.ts
import { describe, it, expect } from 'vitest';
import { buildTaskFilter } from '../notion-query-builder';

describe('buildTaskFilter', () => {
  it('builds correct filter for task type', () => {
    const filter = buildTaskFilter('Today');

    expect(filter).toEqual({
      property: 'Task Type',
      select: {
        equals: 'Today',
      },
    });
  });

  it('handles all task types', () => {
    const types: TaskType[] = ['Today', 'Next Actions', 'Someday / Maybe'];

    for (const type of types) {
      const filter = buildTaskFilter(type);
      expect(filter.select.equals).toBe(type);
    }
  });
});
```

### Type Guards

**✅ Test type guard functions:**
```typescript
// packages/core/src/types/toolGuards.ts
export function isCreateTaskCall(call: unknown): call is CreateTaskCall {
  return (
    typeof call === 'object' &&
    call !== null &&
    'type' in call &&
    call.type === 'create_task'
  );
}

// __tests__/toolGuards.test.ts
describe('isCreateTaskCall', () => {
  it('returns true for valid create task call', () => {
    const call = {
      type: 'create_task',
      parameters: { title: 'Test' },
    };

    expect(isCreateTaskCall(call)).toBe(true);
  });

  it('returns false for invalid call', () => {
    expect(isCreateTaskCall(null)).toBe(false);
    expect(isCreateTaskCall({})).toBe(false);
    expect(isCreateTaskCall({ type: 'get_tasks' })).toBe(false);
  });
});
```

## Integration Testing

### API Client Testing (packages/client)

**✅ Mock external API calls:**
```typescript
// packages/client/src/__tests__/notion.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotionClient } from '../notion';

// Mock the @notionhq/client
vi.mock('@notionhq/client', () => ({
  Client: vi.fn(() => ({
    databases: {
      query: vi.fn(),
      create: vi.fn(),
    },
    pages: {
      create: vi.fn(),
      update: vi.fn(),
    },
  })),
}));

describe('NotionClient', () => {
  let client: NotionClient;

  beforeEach(() => {
    client = new NotionClient({
      auth: 'test_key',
      tasksDbId: 'tasks_db',
      projectsDbId: 'projects_db',
    });
  });

  it('fetches tasks from database', async () => {
    const mockTasks = [
      { id: '1', properties: { Title: { title: [{ plain_text: 'Task 1' }] } } },
    ];

    vi.spyOn(client['notion'].databases, 'query').mockResolvedValue({
      results: mockTasks,
    } as any);

    const tasks = await client.getTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Task 1');
  });

  it('handles API errors gracefully', async () => {
    vi.spyOn(client['notion'].databases, 'query').mockRejectedValue(
      new Error('API Error')
    );

    await expect(client.getTasks()).rejects.toThrow('Failed to fetch tasks');
  });
});
```

### Agent Orchestrator Testing

**✅ Test agent workflow:**
```typescript
// packages/core/src/agent/__tests__/orchestrator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AgentOrchestrator } from '../orchestrator';

describe('AgentOrchestrator', () => {
  it('processes user message and calls appropriate tool', async () => {
    const mockExecutor = {
      executeToolCall: vi.fn().mockResolvedValue({
        success: true,
        data: [],
      }),
    };

    const orchestrator = new AgentOrchestrator(mockExecutor);

    await orchestrator.processMessage('Show me my tasks');

    expect(mockExecutor.executeToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'get_tasks',
      })
    );
  });
});
```

## React Component Testing (web-ui)

### Component with Testing Library

**✅ CORRECT: Test user interactions**
```typescript
// packages/web-ui/__tests__/components/task-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from '@/components/task-card';

describe('TaskCard', () => {
  const mockTask = {
    id: '1',
    title: 'Test Task',
    status: 'pending',
  };

  it('renders task information', () => {
    render(<TaskCard task={mockTask} />);

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('calls onComplete when complete button clicked', async () => {
    const onComplete = vi.fn();
    render(<TaskCard task={mockTask} onComplete={onComplete} />);

    const completeButton = screen.getByRole('button', { name: /complete/i });
    fireEvent.click(completeButton);

    expect(onComplete).toHaveBeenCalledWith('1');
  });

  it('handles loading state', () => {
    render(<TaskCard task={mockTask} isLoading={true} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
```

### Testing Hooks

**✅ Test custom hooks:**
```typescript
// packages/web-ui/__tests__/hooks/use-tasks.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTasks } from '@/hooks/use-tasks';

describe('useTasks', () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('fetches tasks successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', title: 'Task 1' }],
    });

    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].title).toBe('Task 1');
  });

  it('handles fetch errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});
```

## Test Organization

### File Structure
```
packages/
├── core/
│   ├── src/
│   │   ├── agent/
│   │   │   ├── orchestrator.ts
│   │   │   └── __tests__/
│   │   │       └── orchestrator.test.ts
│   │   └── utils/
│   │       ├── helper.ts
│   │       └── __tests__/
│   │           └── helper.test.ts
└── web-ui/
    ├── components/
    │   └── task-card.tsx
    └── __tests__/
        └── components/
            └── task-card.test.tsx
```

### Naming Conventions
- Test files: `*.test.ts` or `*.test.tsx`
- Test directory: `__tests__/`
- Mirror source file structure in test directory

## Mocking Best Practices

### Environment Variables
```typescript
import { beforeEach, afterEach, vi } from 'vitest';

describe('with environment variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test_key',
      NOTION_API_KEY: 'test_notion_key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses environment variables', () => {
    // Test code that uses process.env
  });
});
```

### External APIs
```typescript
// Mock at module level
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked response' } }],
        }),
      },
    },
  })),
}));
```

## Coverage Requirements

### Check Coverage
```bash
# Generate coverage report
pnpm test:coverage

# Opens HTML report
open coverage/index.html
```

### Minimum Thresholds
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
});
```

## Test-Driven Development (TDD)

### RED-GREEN-REFACTOR Cycle

**1. RED: Write failing test first**
```typescript
// Write test that fails
it('calculates total task count', () => {
  const result = calculateTotalTasks(tasks);
  expect(result).toBe(5);
});
```

**2. GREEN: Write minimal implementation**
```typescript
// Implement just enough to pass
export function calculateTotalTasks(tasks: Task[]): number {
  return tasks.length;
}
```

**3. REFACTOR: Improve code quality**
```typescript
// Refactor while tests still pass
export function calculateTotalTasks(tasks: Task[]): number {
  return tasks.filter((task) => task.status !== 'archived').length;
}
```

## Common Testing Pitfalls

### ❌ Testing Implementation Details
```typescript
// ❌ WRONG: Testing internal state
it('sets loading state', () => {
  const { result } = renderHook(() => useTasks());
  expect(result.current.isLoading).toBe(true); // Implementation detail
});

// ✅ CORRECT: Test behavior
it('displays loading indicator', () => {
  render(<TaskList />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});
```

### ❌ Not Cleaning Up
```typescript
// ❌ WRONG: Leaking state between tests
let tasks = [];

it('adds task', () => {
  tasks.push({ id: '1' }); // Affects next test!
  expect(tasks).toHaveLength(1);
});

// ✅ CORRECT: Reset state
describe('tasks', () => {
  let tasks: Task[];

  beforeEach(() => {
    tasks = [];
  });

  it('adds task', () => {
    tasks.push({ id: '1' });
    expect(tasks).toHaveLength(1);
  });
});
```

## Pre-Commit Testing Checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Coverage meets 80% threshold
- [ ] No skipped tests (`.skip`)
- [ ] No focused tests (`.only`)
- [ ] Mock external dependencies
- [ ] Clean up resources in `afterEach`

## Resources

- Vitest Documentation: https://vitest.dev/
- Testing Library: https://testing-library.com/
- React Testing Library: https://testing-library.com/react
- Project vitest.config: `/vitest.config.ts`
