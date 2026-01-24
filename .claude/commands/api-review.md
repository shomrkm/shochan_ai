# /api-review Command

**Purpose**: Comprehensive security and reliability review of OpenAI and Notion API integration code.

## Command Invocation

- `/api-review` - Review all API integration code
- `/api-review openai` - Review only OpenAI integration
- `/api-review notion` - Review only Notion integration

## Execution Process

### Step 1: Identify API Code

**OpenAI Integration**:
- `packages/client/src/openai.ts`
- `packages/cli/src/agent/task-agent-tools.ts`
- Any file importing `openai` package

**Notion Integration**:
- `packages/client/src/notion.ts`
- `packages/client/src/notionUtils.ts`
- Any file importing `@notionhq/client`

### Step 2: Run Automated Checks

```bash
# Check for hardcoded secrets
grep -r "sk-proj-" packages/
grep -r "secret_" packages/
grep -r "api_key.*=" packages/

# Check environment variable usage
grep -r "process.env" packages/client/

# Check for any type usage
grep -r ": any" packages/client/

# Check error handling
grep -r "catch" packages/client/
```

### Step 3: Security Review

Invoke the **api-integration-reviewer** agent:
```
Use Task tool with subagent_type="api-integration-reviewer"
```

### Step 4: Generate Report

## Review Checklist

### 🔴 Critical Security Checks

#### 1. No Hardcoded Credentials
- [ ] No API keys in source code
- [ ] All keys from environment variables
- [ ] Environment validation on startup

```typescript
// ✅ CORRECT
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY required');

// ❌ WRONG
const apiKey = 'sk-proj-abc123';
```

#### 2. Input Validation
- [ ] All inputs validated with Zod
- [ ] Type guards for runtime checks
- [ ] No `any` types at API boundaries

```typescript
// ✅ CORRECT
const input = CreateTaskSchema.parse(rawInput);

// ❌ WRONG
const input: any = rawInput;
```

#### 3. Error Message Safety
- [ ] No API keys in error messages
- [ ] No database IDs exposed
- [ ] Generic user-facing errors

```typescript
// ✅ CORRECT
return { error: 'Failed to create task' };

// ❌ WRONG
return { error: error.message }; // May expose secrets
```

#### 4. Rate Limiting
- [ ] Rate limiter implemented
- [ ] Appropriate limits configured
- [ ] Backoff strategy defined

```typescript
// ✅ CORRECT
const limiter = new RateLimiter(60, 60000);
await limiter.acquire();
await openai.chat.completions.create(...);
```

### 🟠 High Priority Checks

#### 5. Timeout Configuration
- [ ] Timeouts set on API clients
- [ ] Reasonable timeout values (30s typical)
- [ ] Retry logic implemented

```typescript
// ✅ CORRECT
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});
```

#### 6. Error Handling
- [ ] Try-catch blocks present
- [ ] Specific error types handled
- [ ] Fallback strategies defined

```typescript
// ✅ CORRECT
try {
  return await openai.chat.completions.create(...);
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      return handleRateLimit();
    }
  }
  throw new ApplicationError('OpenAI request failed');
}
```

#### 7. Type Safety
- [ ] No `any` types used
- [ ] Zod schemas for all inputs
- [ ] Type guards for responses

### 🟡 Medium Priority Checks

#### 8. Cost Monitoring
- [ ] Token usage tracked
- [ ] Logging for cost analysis
- [ ] Model selection appropriate

```typescript
// ✅ CORRECT
const response = await openai.chat.completions.create(...);
console.log('Token usage:', response.usage);
```

#### 9. Query Optimization
- [ ] Pagination implemented
- [ ] Filter complexity reasonable
- [ ] Response parsing efficient

#### 10. Testing Coverage
- [ ] Unit tests for API clients
- [ ] Mocked external APIs
- [ ] Error scenarios tested

## Report Format

### Success Report

