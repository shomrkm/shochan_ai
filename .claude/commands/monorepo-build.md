# /monorepo-build Command

**Purpose**: Build all packages in the monorepo respecting dependency order and verify successful compilation.

## Command Invocation

User types: `/monorepo-build` or "Build the monorepo"

## Execution Steps

### 1. Clean Previous Build
```bash
pnpm clean
```

Expected: Removes all `dist/` directories from packages

### 2. Build All Packages
```bash
pnpm build
```

Expected output:
```
@shochan_ai/core: build
@shochan_ai/client: build
@shochan_ai/cli: build
@shochan_ai/web: build
@shochan_ai/web-ui: build
```

Build order (automatic via pnpm):
1. core (no dependencies)
2. client (depends on core)
3. cli, web (depend on core + client)
4. web-ui (independent)

### 3. Verify TypeScript Compilation
```bash
npx tsc --noEmit
```

Expected: No type errors

### 4. Check Build Artifacts

```bash
# Check each package has dist/ directory
ls -la packages/core/dist
ls -la packages/client/dist
ls -la packages/cli/dist
ls -la packages/web/dist
ls -la packages/web-ui/.next
```

### 5. Report Results

**Success Output**:
```markdown
✅ Monorepo Build Successful

**Packages Built**:
- ✅ @shochan_ai/core
- ✅ @shochan_ai/client
- ✅ @shochan_ai/cli
- ✅ @shochan_ai/web
- ✅ @shochan_ai/web-ui

**TypeScript**: No errors
**Build Time**: [duration]
```

**Failure Output**:
```markdown
❌ Monorepo Build Failed

**Failed Package**: @shochan_ai/[package-name]

**Error**:
[error message]

**Recommendation**:
[specific fix based on error]
```

## Common Build Errors and Fixes

### Error: Type errors in compilation
```
packages/core/src/types/tools.ts:42:5 - error TS2322
```

**Fix**:
1. Review the type error
2. Fix the type definition
3. Run `npx tsc --noEmit` to verify
4. Rebuild

### Error: Dependency not found
```
Cannot find module '@shochan_ai/core'
```

**Fix**:
1. Check package.json dependencies
2. Ensure workspace alias is correct
3. Run `pnpm install`
4. Rebuild

### Error: Circular dependency
```
Circular dependency detected: core → client → core
```

**Fix**:
1. Review import statements
2. Refactor to break the cycle
3. Ensure dependency graph is maintained

## Post-Build Actions

After successful build:

1. **Run Tests**:
   ```bash
   pnpm test
   ```

2. **Check Code Quality**:
   ```bash
   pnpm check
   ```

3. **Verify Package Sizes** (optional):
   ```bash
   du -sh packages/*/dist
   ```

## Usage Examples

### Example 1: Pre-Commit Build
```
User: "Build everything before I commit"
Assistant: [Runs /monorepo-build command]
```

### Example 2: After Dependency Changes
```
User: "I updated the dependencies, rebuild the project"
Assistant: [Runs pnpm install, then /monorepo-build]
```

### Example 3: Troubleshooting
```
User: "The build is failing, help me fix it"
Assistant: [Runs /monorepo-build, analyzes errors, provides fixes]
```

## Integration with Other Commands

- Before `/package-test`: Ensure packages are built
- After code changes: Verify build still works
- Before git commit: Validate build succeeds

## Performance Tips

- **Incremental Builds**: pnpm automatically handles incremental builds
- **Parallel Builds**: Packages build in parallel when possible
- **Cache**: Build artifacts are cached for unchanged packages

## Related Documentation

- Monorepo Standards: `/.claude/rules/monorepo-standards.md`
- Package Structure: `/README.md`
- pnpm Workspace: `https://pnpm.io/workspaces`
