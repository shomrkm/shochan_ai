---
name: nextjs-development
description: Next.js 16 development workflow with App Router, React 19, and modern tooling. Use when creating pages, components, API routes, or working with data fetching patterns.
allowed-tools: Read, Grep, Glob, Bash
---

# Next.js Development Workflow

**Context**: Next.js 16 with App Router, React 19, and modern tooling for the web-ui package.

## Tech Stack

- **Next.js 16**: App Router with Server Components
- **React 19**: Latest features (useTransition, etc.)
- **TanStack Query**: Data fetching and caching
- **shadcn/ui**: Component library
- **Tailwind CSS**: Utility-first styling
- **Vitest**: Unit and component testing
- **Storybook**: Component documentation

## Development Workflow

### 1. Starting Development

```bash
# Start Next.js dev server
pnpm --filter @shochan_ai/web-ui dev

# Opens http://localhost:3000
```

### 2. Project Structure

```
packages/web-ui/
├── app/                    # App Router pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── tasks/             # Tasks feature
│   │   ├── page.tsx       # Server Component
│   │   └── [id]/          # Dynamic route
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── card.tsx
│   └── features/         # Feature components
│       ├── task-list.tsx
│       └── task-form.tsx
├── hooks/                # Custom React hooks
│   ├── use-tasks.ts
│   └── use-send-message.ts
├── lib/                  # Utilities
│   └── utils.ts
└── stories/             # Storybook stories
    └── button.stories.tsx
```

### 3. Creating New Pages

**Server Component Page** (default):
```typescript
// app/tasks/page.tsx
export default async function TasksPage() {
  // Fetch data directly in Server Component
  const response = await fetch('http://localhost:3001/api/tasks');
  const tasks = await response.json();

  return (
    <div>
      <h1>Tasks</h1>
      <TaskList tasks={tasks} />
    </div>
  );
}
```

**Dynamic Route**:
```typescript
// app/tasks/[id]/page.tsx
interface Props {
  params: { id: string };
}

export default async function TaskDetailPage({ params }: Props) {
  const task = await fetch(`http://localhost:3001/api/tasks/${params.id}`);

  return <TaskDetail task={task} />;
}
```

### 4. Creating Components

**Step 1: Create Component File**
```bash
# Create in appropriate directory
touch packages/web-ui/components/features/task-card.tsx
```

**Step 2: Define Component**
```typescript
// components/features/task-card.tsx
interface TaskCardProps {
  task: {
    id: string;
    title: string;
    status: 'pending' | 'completed';
  };
  onComplete?: (id: string) => void;
}

export function TaskCard({ task, onComplete }: TaskCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">{task.title}</h3>
      <p className="text-sm text-gray-500">{task.status}</p>
      {onComplete && (
        <button onClick={() => onComplete(task.id)}>Complete</button>
      )}
    </div>
  );
}
```

**Step 3: Write Tests**
```typescript
// __tests__/components/task-card.test.tsx
import { render, screen } from '@testing-library/react';
import { TaskCard } from '@/components/features/task-card';

