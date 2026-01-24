# API Security Standards

> **Context**: This project integrates with OpenAI API and Notion API, requiring strict security practices.

## Critical Security Rules (NEVER VIOLATE)

### 1. No Hardcoded Secrets ⚠️ CRITICAL

**❌ NEVER hardcode API keys, tokens, or passwords:**
```typescript
// ❌ WRONG: Hardcoded credentials
const OPENAI_API_KEY = 'sk-proj-abc123...';
const NOTION_API_KEY = 'secret_xyz789...';

const client = new OpenAI({
  apiKey: 'sk-proj-abc123...',
});
```

**✅ ALWAYS use environment variables:**
```typescript
// ✅ CORRECT: Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NOTION_API_KEY = process.env.NOTION_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
});
```

**Environment Variable Validation:**
```typescript
// packages/client/src/openai.ts
export function validateEnv() {
  const required = [
    'OPENAI_API_KEY',
    'NOTION_API_KEY',
    'NOTION_TASKS_DATABASE_ID',
    'NOTION_PROJECTS_DATABASE_ID',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
```

### 2. Input Validation ⚠️ CRITICAL

**✅ ALWAYS validate user input with Zod:**
```typescript
import { z } from 'zod';

// Define schema
const CreateTaskInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: z.enum(['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routine']),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Validate before processing
export function createTask(input: unknown) {
  const validation = CreateTaskInputSchema.safeParse(input);

  if (!validation.success) {
    throw new Error(`Invalid input: ${validation.error.message}`);
  }

  return executeCreateTask(validation.data);
}
```

**❌ NEVER trust external data without validation:**
```typescript
// ❌ WRONG: No validation
export function createTask(input: any) {
  return notion.createPage({
    title: input.title, // Could be malicious
    description: input.description,
  });
}
```

### 3. API Key Exposure Prevention

**Server-Side Only:**
```typescript
// ✅ CORRECT: API keys only in server-side code
// packages/client/src/openai.ts (Node.js environment)
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

**❌ NEVER expose API keys to client:**
```typescript
// ❌ WRONG: In Next.js client component
'use client';
import OpenAI from 'openai';

export function ChatComponent() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // ❌ Exposed to browser!
  });
}
```

**✅ CORRECT: Use API routes for client-side calls:**
```typescript
// app/api/chat/route.ts (Server-side)
import { openai } from '@/lib/openai';

export async function POST(request: Request) {
  const body = await request.json();
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: body.messages,
  });
  return Response.json(response);
}

// Client component
'use client';
export function ChatComponent() {
  const sendMessage = async (message: string) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
    });
    return response.json();
  };
}
```

## OpenAI API Security

### Rate Limiting

**✅ Implement rate limiting for OpenAI calls:**
```typescript
// Simple rate limiter
class RateLimiter {
  private calls: number[] = [];
  private readonly maxCalls: number;
  private readonly timeWindow: number;

  constructor(maxCalls: number, timeWindowMs: number) {
    this.maxCalls = maxCalls;
    this.timeWindow = timeWindowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.calls = this.calls.filter((time) => now - time < this.timeWindow);

    if (this.calls.length >= this.maxCalls) {
      const oldestCall = this.calls[0];
      const waitTime = this.timeWindow - (now - oldestCall);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.calls.push(now);
  }
}

const openaiLimiter = new RateLimiter(10, 60000); // 10 calls per minute

export async function callOpenAI(params: any) {
  await openaiLimiter.acquire();
  return openai.chat.completions.create(params);
}
```

### Timeout Configuration

**✅ Set reasonable timeouts:**
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 seconds
  maxRetries: 2,
});
```

### Cost Management

**✅ Monitor token usage:**
```typescript
export async function callOpenAIWithMonitoring(messages: any[]) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
  });

  const usage = response.usage;
  console.log('Token usage:', {
    prompt: usage?.prompt_tokens,
    completion: usage?.completion_tokens,
    total: usage?.total_tokens,
  });

  return response;
}
```

## Notion API Security

### Database ID Protection

**✅ CORRECT: Store database IDs in environment variables:**
```typescript
const TASKS_DATABASE_ID = process.env.NOTION_TASKS_DATABASE_ID;
const PROJECTS_DATABASE_ID = process.env.NOTION_PROJECTS_DATABASE_ID;

if (!TASKS_DATABASE_ID || !PROJECTS_DATABASE_ID) {
  throw new Error('Notion database IDs not configured');
}
```

### Query Sanitization

**✅ Sanitize filter parameters:**
```typescript
export function buildNotionQuery(filters: unknown) {
  // Validate filter structure
  const FilterSchema = z.object({
    property: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  });

  const validatedFilters = z.array(FilterSchema).parse(filters);

  return {
    database_id: TASKS_DATABASE_ID,
    filter: {
      and: validatedFilters.map((f) => ({
        property: f.property,
        equals: f.value,
      })),
    },
  };
}
```

### Error Handling

**✅ Don't expose sensitive error details:**
```typescript
// ✅ CORRECT: Generic error messages
export async function getTasks() {
  try {
    const response = await notion.databases.query({
      database_id: TASKS_DATABASE_ID,
    });
    return { success: true, data: response.results };
  } catch (error) {
    console.error('Notion API error:', error); // Log internally

    // Don't expose internal error details
    return {
      success: false,
      error: 'Failed to fetch tasks. Please try again.',
    };
  }
}

// ❌ WRONG: Exposing internal details
export async function getTasks() {
  try {
    // ...
  } catch (error) {
    return {
      success: false,
      error: error.message, // ❌ Could expose API keys, database IDs, etc.
    };
  }
}
```

## Environment Variable Management

### .env File Structure

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...

# Notion Configuration
NOTION_API_KEY=secret_...
NOTION_TASKS_DATABASE_ID=...
NOTION_PROJECTS_DATABASE_ID=...

# Server Configuration (web-ui)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### .env.example

**✅ ALWAYS maintain .env.example:**
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Notion Configuration
NOTION_API_KEY=your_notion_api_key_here
NOTION_TASKS_DATABASE_ID=your_notion_tasks_database_id
NOTION_PROJECTS_DATABASE_ID=your_notion_projects_database_id

# Server Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### .gitignore

**✅ Ensure .env is ignored:**
```gitignore
# Environment variables
.env
.env.local
.env.*.local
```

## Pre-Commit Security Checklist

Before every commit:

- [ ] No hardcoded API keys or secrets
- [ ] All environment variables validated
- [ ] Input validation with Zod schemas
- [ ] Error messages don't expose sensitive data
- [ ] API keys only in server-side code
- [ ] Rate limiting implemented for external APIs
- [ ] .env file not committed (check .gitignore)
- [ ] .env.example is up to date

## Security Incident Response

**If a secret is accidentally committed:**

1. **Immediately rotate the compromised credentials**
   - OpenAI: Generate new API key
   - Notion: Regenerate integration token

2. **Update environment variables**
   ```bash
   # Update .env with new credentials
   OPENAI_API_KEY=new_key_here
   NOTION_API_KEY=new_key_here
   ```

3. **Remove from Git history**
   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch .env' \
     --prune-empty --tag-name-filter cat -- --all
   ```

4. **Force push** (coordinate with team)
   ```bash
   git push origin --force --all
   ```

5. **Audit codebase for similar issues**

## Resources

- OpenAI API Best Practices: https://platform.openai.com/docs/guides/production-best-practices
- Notion API Security: https://developers.notion.com/docs/authorization
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Environment Variables: `/. env.example`
