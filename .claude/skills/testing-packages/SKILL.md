---
name: testing-packages
description: Runs tests for specific packages or all packages with coverage reporting. Use when the user asks to run tests, check test coverage, debug failing tests, or validate code changes across the monorepo.
---

# Testing Packages

## Quick Start

```bash
# Test all packages (build first)
pnpm build && pnpm test

# Test specific package
pnpm --filter @shochan_ai/core test

# Test with coverage
pnpm test -- --coverage

# Watch mode
pnpm --filter @shochan_ai/web-ui test:watch
```

## Workflow

1. Build packages (tests may depend on built artifacts)
2. Run tests for target package(s)
3. Report results with pass/fail counts
4. If `--coverage` requested, verify 80% minimum threshold

## Package-Specific Commands

```bash
pnpm --filter @shochan_ai/core test
pnpm --filter @shochan_ai/client test
pnpm --filter @shochan_ai/cli test
pnpm --filter @shochan_ai/web test
pnpm --filter @shochan_ai/web-ui test
```

## Coverage Requirements

Project requires **80% minimum** across statements, branches, functions, and lines.

```bash
# Generate coverage report
pnpm test -- --coverage

# View HTML report
open coverage/index.html
```

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

## Report Format

After running tests, provide a summary:
- Package name
- Tests passed / failed / total
- Coverage percentages (if requested)
- Specific failure details with file paths and line numbers
- Recommended fixes for failures

## Related

- Testing Standards: `.claude/rules/testing.md`
- Vitest Config: `vitest.config.ts`