```markdown
# API Integration Review ✅

**Date**: [timestamp]
**Reviewer**: Claude Code
**Files Reviewed**:
- packages/client/src/openai.ts
- packages/client/src/notion.ts

## Summary
All API integrations pass security and reliability checks.

## Security ✅
- ✅ No hardcoded credentials
- ✅ Input validation with Zod
- ✅ Safe error messages
- ✅ Rate limiting implemented

## Reliability ✅
- ✅ Timeouts configured (30s)
- ✅ Retry logic present (max 2)
- ✅ Comprehensive error handling

## Best Practices ✅
- ✅ Token usage monitoring
- ✅ Type safety maintained
- ✅ Test coverage adequate (85%)

## Recommendations
- Consider adding request tracing for debugging
- Monitor API costs in production

## Approval
✅ **APPROVED** - Ready for production
```

### Failure Report

```markdown
# API Integration Review ❌

**Date**: [timestamp]
**Files Reviewed**:
- packages/client/src/openai.ts

## Summary
Critical security issues found. Must fix before deployment.

## 🔴 Critical Issues

### Issue 1: Hardcoded API Key
**File**: `packages/client/src/openai.ts:15`
**Severity**: CRITICAL

**Problem**:
```typescript
const openai = new OpenAI({
  apiKey: 'sk-proj-abc123', // ❌ Hardcoded!
});
```

**Fix**:
```typescript
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
const openai = new OpenAI({ apiKey });
```

### Issue 2: No Input Validation
**File**: `packages/client/src/notion.ts:42`
**Severity**: CRITICAL

**Problem**:
API accepts unvalidated input directly from user.

**Fix**:
Add Zod schema validation before processing.

## 🟠 High Priority Issues

### Issue 3: Missing Error Handling
**File**: `packages/client/src/openai.ts:55`
**Severity**: HIGH

**Problem**:
No try-catch block for API call.

**Fix**:
Wrap API calls in proper error handling.

## Approval
❌ **BLOCKED** - Fix critical issues before proceeding

## Next Steps
1. Fix Issue 1: Remove hardcoded API key
2. Fix Issue 2: Add input validation
3. Fix Issue 3: Add error handling
4. Re-run `/api-review` to verify fixes
```

## Usage Examples

### Example 1: Pre-Deployment Review
```
User: "Review the API integrations before deployment"
Assistant: [Runs /api-review]
Assistant: [Provides comprehensive security report]
```

### Example 2: After API Changes
```
User: "I updated the OpenAI integration, can you review it?"
Assistant: [Runs /api-review openai]
Assistant: [Reports on OpenAI-specific changes]
```

### Example 3: Security Audit
```
User: "Audit all API security"
Assistant: [Runs /api-review]
Assistant: [Checks for hardcoded secrets, validates error handling]
```

## Integration with Development Workflow

### Before Commit
```bash
# 1. Review API changes
/api-review

# 2. Fix any issues found
# 3. Re-review
/api-review

# 4. Commit when approved
git commit -m "fix: improve API error handling"
```

### Before Pull Request
```bash
# Ensure API code passes security review
/api-review

# Generate report for PR description
```

### Scheduled Reviews
Run `/api-review` weekly or when:
- API dependencies updated
- New API endpoints added
- Security patches released
- Environment configuration changes

## Tools Used

The command leverages:
1. **Grep**: Find patterns in code
2. **Read**: Examine API client files
3. **Task**: Invoke api-integration-reviewer agent
4. **Bash**: Run security checks

## Related Documentation

- API Security Rules: `/.claude/rules/api-security.md`
- API Integration Reviewer: `/.claude/agents/api-integration-reviewer.md`
- Environment Setup: `/.env.example`

## Post-Review Actions

After successful review:

1. **Document Findings**:
   - Save report for audit trail
   - Update security documentation

2. **Update Configuration**:
   - Rotate credentials if needed
   - Update environment variables

3. **Continuous Monitoring**:
   - Set up alerts for API errors
   - Monitor token usage and costs
   - Track rate limit incidents

## Performance Tips

- Review incremental changes only when possible
- Cache review results for unchanged files
- Automate checks in pre-commit hooks
- Include in CI/CD pipeline

## Emergency Response

If secrets are found hardcoded:

1. **STOP** all development
2. **Rotate** compromised credentials immediately
3. **Scan** git history for exposure
4. **Remove** from repository history
5. **Update** all affected systems
6. **Document** incident

Contact security team if production credentials are compromised.
