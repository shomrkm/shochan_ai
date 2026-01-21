# Monorepo Workflow

**Context**: Best practices for working with pnpm workspace monorepo in shochan_ai project.

## Project Structure

```
shochan_ai/
├── packages/
│   ├── core/              # Business logic (zod only)
│   ├── client/            # API clients (depends on core)
│   ├── cli/               # CLI interface (depends on core + client)
│   ├── web/               # Web API server (depends on core + client)
│   └── web-ui/            # Next.js UI (independent)
├── pnpm-workspace.yaml    # Workspace configuration
├── package.json           # Root package.json
└── tsconfig.base.json     # Shared TypeScript config
```

## Dependency Graph (CRITICAL)

```
core (zod only)
  ↓
client
  ↓
cli, web
  ↓
(web-ui is independent)
```

**Rules**:
- Core depends only on zod
- Client depends on core
- CLI and web depend on core + client
- Web-ui is independent (Next.js app)
- **NEVER violate this hierarchy**

## Common Workflows

### 1. Adding New Feature

#### Step 1: Plan the Change
```bash
# Identify affected packages
# Example: Adding new tool to agent
# Affected: core, client, cli, web
```

#### Step 2: Update Core (Types & Logic)
```bash
# 1. Define types
# Edit: packages/core/src/types/tools.ts

# 2. Add business logic
# Edit: packages/core/src/agent/executors/

# 3. Export from index
# Edit: packages/core/src/index.ts

# 4. Build core
pnpm --filter @shochan_ai/core build

# 5. Test core
pnpm --filter @shochan_ai/core test
```

#### Step 3: Update Client (if needed)
```bash
# 1. Add API client method
# Edit: packages/client/src/notion.ts or openai.ts

# 2. Build client
pnpm --filter @shochan_ai/client build

# 3. Test client
pnpm --filter @shochan_ai/client test
```

#### Step 4: Update CLI/Web
```bash
# 1. Update CLI implementation
# Edit: packages/cli/src/

# 2. Build CLI
pnpm --filter @shochan_ai/cli build

# 3. Test CLI
pnpm --filter @shochan_ai/cli test
```

#### Step 5: Verify All Packages
```bash
# Build all
pnpm build

# Test all
pnpm test

# Type check
npx tsc --noEmit

# Code quality
pnpm check
```

### 2. Refactoring Across Packages

#### Step 1: Identify Dependencies
```bash
# Search for usage
pnpm --filter @shochan_ai/core grep "functionName"

# Check all imports
grep -r "from '@shochan_ai/core'" packages/
```

#### Step 2: Update in Dependency Order
1. Update core first
2. Then client
3. Finally cli/web
4. Test after each step

#### Step 3: Maintain Backward Compatibility
```typescript
// Option 1: Deprecate old API
/** @deprecated Use newFunction instead */
export function oldFunction() {
  return newFunction();
}

// Option 2: Support both temporarily
export function processTask(task: Task | LegacyTask) {
  const normalized = isLegacyTask(task) ? convertTask(task) : task;
  return process(normalized);
}
```

### 3. Adding New Package

```bash
# 1. Create package directory
mkdir -p packages/new-package/src

# 2. Create package.json
cat > packages/new-package/package.json << EOF
{
  "name": "@shochan_ai/new-package",
  "version": "0.0.1",
  "dependencies": {
    "@shochan_ai/core": "workspace:*"
  }
}
EOF

# 3. Create tsconfig.json
cat > packages/new-package/tsconfig.json << EOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
EOF

# 4. Install dependencies
pnpm install

# 5. Build new package
pnpm --filter @shochan_ai/new-package build
```

### 4. Updating Dependencies

#### Root Dependencies (DevDependencies)
```bash
# Add to workspace root
pnpm add -D typescript -w

# Update
pnpm update typescript -w
```

#### Package-Specific Dependencies
```bash
# Add to specific package
pnpm add axios --filter @shochan_ai/client

# Add workspace dependency
# Edit package.json:
{
  "dependencies": {
    "@shochan_ai/core": "workspace:*"
  }
}
```

#### Update All Dependencies
```bash
# Check outdated
pnpm outdated

# Update all (careful!)
pnpm update -r

# Update specific package
pnpm update zod --filter @shochan_ai/core
```

### 5. Running Commands

