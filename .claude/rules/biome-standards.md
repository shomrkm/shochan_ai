# Biome Code Standards

> **Context**: This project uses Biome for linting and formatting instead of ESLint + Prettier.

## Biome Configuration

The project uses the following Biome settings (from `biome.json`):

### Formatter Rules
- **Indent**: 2 spaces (not tabs)
- **Line Width**: 100 characters maximum
- **Line Ending**: LF (Unix-style)
- **Quote Style**: Single quotes (`'`)
- **Semicolons**: Always required
- **Trailing Commas**: ES5 style (objects, arrays)
- **Arrow Parentheses**: Always include `(arg) =>`

### Linter Rules
- **Recommended Rules**: Enabled
- **useConst**: Error (use `const` when variable is never reassigned)
- **noExtraBooleanCast**: Error (remove redundant boolean casts)
- **noDebugger**: Error (no debugger statements)
- **noConsole**: Off (console.log allowed during development)

## Code Style Examples

### Formatting

**✅ CORRECT:**
```typescript
// Single quotes, semicolons, 2-space indent
const message = 'Hello, World';
const numbers = [1, 2, 3];

// Arrow functions always use parentheses
const increment = (x) => x + 1;
const greet = (name) => `Hello, ${name}`;

// Trailing commas in ES5 contexts
const config = {
  apiKey: 'xyz',
  timeout: 5000,
};
```

**❌ WRONG:**
```typescript
// Double quotes (wrong)
const message = "Hello, World"

// No parentheses on arrow function (wrong)
const increment = x => x + 1

// No trailing comma (wrong)
const config = {
  apiKey: 'xyz',
  timeout: 5000
}
```

### Const Usage

**✅ CORRECT:**
```typescript
// Use const for values that won't be reassigned
const API_URL = 'https://api.example.com';
const tasks = await getTasks();

// Use let only when reassignment is needed
let counter = 0;
counter += 1;
```

**❌ WRONG:**
```typescript
// Using let when const should be used (Biome error)
let API_URL = 'https://api.example.com';
let tasks = await getTasks();
```

### Boolean Casts

**✅ CORRECT:**
```typescript
// Direct boolean context
if (value) { }
if (!value) { }

// Explicit comparison when needed
if (value === true) { }
```

**❌ WRONG:**
```typescript
// Redundant boolean cast (Biome error)
if (!!value) { }
if (Boolean(value)) { }
```

### No Debugger Statements

**❌ NEVER commit debugger statements:**
```typescript
function processData(data) {
  debugger; // ❌ Biome error: noDebugger
  return data.map(transform);
}
```

**✅ Use console.log for debugging (allowed):**
```typescript
function processData(data) {
  console.log('Processing:', data); // ✅ Allowed
  return data.map(transform);
}
```

## Commands

### Format Code
```bash
# Format all files
pnpm format

# Check formatting without modifying
pnpm format:check
```

### Lint Code
```bash
# Lint all files
pnpm lint

# Auto-fix linting issues
pnpm lint:fix
```

### Combined Check
```bash
# Run both format and lint checks
pnpm check

# Auto-fix both formatting and linting
pnpm check:fix
```

## Pre-Commit Workflow

**ALWAYS run before committing:**
```bash
# 1. Auto-fix all issues
pnpm check:fix

# 2. Verify no remaining issues
pnpm check

# 3. Type check
npx tsc --noEmit

# 4. Run tests
pnpm test
```

## Integration with Git Hooks

The project has a Stop hook that runs git status check. Consider adding a Pre-commit hook for automatic formatting:

```bash
# .git/hooks/pre-commit
#!/bin/sh
pnpm check:fix
git add -u
```

## File Coverage

Biome processes these file patterns:
- `src/**/*` (all source files in any package)
- `*.ts`, `*.tsx` (TypeScript files)
- `*.js`, `*.jsx` (JavaScript files)
- `*.json` (JSON files)

## Common Issues and Fixes

### Issue: Mixed Quotes
```typescript
// ❌ Wrong
const msg1 = "Hello";
const msg2 = 'World';

// ✅ Fix with pnpm format
const msg1 = 'Hello';
const msg2 = 'World';
```

### Issue: Inconsistent Indentation
```typescript
// ❌ Wrong (4 spaces or tabs)
function example() {
    return true;
}

// ✅ Fix with pnpm format (2 spaces)
function example() {
  return true;
}
```

### Issue: Line Too Long
```typescript
// ❌ Wrong (> 100 characters)
const longMessage = 'This is a very long message that exceeds the line width limit of 100 characters and should be broken';

// ✅ Fix: Break into multiple lines
const longMessage =
  'This is a very long message that exceeds the line width limit of ' +
  '100 characters and should be broken';
```

## VS Code Integration

Install the Biome extension for automatic formatting on save:
```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

## Monorepo Considerations

- Biome configuration at root applies to all packages
- Each package inherits the same formatting and linting rules
- No need for package-specific Biome configs
- Consistent code style across the entire monorepo

## Why Biome Over ESLint + Prettier?

This project chose Biome because:
1. **Performance**: 25x faster than ESLint + Prettier
2. **Simplicity**: Single tool for both linting and formatting
3. **Zero Config**: Works out of the box with sensible defaults
4. **Monorepo Support**: Excellent performance with multiple packages

## Resources

- Biome Documentation: https://biomejs.dev/
- Project Configuration: `/biome.json`
- VS Code Extension: https://marketplace.visualstudio.com/items?itemName=biomejs.biome
