# Monorepo Standards

> **Context**: This project uses pnpm workspace monorepo structure with strict dependency management.

## Package Dependency Rules

### Dependency Graph (CRITICAL)
```
core (zod only) ← client ← {cli, web}
                          ↓
                        web-ui (independent Next.js app)
```

**NEVER violate this dependency hierarchy:**
- `packages/core` depends on **zod only** (for runtime validation)
- `packages/client` depends on `@shochan_ai/core`
- `packages/cli` depends on `@shochan_ai/core` and `@shochan_ai/client`
- `packages/web` depends on `@shochan_ai/core` and `@shochan_ai/client`
- `packages/web-ui` is independent Next.js application

### Workspace Commands

**Build:**
```bash
# Build all packages (respects dependency order)
pnpm build

# Build specific package
pnpm --filter @shochan_ai/core build
```

**Development:**
```bash
# Run CLI in dev mode
pnpm dev

# Run specific package
pnpm --filter @shochan_ai/web-ui dev
```

**Testing:**
```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @shochan_ai/core test
```

**Code Quality:**
```bash
# Format and lint entire monorepo
pnpm check:fix

# Check without fixing
pnpm check
```

## File Organization

### Package Structure
Each package follows this structure:
```
packages/{name}/
├── src/
│   ├── index.ts        # Main entry point
│   └── ...
├── package.json
└── tsconfig.json       # Extends tsconfig.base.json
```

### Cross-Package Imports
```typescript
// ✅ CORRECT: Use workspace alias
import { AgentOrchestrator } from '@shochan_ai/core';

// ❌ WRONG: Relative paths across packages
import { AgentOrchestrator } from '../../core/src/agent';
```

## Build & Dependency Management

### Adding Dependencies

**Workspace Root:**
```bash
pnpm add -D {package} -w
```

**Specific Package:**
```bash
pnpm add {package} --filter @shochan_ai/{package-name}
```

**Cross-Package Dependency:**
```json
// In package.json
{
  "dependencies": {
    "@shochan_ai/core": "workspace:*"
  }
}
```

### Build Order (CRITICAL)

Always build in dependency order:
1. `packages/core` (no dependencies)
2. `packages/client` (depends on core)
3. `packages/cli` and `packages/web` (depend on core + client)
4. `packages/web-ui` (independent)

**pnpm automatically handles this with `pnpm build`**

## Type Safety Across Packages

### Shared Types
- Define types in `packages/core/src/types/`
- Export from `packages/core/src/index.ts`
- Import using workspace alias

```typescript
// packages/core/src/types/index.ts
export type { TaskType, ProjectType } from './domain';

// packages/client/src/notion.ts
import type { TaskType } from '@shochan_ai/core';
```

### tsconfig Inheritance
All packages extend from `tsconfig.base.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## Common Pitfalls

### ❌ Circular Dependencies
```typescript
// NEVER create circular dependencies between packages
// core → client → core (WRONG!)
```

### ❌ Direct Node Modules Access
```typescript
// WRONG: Don't import from other package's node_modules
import something from '../../client/node_modules/xyz';

// CORRECT: Add dependency to your package.json
```

### ❌ Skipping Build Steps
```bash
# WRONG: Testing without building
pnpm test

# CORRECT: Build first, then test
pnpm build && pnpm test
```

## Verification Checklist

Before committing changes affecting multiple packages:

- [ ] Run `pnpm build` at root (no errors)
- [ ] Run `pnpm test` at root (all tests pass)
- [ ] Run `pnpm check` (no linting/formatting errors)
- [ ] Verify no circular dependencies created
- [ ] Confirm dependency graph remains valid
- [ ] Check TypeScript compilation (`npx tsc --noEmit`)

## References

- [pnpm Workspace Documentation](https://pnpm.io/workspaces)
- Project README: `/README.md`
- Core Package: `/packages/core/README.md`
- Web API Package: `/packages/web/README.md`
