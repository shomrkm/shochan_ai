# Next.js Development Patterns

> **Context**: This project uses Next.js 16 with App Router, React 19, and Server Components.

## Project Structure (web-ui package)

```
packages/web-ui/
├── app/                    # App Router (Next.js 16)
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── ...
├── components/            # Reusable React components
│   ├── ui/               # shadcn/ui components
│   └── features/         # Feature-specific components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and helpers
├── stories/              # Storybook stories
└── __tests__/            # Vitest + Testing Library tests
```

## App Router Patterns

### Server Components (Default)

**✅ CORRECT: Use Server Components by default**
```typescript
// app/tasks/page.tsx
export default async function TasksPage() {
  // Fetch data directly in Server Component
  const tasks = await fetch('http://localhost:3001/api/tasks').then(r => r.json());

  return (
    <div>
      <h1>Tasks</h1>
      <TaskList tasks={tasks} />
    </div>
  );
}
```

**Benefits:**
- No client-side JavaScript for data fetching
- Better performance and SEO
- Direct database/API access

### Client Components

**Use `'use client'` only when needed:**
```typescript
// components/task-form.tsx
'use client';

import { useState } from 'react';

export function TaskForm() {
  const [title, setTitle] = useState('');

  // Client-side interactivity
  const handleSubmit = () => {
    // Handle form submission
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**When to use Client Components:**
- Event handlers (`onClick`, `onChange`, etc.)
- React hooks (`useState`, `useEffect`, etc.)
- Browser APIs (`localStorage`, `window`, etc.)
- Third-party libraries requiring client-side code

## Data Fetching

### TanStack Query (React Query)

**✅ CORRECT: Use for client-side data fetching**
```typescript
// hooks/use-tasks.ts
'use client';

import { useQuery } from '@tanstack/react-query';

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
  });
}

// Usage in component
'use client';

export function TaskList() {
  const { data: tasks, isLoading, error } = useTasks();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{tasks.map(task => ...)}</div>;
}
```

### API Routes (Route Handlers)

**✅ CORRECT: Define API routes in app/api/**
```typescript
// app/api/tasks/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const tasks = await fetchTasksFromBackend();
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  // Handle POST request
  return NextResponse.json({ success: true });
}
```

## Component Patterns

### Composition

**✅ CORRECT: Compose components properly**
```typescript
// components/card.tsx
interface CardProps {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-bold">{title}</h3>
      {children}
    </div>
  );
}

// Usage
<Card title="Task Details">
  <TaskForm />
</Card>
```

### shadcn/ui Components

**✅ CORRECT: Use shadcn/ui for UI primitives**
```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TaskForm() {
  return (
    <form>
      <Input placeholder="Task title" />
      <Button type="submit">Create Task</Button>
    </form>
  );
}
```

**Available shadcn/ui components:**
- See `components.json` for installed components
- Add new components: `pnpx shadcn@latest add <component>`

## Styling with Tailwind CSS

### Utility Classes

**✅ CORRECT: Use Tailwind utility classes**
```typescript
export function TaskCard({ task }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
      <h3 className="text-lg font-semibold">{task.title}</h3>
      <span className="text-sm text-gray-500">{task.status}</span>
    </div>
  );
}
```

### Class Variance Authority (CVA)

**✅ CORRECT: Use CVA for component variants**
```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'rounded-lg font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      },
      size: {
        sm: 'px-3 py-1 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
}

export function Button({ variant, size, children }: ButtonProps) {
  return <button className={buttonVariants({ variant, size })}>{children}</button>;
}
```

## Performance Optimization

### React 19 Features

**Use React 19 improvements:**
```typescript
// Automatic batching (already enabled)
// Transitions for better UX
import { useTransition } from 'react';

function SearchBar() {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');

  const handleChange = (e) => {
    startTransition(() => {
      setQuery(e.target.value);
    });
  };

  return <input value={query} onChange={handleChange} />;
}
```

### Image Optimization

**✅ CORRECT: Use Next.js Image component**
```typescript
import Image from 'next/image';

export function Avatar({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={40}
      height={40}
      className="rounded-full"
    />
  );
}
```

### Dynamic Imports

**✅ CORRECT: Code split heavy components**
```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./heavy-component'), {
  loading: () => <div>Loading...</div>,
});

export function Page() {
  return <HeavyComponent />;
}
```

## Testing with Vitest

### Component Tests

**✅ CORRECT: Test components with Testing Library**
```typescript
// __tests__/task-card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TaskCard } from '../components/task-card';

describe('TaskCard', () => {
  it('renders task title', () => {
    const task = { id: '1', title: 'Test Task', status: 'pending' };
    render(<TaskCard task={task} />);

    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });
});
```

### Storybook Integration

**✅ CORRECT: Document components with stories**
```typescript
// stories/task-card.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { TaskCard } from '../components/task-card';

const meta: Meta<typeof TaskCard> = {
  title: 'Components/TaskCard',
  component: TaskCard,
};

export default meta;
type Story = StoryObj<typeof TaskCard>;

export const Default: Story = {
  args: {
    task: {
      id: '1',
      title: 'Example Task',
      status: 'pending',
    },
  },
};
```

## Environment Variables

**✅ CORRECT: Use Next.js environment variable conventions**
```typescript
// Public variables (exposed to browser)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Server-only variables
const secretKey = process.env.SECRET_KEY; // Only in Server Components/API Routes
```

## Common Pitfalls

### ❌ Using Client-side APIs in Server Components
```typescript
// ❌ WRONG: localStorage in Server Component
export default function Page() {
  const token = localStorage.getItem('token'); // Error!
  return <div>{token}</div>;
}

// ✅ CORRECT: Move to Client Component
'use client';
export default function Page() {
  const token = localStorage.getItem('token'); // OK
  return <div>{token}</div>;
}
```

### ❌ Not Handling Loading States
```typescript
// ❌ WRONG: No loading state
function TaskList() {
  const { data } = useTasks();
  return <div>{data.map(...)}</div>; // Error if data is undefined!
}

// ✅ CORRECT: Handle loading
function TaskList() {
  const { data, isLoading } = useTasks();
  if (isLoading) return <div>Loading...</div>;
  return <div>{data?.map(...) ?? null}</div>;
}
```

## Commands

```bash
# Development
pnpm --filter @shochan_ai/web-ui dev

# Build
pnpm --filter @shochan_ai/web-ui build

# Test
pnpm --filter @shochan_ai/web-ui test

# Storybook
pnpm --filter @shochan_ai/web-ui storybook
```

## Resources

- Next.js 16 Docs: https://nextjs.org/docs
- React 19 Docs: https://react.dev/
- shadcn/ui: https://ui.shadcn.com/
- TanStack Query: https://tanstack.com/query/latest
- Tailwind CSS: https://tailwindcss.com/
