# /package-test Command

**Purpose**: Run tests for a specific package or all packages with coverage reporting.

## Command Invocation

- `/package-test` - Test all packages
- `/package-test core` - Test specific package
- `/package-test --coverage` - Test with coverage report

## Execution Steps

### Test All Packages

```bash
# Build first (tests may depend on built artifacts)
pnpm build

# Run all tests
pnpm test
```

### Test Specific Package

```bash
# Test core package
pnpm --filter @shochan_ai/core test

# Test client package
pnpm --filter @shochan_ai/client test

# Test web-ui package
pnpm --filter @shochan_ai/web-ui test
```

### Test with Coverage

```bash
# All packages with coverage
pnpm test -- --coverage

# Specific package with coverage
pnpm --filter @shochan_ai/core test -- --coverage
```

### Watch Mode (for development)

```bash
# Watch mode for specific package
pnpm --filter @shochan_ai/web-ui test:watch
```

## Test Report Format

**Success Output**:
```markdown
✅ Tests Passed

**Package**: @shochan_ai/core
**Tests**: 45 passed, 45 total
**Time**: 2.5s

**Coverage**:
- Statements: 87.5% (✅ > 80%)
- Branches: 82.3% (✅ > 80%)
- Functions: 91.2% (✅ > 80%)
- Lines: 86.8% (✅ > 80%)
```

**Failure Output**:
```markdown
❌ Tests Failed

**Package**: @shochan_ai/core
**Tests**: 43 passed, 2 failed, 45 total

**Failed Tests**:

1. **orchestrator.test.ts**: "processes user message correctly"
   - Expected: { success: true }
   - Received: { success: false, error: "..." }
   - File: packages/core/src/agent/__tests__/orchestrator.test.ts:42

2. **toolGuards.test.ts**: "validates create task call"
   - Expected: true
   - Received: false
   - File: packages/core/src/types/__tests__/toolGuards.test.ts:15

**Recommendation**:
Review the failing tests and fix the underlying issues.
```

## Coverage Requirements

Project requires **80% minimum coverage** across:
- Statements
- Branches
- Functions
- Lines

**Coverage Report Location**:
```
coverage/
├── index.html      # HTML report
├── lcov.info       # LCOV format
└── coverage-final.json
```

**View Coverage**:
```bash
# Open HTML coverage report
open coverage/index.html
```

## Test Organization

### Package-Specific Tests

**Core Package** (`packages/core`):
- Agent orchestration logic
- Type guards
- Utility functions
- Business logic

**Client Package** (`packages/client`):
- API client mocking
- Response parsing
- Error handling
- Integration scenarios

**Web-UI Package** (`packages/web-ui`):
- Component rendering
- User interactions
- Hooks behavior
- Form submissions

## Common Test Failures

### 1. Mock Not Configured
```
Error: Cannot find module '@notionhq/client'
```

**Fix**:
```typescript
vi.mock('@notionhq/client', () => ({
  Client: vi.fn(() => ({ /* mock implementation */ })),
}));
```

### 2. Async Test Timeout
```
Error: Timeout - Async callback was not invoked within the 5000ms timeout
```

**Fix**:
```typescript
it('fetches data', async () => {
  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  }, { timeout: 10000 });
});
```

### 3. Environment Variables Missing
```
Error: OPENAI_API_KEY is required
```

**Fix**:
```typescript
beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test_key';
  process.env.NOTION_API_KEY = 'test_key';
});
```

### 4. Type Error in Test
```
Error: Argument of type 'string' is not assignable to parameter of type 'TaskType'
```

**Fix**: Use proper types in test data:
```typescript
const mockTask: Task = {
  id: '1',
  title: 'Test',
  type: 'Today' as TaskType, // Proper type
};
```

## Test-Driven Development (TDD)

When using TDD workflow:

### 1. RED - Write Failing Test
```bash
pnpm --filter @shochan_ai/core test
# Test should fail
```

### 2. GREEN - Implement Feature
```bash
# Write minimal implementation
pnpm --filter @shochan_ai/core test
# Test should pass
```

### 3. REFACTOR - Improve Code
```bash
# Refactor implementation
pnpm --filter @shochan_ai/core test
# Test should still pass
```

## Integration with CI/CD

Tests run automatically in CI:
```yaml
# .github/workflows/test.yml
- name: Run tests
  run: pnpm test --coverage
```

## Usage Examples

### Example 1: Test Single Package
```
User: "Test the core package"
Assistant: [Runs pnpm --filter @shochan_ai/core test]
```

### Example 2: Test with Coverage
```
User: "Run tests with coverage report"
Assistant: [Runs pnpm test -- --coverage]
Assistant: [Opens coverage/index.html]
```

### Example 3: Debug Failing Test
```
User: "The orchestrator test is failing"
Assistant: [Runs test, analyzes failure, suggests fix]
```

### Example 4: Watch Mode for Development
```
User: "Run web-ui tests in watch mode"
Assistant: [Runs pnpm --filter @shochan_ai/web-ui test:watch]
```

## Post-Test Actions

After tests pass:

1. **Check Coverage**:
   - Ensure 80%+ coverage maintained
   - Identify untested code paths

2. **Review Test Quality**:
   - Tests cover edge cases
   - Mocks are appropriate
   - Assertions are meaningful

3. **Update Documentation**:
   - Document new test patterns
   - Update README if needed

## Performance Tips

- **Parallel Execution**: Vitest runs tests in parallel by default
- **Watch Mode**: Use for development to get instant feedback
- **Coverage Caching**: Coverage data is cached between runs
- **Isolated Tests**: Each test should be independent

## Related Documentation

- Testing Standards: `/.claude/rules/testing.md`
- Vitest Config: `/vitest.config.ts`
- Vitest Docs: `https://vitest.dev/`
