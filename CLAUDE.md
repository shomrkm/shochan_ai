# Claude Development Guidelines

## Task Execution Process

### Step-by-Step Implementation Protocol

1. **Task Planning & Todo Management**
   - Use TodoWrite tool to track current task progress
   - Break down complex tasks into smaller, manageable steps
   - Mark tasks as `in_progress` before starting work
   - Mark tasks as `completed` immediately after finishing

2. **Implementation Phase**
   - Implement one specific task/subtask at a time
   - Follow the Implementation Plan step-by-step approach
   - Maintain backward compatibility during all changes
   - Add comprehensive comments and documentation

3. **Validation Phase (MANDATORY after each task)**
   - **Type Check**: Run `npx tsc --noEmit` to ensure no TypeScript errors
   - **Unit Tests**: Run `npm test` to ensure all tests pass
   - **Code Quality**: Verify implementation follows existing patterns

4. **Documentation Phase**
   - Update `IMPLEMENTATION_PLAN_XML_CONTEXT.md` with completed tasks
   - Mark completed items with ✅ checkboxes
   - Update status indicators (🔄 IN PROGRESS, ✅ COMPLETED)
   - Add any implementation notes or deviations from plan

5. **Commit Confirmation Protocol**
   - Present completed work summary to user
   - Request explicit approval: "Task X.Y が完了しました。レビューをお願いします"
   - Wait for user confirmation before proceeding with git commit
   - Only commit after receiving "OK" or similar approval

### Code Quality Standards

- **TypeScript Strict Mode**: All code must pass strict type checking
- **Test Coverage**: Maintain existing test coverage, add tests for new functionality
- **Backward Compatibility**: Existing APIs must continue working unchanged
- **Documentation**: JSDoc comments for all public methods and classes
- **YAGNI Principle**: Follow "You Aren't Gonna Need It" - implement only what is currently needed
  - Do not add speculative features or functionality "just in case"
  - Remove unused code, methods, and imports immediately
  - Prefer simple, focused implementations over generic, flexible ones
  - Add complexity only when there is a concrete, immediate requirement

### TypeScript Coding Standards

- **Avoid Type Assertions**: Never use `as any` or type assertions unless absolutely necessary
  - Prefer proper type definitions and type guards over assertions
  - If type assertion is unavoidable, document the reason with detailed comments
- **Strict Type Definitions**: Define precise, narrow types instead of broad ones
  - Use specific literal types: `'create_task' | 'create_project'` instead of `string`
  - Define exact object shapes with required and optional properties
  - Avoid `any` type completely - use `unknown` if type is truly unknown
- **Union Types & Type Safety**: Leverage TypeScript's type system fully
  - Use discriminated unions for polymorphic data structures
  - Implement proper type guards for runtime type checking
  - Use mapped types and conditional types for complex type relationships
- **Generic Type Parameters**: Use generics for reusable, type-safe code
  - Constrain generic parameters with proper bounds (`K extends EventType`)
  - Provide default type parameters when appropriate
- **Type Inference**: Let TypeScript infer types when possible, but be explicit when clarity is needed

### Git Commit Guidelines

- Use conventional commit format: `feat:`, `fix:`, `refactor:`, etc.
- Include phase information in commit messages (e.g., "Phase 2.1")
- Add detailed description of changes in commit body
- Include Claude Code attribution footer

### Error Handling

- If type errors occur: Fix immediately before proceeding
- If tests fail: Investigate and resolve before continuing
- If user requests changes: Implement changes before committing
- Always verify implementation works as expected

### Communication Protocol

- Provide concise progress updates
- Ask for confirmation before major changes
- Report any deviations from the implementation plan
- Request guidance when encountering unexpected issues

## Implementation Plan Reference

All tasks should follow the structure defined in `IMPLEMENTATION_PLAN_XML_CONTEXT.md`:
- Phase 1: Foundation ✅ COMPLETED
- Phase 2: Unified Context Manager Enhancement 🔄 IN PROGRESS  
- Phase 3: TaskCreatorAgent Integration (Planned)
- Phase 4: Testing & Optimization (Planned)
- Phase 5: Production Migration & Cleanup (Planned)

## Current Development Focus

Following 12-factor agents principles for XML-based context management implementation. Maintain dual-mode capability (legacy + XML) throughout the transition period.