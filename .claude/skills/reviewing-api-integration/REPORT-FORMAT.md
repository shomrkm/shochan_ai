# Report Format

## Success Report

```markdown
# API Integration Review - PASSED

**Date**: [timestamp]
**Files Reviewed**:
- [list of reviewed files]

## Security
- No hardcoded credentials
- Input validation with Zod
- Safe error messages
- Rate limiting implemented

## Reliability
- Timeouts configured
- Retry logic present
- Comprehensive error handling

## Recommendations
- [Any improvement suggestions]

## Approval
APPROVED - Ready for production
```

## Failure Report

```markdown
# API Integration Review - FAILED

**Date**: [timestamp]
**Files Reviewed**:
- [list of reviewed files]

## Critical Issues

### Issue N: [Title]
**File**: `[file:line]`
**Severity**: CRITICAL | HIGH | MEDIUM

**Problem**:
[Description with code snippet]

**Fix**:
[Recommended fix with code snippet]

## Approval
BLOCKED - Fix critical issues before proceeding

## Next Steps
1. [Ordered list of fixes]
2. Re-run review to verify fixes
```
