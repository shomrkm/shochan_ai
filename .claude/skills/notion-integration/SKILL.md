---
name: notion-integration
description: Best practices for Notion API integration patterns. Use when implementing database queries, creating/updating pages, or handling Notion-specific error scenarios.
allowed-tools: Read, Grep, Glob, Bash
---

# Notion Integration Patterns

**Context**: Best practices for integrating with Notion API in the shochan_ai project.

## Database Structure

### Tasks Database
```
Properties:
- Title (title)
- Description (rich_text)
- Task Type (select): Today, Next Actions, Someday / Maybe, Wait for, Routine
- Scheduled Date (date)
- Status (select)
- Project (relation to Projects database)
```

### Projects Database
```
Properties:
- Name (title)
- Description (rich_text)
- Importance (select): ⭐, ⭐⭐, ⭐⭐⭐, ⭐⭐⭐⭐, ⭐⭐⭐⭐⭐
- Action Plan (rich_text)
```

## Common Patterns

### 1. Query Construction

**Safe Query Builder**:
```typescript
import { z } from 'zod';

const FilterSchema = z.object({
  taskType: z.enum(['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routine']).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function buildTaskQuery(filters: unknown) {
  const validated = FilterSchema.parse(filters);

  const filterConditions = [];

  if (validated.taskType) {
    filterConditions.push({
      property: 'Task Type',
      select: { equals: validated.taskType },
    });
  }

  if (validated.scheduledDate) {
    filterConditions.push({
      property: 'Scheduled Date',
      date: { on_or_after: validated.scheduledDate },
    });
  }

  return {
    database_id: process.env.NOTION_TASKS_DATABASE_ID!,
    filter: filterConditions.length > 0 ? { and: filterConditions } : undefined,
  };
}
```

### 2. Response Parsing

**Safe Property Access**:
```typescript
export function parseNotionTask(page: PageObjectResponse): Task {
  const props = page.properties;

  // Safe access with type guards and fallbacks
  const title =
    props.Title?.type === 'title'
      ? props.Title.title[0]?.plain_text ?? 'Untitled'
      : 'Untitled';

  const taskType =
    props['Task Type']?.type === 'select'
      ? (props['Task Type'].select?.name ?? 'Next Actions')
      : 'Next Actions';

  const scheduledDate =
    props['Scheduled Date']?.type === 'date'
      ? props['Scheduled Date'].date?.start
      : undefined;

  return {
    id: page.id,
    title,
    type: taskType as TaskType,
    scheduledDate,
    description: extractRichText(props.Description),
  };
}

function extractRichText(property: any): string | undefined {
  if (property?.type === 'rich_text') {
    return property.rich_text.map((rt: any) => rt.plain_text).join('');
  }
  return undefined;
}
```

### 3. Error Handling

**Notion-Specific Errors**:
```typescript
import { APIResponseError } from '@notionhq/client';

export async function getTasks(filters: unknown) {
  try {
    const query = buildTaskQuery(filters);
    const response = await notion.databases.query(query);
    return { success: true, data: response.results.map(parseNotionTask) };
  } catch (error) {
    console.error('Notion API error:', error);

    if (error instanceof APIResponseError) {
      switch (error.code) {
        case 'unauthorized':
          return { success: false, error: 'Notion authorization failed' };
        case 'object_not_found':
          return { success: false, error: 'Database not found' };
        case 'rate_limited':
          return { success: false, error: 'Rate limit exceeded. Please try again later.' };
        case 'validation_error':
          return { success: false, error: 'Invalid request parameters' };
        default:
          return { success: false, error: 'Notion API error' };
      }
    }

    return { success: false, error: 'Failed to fetch tasks' };
  }
}
```

### 4. Creating Pages

**Task Creation**:
```typescript
const CreateTaskInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: z.enum(['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routine']),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  projectId: z.string().optional(),
});

export async function createTask(input: unknown) {
  const validated = CreateTaskInputSchema.parse(input);

  const properties: any = {
    Title: {
      title: [{ text: { content: validated.title } }],
    },
    'Task Type': {
      select: { name: validated.type },
    },
  };

  if (validated.description) {
    properties.Description = {
      rich_text: [{ text: { content: validated.description } }],
    };
  }

  if (validated.scheduledDate) {
    properties['Scheduled Date'] = {
      date: { start: validated.scheduledDate },
    };
  }

  if (validated.projectId) {
    properties.Project = {
      relation: [{ id: validated.projectId }],
    };
  }

  try {
    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_TASKS_DATABASE_ID! },
      properties,
    });

    return { success: true, data: parseNotionTask(response as PageObjectResponse) };
  } catch (error) {
    return handleNotionError(error);
  }
}
```

### 5. Updating Pages

**Safe Updates**:
```typescript
const UpdateTaskInputSchema = z.object({
  taskId: z.string(),
  title: z.string().optional(),
  type: z.enum(['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routine']).optional(),
  status: z.string().optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function updateTask(input: unknown) {
  const validated = UpdateTaskInputSchema.parse(input);

  const properties: any = {};

  if (validated.title) {
    properties.Title = {
      title: [{ text: { content: validated.title } }],
    };
  }

  if (validated.type) {
    properties['Task Type'] = {
      select: { name: validated.type },
    };
  }

  if (validated.status) {
    properties.Status = {
      select: { name: validated.status },
    };
  }

  if (validated.scheduledDate) {
    properties['Scheduled Date'] = {
      date: { start: validated.scheduledDate },
    };
  }

  try {
    const response = await notion.pages.update({
      page_id: validated.taskId,
      properties,
    });

    return { success: true, data: parseNotionTask(response as PageObjectResponse) };
  } catch (error) {
    return handleNotionError(error);
  }
}
```

## Testing Patterns

### Mock Notion Client

```typescript
import { vi } from 'vitest';

vi.mock('@notionhq/client', () => ({
  Client: vi.fn(() => ({
    databases: {
      query: vi.fn(),
    },
    pages: {
      create: vi.fn(),
      update: vi.fn(),
    },
  })),
  APIResponseError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
```

### Test Data

```typescript
const mockNotionPage: PageObjectResponse = {
  id: 'page-123',
  properties: {
    Title: {
      type: 'title',
      title: [{ type: 'text', plain_text: 'Test Task', text: { content: 'Test Task' } }],
    },
    'Task Type': {
      type: 'select',
      select: { name: 'Today' },
    },
    'Scheduled Date': {
      type: 'date',
      date: { start: '2024-01-20' },
    },
  },
};
```

## Security Checklist

- [ ] API key from environment variable
- [ ] Database IDs from environment variable
- [ ] Input validation with Zod
- [ ] Safe property access with fallbacks
- [ ] Error messages don't expose database structure
- [ ] No hardcoded database IDs in code

## Performance Tips

1. **Pagination**: Always paginate large result sets
2. **Filtering**: Filter at query time, not in code
3. **Caching**: Cache database schemas and frequently accessed data
4. **Batch Operations**: Use batch APIs when possible

## Related Documentation

- API Security: `/.claude/rules/api-security.md`
- Client Package: `/packages/client/src/notion.ts`
- Notion API Docs: `https://developers.notion.com/reference`