#### Run in All Packages
```bash
pnpm -r build    # Build all
pnpm -r test     # Test all
pnpm -r clean    # Clean all
```

#### Run in Specific Package
```bash
pnpm --filter @shochan_ai/core build
pnpm --filter @shochan_ai/web-ui dev
pnpm --filter @shochan_ai/cli start
```

#### Run in Multiple Packages
```bash
# Build core and client
pnpm --filter @shochan_ai/core --filter @shochan_ai/client build

# Test all except web-ui
pnpm --filter '!@shochan_ai/web-ui' test
```

### 6. Development Workflow

#### Starting Development
```bash
# 1. Pull latest changes
git pull

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Run tests
pnpm test

# 5. Start development
pnpm dev  # Runs CLI in dev mode
# OR
pnpm --filter @shochan_ai/web-ui dev  # Next.js dev server
```

#### Making Changes
```bash
# 1. Create feature branch
git checkout -b feature/new-tool

# 2. Make changes in appropriate package(s)

# 3. Build affected packages
pnpm --filter @shochan_ai/core build

# 4. Test changes
pnpm --filter @shochan_ai/core test

# 5. Type check
npx tsc --noEmit

# 6. Format and lint
pnpm check:fix
```

#### Before Committing
```bash
# 1. Build all
pnpm build

# 2. Test all
pnpm test

# 3. Type check
npx tsc --noEmit

# 4. Code quality
pnpm check

# 5. Review changes
git diff

# 6. Commit
git commit -m "feat: add new tool"
```

### 7. Troubleshooting

#### Build Errors

**Issue**: "Cannot find module '@shochan_ai/core'"
```bash
# Solution: Rebuild core first
pnpm --filter @shochan_ai/core build
```

**Issue**: "Type errors in compilation"
```bash
# Solution: Check TypeScript
npx tsc --noEmit
# Fix type errors, then rebuild
```

**Issue**: "Circular dependency detected"
```bash
# Solution: Review imports, break the cycle
# Ensure dependency graph is maintained
```

#### Test Failures

**Issue**: "Module not found in tests"
```bash
# Solution: Build package first
pnpm build
pnpm test
```

**Issue**: "Mock not working"
```bash
# Solution: Check mock configuration in test
vi.mock('module-name', () => ({ ... }))
```

#### Dependency Issues

**Issue**: "Dependency version mismatch"
```bash
# Solution: Check pnpm-lock.yaml
pnpm install

# If still broken, recreate lock file
rm pnpm-lock.yaml
pnpm install
```

## Best Practices

### 1. Always Build in Order
```bash
# ❌ WRONG
pnpm --filter @shochan_ai/cli build  # Without building core first

# ✅ CORRECT
pnpm build  # Builds in dependency order
```

### 2. Use Workspace Aliases
```typescript
// ✅ CORRECT
import { AgentOrchestrator } from '@shochan_ai/core';

// ❌ WRONG
import { AgentOrchestrator } from '../../core/src/agent/orchestrator';
```

### 3. Test After Every Change
```bash
# After modifying core
pnpm --filter @shochan_ai/core build && pnpm --filter @shochan_ai/core test
```

### 4. Maintain Dependency Graph
```bash
# Before adding dependency, ask:
# - Does this violate the dependency hierarchy?
# - Is core importing from client? (NO!)
# - Is this the right package for this dependency?
```

### 5. Document Breaking Changes
```typescript
/**
 * @breaking-change v0.2.0
 * Renamed from `getTask` to `getTasks`
 * Now returns array instead of single task
 */
export function getTasks(): Task[] { }
```

## Performance Tips

### 1. Incremental Builds
pnpm automatically handles incremental builds. Only changed packages rebuild.

### 2. Parallel Execution
Commands run in parallel when possible:
```bash
# Builds core, then client+cli+web in parallel
pnpm build
```

### 3. Filtering
Target specific packages to speed up development:
```bash
# Only build what you need
pnpm --filter @shochan_ai/core... build
```

### 4. Caching
pnpm caches build artifacts. Clean cache if needed:
```bash
pnpm store prune
```

## Related Documentation

- Monorepo Standards: `/.claude/rules/monorepo-standards.md`
- pnpm Workspace: `https://pnpm.io/workspaces`
- Project Structure: `/README.md`
