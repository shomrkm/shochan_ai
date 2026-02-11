---
name: building-monorepo
description: Builds all packages in the pnpm workspace monorepo respecting dependency order and verifies successful compilation. Use when the user asks to build the project, verify compilation, or check build artifacts.
---

# Building Monorepo

## Workflow

Copy this checklist and track progress:

```
Build Progress:
- [ ] Step 1: Clean previous build
- [ ] Step 2: Build all packages
- [ ] Step 3: Verify TypeScript compilation
- [ ] Step 4: Check build artifacts
```

### Step 1: Clean Previous Build

```bash
pnpm clean
```

### Step 2: Build All Packages

```bash
pnpm build
```

Build order (automatic via pnpm):
1. `core` (no dependencies)
2. `client` (depends on core)
3. `cli`, `web` (depend on core + client)
4. `web-ui` (independent)

### Step 3: Verify TypeScript Compilation

```bash
pnpm dlx tsc --noEmit
```

### Step 4: Check Build Artifacts

```bash
ls packages/core/dist
ls packages/client/dist
ls packages/cli/dist
ls packages/web/dist
ls packages/web-ui/.next
```

## Common Build Errors

**"Cannot find module '@shochan_ai/core'"**: Check `package.json` dependencies, run `pnpm install`, then rebuild.

**Circular dependency**: Review imports and ensure dependency graph is maintained:
```
core → client → {cli, web}  (web-ui is independent)
```

## Post-Build Actions

After successful build, consider running:
```bash
pnpm test       # Run all tests
pnpm check      # Format and lint check
```

## Related

- Monorepo Standards: `.claude/rules/monorepo-standards.md`
- Monorepo Workflow Skill: `.claude/skills/monorepo-workflow/SKILL.md`