describe('TaskCard', () => {
  it('renders task information', () => {
    const task = { id: '1', title: 'Test', status: 'pending' as const };
    render(<TaskCard task={task} />);

    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

**Step 4: Create Story**
```typescript
// stories/task-card.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { TaskCard } from '../components/features/task-card';

const meta: Meta<typeof TaskCard> = {
  title: 'Features/TaskCard',
  component: TaskCard,
};

export default meta;
type Story = StoryObj<typeof TaskCard>;

export const Default: Story = {
  args: {
    task: { id: '1', title: 'Example Task', status: 'pending' },
  },
};
```

### 5. Data Fetching with TanStack Query

**Create Custom Hook**:
```typescript
// hooks/use-tasks.ts
'use client';

import { useQuery } from '@tanstack/react-query';

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      return response.json();
    },
    staleTime: 5000, // 5 seconds
  });
}
```

**Use in Client Component**:
```typescript
// components/features/task-list-client.tsx
'use client';

import { useTasks } from '@/hooks/use-tasks';

export function TaskListClient() {
  const { data: tasks, isLoading, error } = useTasks();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
```

### 6. Using shadcn/ui Components

**Install Component**:
```bash
pnpx shadcn@latest add button
pnpx shadcn@latest add input
pnpx shadcn@latest add card
```

**Use Component**:
```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function TaskForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Task</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Task title" />
        <Button type="submit">Create</Button>
      </CardContent>
    </Card>
  );
}
```

### 7. API Routes

**Create API Route**:
```typescript
// app/api/tasks/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://localhost:3001/api/tasks');
    const tasks = await response.json();
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch('http://localhost:3001/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const task = await response.json();
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
```

## Testing Workflow

### Run Tests
```bash
# Run all tests
pnpm --filter @shochan_ai/web-ui test

# Watch mode
pnpm --filter @shochan_ai/web-ui test:watch

# Coverage
pnpm --filter @shochan_ai/web-ui test:coverage
```

### Run Storybook
```bash
# Start Storybook dev server
pnpm --filter @shochan_ai/web-ui storybook

# Build Storybook
pnpm --filter @shochan_ai/web-ui build-storybook
```

## Building and Deployment

### Development Build
```bash
# Build Next.js
pnpm --filter @shochan_ai/web-ui build

# Output: .next/ directory
```

### Production Build
```bash
# Build for production
pnpm --filter @shochan_ai/web-ui build

# Start production server
pnpm --filter @shochan_ai/web-ui start
```

## Common Patterns

### Loading States

**Suspense**:
```typescript
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense fallback={<TaskListSkeleton />}>
      <TaskListServer />
    </Suspense>
  );
}
```

**Skeleton Component**:
```typescript
export function TaskListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border p-4">
          <div className="h-6 w-3/4 bg-gray-200 rounded" />
          <div className="mt-2 h-4 w-1/2 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}
```

### Error Handling

**Error Boundary**:
```typescript
// app/tasks/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Form Handling

**With React 19 useTransition**:
```typescript
'use client';

import { useTransition } from 'react';

export function TaskForm() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      await fetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.get('title'),
        }),
      });
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input name="title" disabled={isPending} />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create'}
      </Button>
    </form>
  );
}
```

## Performance Optimization

### Image Optimization
```typescript
import Image from 'next/image';

<Image
  src="/avatar.png"
  alt="Avatar"
  width={40}
  height={40}
  className="rounded-full"
/>
```

### Code Splitting
```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./heavy-component'), {
  loading: () => <div>Loading...</div>,
  ssr: false, // Disable SSR if needed
});
```

### Memoization
```typescript
'use client';

import { memo, useMemo } from 'react';

export const TaskList = memo(function TaskList({ tasks, filter }) {
  const filteredTasks = useMemo(
    () => tasks.filter((t) => t.title.includes(filter)),
    [tasks, filter]
  );

  return <div>{/* render */}</div>;
});
```

## Environment Variables

**Public Variables** (exposed to browser):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Server-Only Variables**:
```env
DATABASE_URL=postgresql://...
API_SECRET=secret
```

**Usage**:
```typescript
// Client or Server Component
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Server Component only
const secret = process.env.API_SECRET;
```

## Troubleshooting

### Issue: "Hydration Error"
**Cause**: Server and client render different content
**Fix**: Ensure Server Component output matches client

### Issue: "Cannot use hooks in Server Component"
**Cause**: Using `useState`, `useEffect` in Server Component
**Fix**: Add `'use client'` directive

### Issue: "Module not found"
**Cause**: Incorrect import path
**Fix**: Use `@/` alias or check tsconfig paths

## Related Documentation

- Next.js Patterns: `/.claude/rules/nextjs-patterns.md`
- shadcn/ui: `https://ui.shadcn.com/`
- TanStack Query: `https://tanstack.com/query/latest`
- Next.js Docs: `https://nextjs.org/docs`
