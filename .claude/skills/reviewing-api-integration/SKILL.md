---
name: reviewing-api-integration
description: Comprehensive security and reliability review of OpenAI and Notion API integration code. Use when reviewing API code before deployment, after API changes, or during security audits. Triggers on requests for API review, security audit, or pre-deployment checks.
---

# Reviewing API Integration

## Workflow

Copy this checklist and track progress:

```
Review Progress:
- [ ] Step 1: Identify API code
- [ ] Step 2: Run automated checks
- [ ] Step 3: Security review
- [ ] Step 4: Generate report
```

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

See [REPORT-FORMAT.md](REPORT-FORMAT.md) for success/failure report templates.

## Review Checklist

### Critical Security

1. **No Hardcoded Credentials**: All keys from environment variables, validated on startup
2. **Input Validation**: All inputs validated with Zod, no `any` types at API boundaries
3. **Error Message Safety**: No API keys or database IDs in error messages
4. **Rate Limiting**: Rate limiter implemented with appropriate limits and backoff

### High Priority

5. **Timeout Configuration**: Timeouts set (30s typical), retry logic present
6. **Error Handling**: Try-catch blocks, specific error types handled, fallback strategies
7. **Type Safety**: No `any` types, Zod schemas for inputs, type guards for responses

### Medium Priority

8. **Cost Monitoring**: Token usage tracked, logging for cost analysis
9. **Query Optimization**: Pagination, reasonable filter complexity
10. **Testing Coverage**: Unit tests for API clients, mocked external APIs, error scenarios tested

## Emergency Response

If secrets are found hardcoded:
1. **Rotate** compromised credentials immediately
2. **Remove** from repository history
3. **Update** all affected systems

## Related

- API Security Rules: `.claude/rules/api-security.md`
- OpenAI Patterns: `.claude/skills/openai-patterns/SKILL.md`
- Notion Integration: `.claude/skills/notion-integration/SKILL.md`
