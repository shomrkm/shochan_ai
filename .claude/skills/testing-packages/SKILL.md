---
name: testing-packages
description: Runs tests for specific packages or all packages with coverage reporting. Use when the user asks to run tests, check test coverage, debug failing tests, or validate code changes across the monorepo.
---

# Testing Packages

## Workflow

Copy this checklist and track progress:

```
Test Progress:
- [ ] Step 1: Build packages
- [ ] Step 2: Run tests
- [ ] Step 3: Check coverage (if requested)
- [ ] Step 4: Report results
```

### Step 1: Build Packages

Tests may depend on built artifacts:
```bash
pnpm build
```

### Step 2: Run Tests

```bash
# All packages
pnpm test

# Specific package
pnpm --filter @shochan_ai/core test

# Watch mode
pnpm --filter @shochan_ai/web-ui test:watch
```

### Step 3: Check Coverage

Project requires **80% minimum** across statements, branches, functions, and lines.

```bash
# Generate coverage report
pnpm test -- --coverage

# View HTML report
open coverage/index.html
```

### Step 4: Report Results

Report pass/fail counts and coverage percentages (if requested)

## Common Failures and Fixes

**Module not found**: Build the package first (`pnpm build`)

**Mock not configured**: Add `vi.mock()` for external dependencies

**Environment variables missing**: Set test env vars in `beforeEach`:
```typescript
beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test_key';
  process.env.NOTION_API_KEY = 'test_key';
});
```

**Async timeout**: Increase timeout in `waitFor`:
```typescript
await waitFor(() => {
  expect(result.current.data).toBeDefined();
}, { timeout: 10000 });
```

## Related

- Testing Standards: `.claude/rules/testing.md`
- Vitest Config: `vitest.config.ts`
