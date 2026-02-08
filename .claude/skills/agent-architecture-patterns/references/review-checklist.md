# Architecture Review Checklist

Use this checklist to review agent implementations against 12-factor principles.

## Factor 1: Natural Language to Tool Calls

**✓ Checklist:**
- [ ] LLM outputs are structured (using function/tool calling)
- [ ] No regex or text parsing of LLM outputs
- [ ] Tool calls are type-safe and validated
- [ ] Tool results are properly formatted

**Review Questions:**
- Are you parsing LLM text outputs with regex or string manipulation?
- Do tool calls use OpenAI's native function calling feature?
- Are tool parameters validated before execution?

**Red Flags:**
- `response.content.match(/ACTION: (\w+)/)` - Text parsing
- Manual JSON extraction from text responses
- Inconsistent tool call handling

## Factor 2: Own Your Prompts

**✓ Checklist:**
- [ ] Prompts are stored as code (not hidden in framework)
- [ ] System prompts are version controlled
- [ ] Prompts are easily auditable and modifiable
- [ ] No framework magic hiding prompt content

**Review Questions:**
- Can you see the exact prompt sent to the LLM?
- Are prompts stored in your codebase?
- Can you modify prompts without diving into framework code?

**Red Flags:**
- Prompts generated deep inside framework internals
- Unable to see actual prompt without debugging
- Prompt changes require framework updates

## Factor 3: Own Your Context Window

**✓ Checklist:**
- [ ] Context window size is actively managed
- [ ] Old messages are summarized or truncated
- [ ] Only relevant information included
- [ ] Token usage is monitored

**Review Questions:**
- Do you track context window token usage?
- Is there a strategy for managing long conversations?
- Are irrelevant messages filtered out?

**Red Flags:**
- Unlimited message history accumulation
- No token usage monitoring
- Including entire databases in context

## Factor 4: Tools Are Structured Outputs

**✓ Checklist:**
- [ ] Tool schemas are well-designed
- [ ] Parameter types are specific (not just `string`)
- [ ] Required fields are marked as required
- [ ] Descriptions are clear and actionable

**Review Questions:**
- Do tool schemas guide the LLM effectively?
- Are parameter constraints properly defined?
- Do schemas include helpful descriptions?

**Red Flags:**
- All parameters are type `string` or `any`
- Missing parameter descriptions
- Vague or unclear tool descriptions
- No required field specifications

## Factor 5: Unify Execution and Business State

**✓ Checklist:**
- [ ] Agent state and business state update together
- [ ] State updates are atomic (transactions)
- [ ] No state drift between systems
- [ ] Recovery possible from any state

**Review Questions:**
- Do agent and business state update in same transaction?
- Can you recover execution from any point?
- Is there a single source of truth for state?

**Red Flags:**
- Agent state in memory, business state in database
- State updates in separate operations
- Inconsistent state after failures

## Factor 6: Launch/Pause/Resume APIs

**✓ Checklist:**
- [ ] Explicit `launch()` API exists
- [ ] Execution can be paused mid-workflow
- [ ] Execution can be resumed from pause point
- [ ] State is preserved across pause/resume

**Review Questions:**
- Can you pause a running agent?
- Can you resume execution later?
- Is pause/resume explicit in your API?

**Red Flags:**
- No way to pause execution
- Must restart from beginning
- Lost state on interruption

## Factor 7: Contact Humans with Tool Calls

**✓ Checklist:**
- [ ] Human contact is a defined tool
- [ ] No special handling needed for human escalation
- [ ] Approval flows use same pattern as other tools
- [ ] Clear audit trail for human interactions

**Review Questions:**
- Is human contact just another tool call?
- Does human intervention require special code?
- Can you see all human interactions in execution log?

**Red Flags:**
- Special `if (needsHuman)` branches
- Human contact handled differently from tools
- No record of human interactions

## Factor 8: Own Your Control Flow

**✓ Checklist:**
- [ ] Critical paths use deterministic code
- [ ] LLM only decides when ambiguity exists
- [ ] Control flow is explicit and visible
- [ ] Known patterns don't require LLM calls

**Review Questions:**
- Are simple commands handled deterministically?
- Does every request go through the LLM?
- Can you trace control flow easily?

**Red Flags:**
- LLM called for `/help` command
- No deterministic routing
- LLM makes all decisions, even trivial ones

## Factor 9: Compact Errors into Context

**✓ Checklist:**
- [ ] Errors are summarized, not full stack traces
- [ ] Error messages are actionable
- [ ] Error context is concise
- [ ] Token budget for errors is limited

**Review Questions:**
- Are stack traces added to context?
- Do error messages help the LLM recover?
- Is error information concise?

**Red Flags:**
- Full stack traces in context (100+ lines)
- Generic "Error occurred" messages
- No actionable error information

## Factor 10: Small, Focused Agents

**✓ Checklist:**
- [ ] Each agent has a narrow scope
- [ ] Agents are domain-specific
- [ ] No "universal" agents
- [ ] Clear agent boundaries

**Review Questions:**
- Can you describe each agent's scope in one sentence?
- Does one agent handle multiple unrelated domains?
- Are agents specialized?

**Red Flags:**
- Single agent handles tasks, projects, calendar, email...
- Agent description is vague or overly broad
- Massive system prompts (>1000 words)

## Factor 11: Trigger from Anywhere

**✓ Checklist:**
- [ ] Core logic is channel-agnostic
- [ ] Multiple trigger mechanisms supported
- [ ] No tight coupling to specific interface
- [ ] Easy to add new trigger points

**Review Questions:**
- Is agent logic decoupled from trigger mechanism?
- Can you invoke the agent via API, webhook, cron?
- How hard is it to add a new trigger?

**Red Flags:**
- Agent logic tightly coupled to HTTP handlers
- Can only trigger from one place
- Adding triggers requires core changes

## Factor 12: Stateless Reducer Pattern

**✓ Checklist:**
- [ ] Agent is a pure function
- [ ] State is explicit input/output
- [ ] No hidden mutable state
- [ ] Easy to test and replay

**Review Questions:**
- Can you call agent with same state and get same result?
- Is all state explicit?
- Can you unit test the agent?

**Red Flags:**
- Global variables or singletons
- State hidden in closures
- Side effects without state updates
- Hard to test or replay

## Overall Architecture Review

### High-Level Questions

1. **Can you explain the agent's behavior?**
   - Is control flow clear and traceable?
   - Are prompts visible and understandable?

2. **Can you debug issues?**
   - Can you replay executions?
   - Are logs comprehensive?
   - Is state inspectable?

3. **Can you scale it?**
   - Is state managed properly?
   - Are there stateless components?
   - Can you run multiple instances?

4. **Can you test it?**
   - Are components isolated?
   - Can you mock dependencies?
   - Is behavior deterministic?

5. **Can you maintain it?**
   - Is code modular?
   - Are prompts version controlled?
   - Is documentation clear?

### Scoring

For each factor, rate as:
- ✅ **Pass**: Fully adheres to principle
- ⚠️ **Partial**: Some adherence, needs improvement
- ❌ **Fail**: Does not follow principle

**Target**: At least 10/12 Pass, 0 Fail for production readiness.

## Common Issues by Project Phase

### Early Development (MVP)
Common violations:
- Factor 3 (Context Window) - Accumulating too much
- Factor 8 (Control Flow) - Everything goes through LLM
- Factor 10 (Small Agents) - One agent does everything

**Fix Priority**: Start with Factors 1, 2, 4 (structured outputs and prompts)

### Pre-Production
Common violations:
- Factor 5 (State Management) - State drift issues
- Factor 6 (Launch/Pause/Resume) - No pause capability
- Factor 9 (Error Handling) - Verbose errors

**Fix Priority**: Focus on Factors 5, 6, 7 (execution management)

### Production
Common violations:
- Factor 11 (Trigger Anywhere) - Tightly coupled to one interface
- Factor 12 (Stateless) - Scaling issues due to state

**Fix Priority**: Refactor for Factors 11, 12 (deployment strategy)

## Remediation Guide

When violations are found:

1. **Document the violation**
   - Which factor?
   - Where in the code?
   - Impact on quality/cost/reliability?

2. **Prioritize fixes**
   - Critical (affects reliability): Factors 1, 5, 9
   - Important (affects quality): Factors 2, 3, 4, 8, 10
   - Beneficial (affects scalability): Factors 6, 7, 11, 12

3. **Plan refactoring**
   - Start with high-impact, low-effort changes
   - Use patterns from patterns.md
   - Test incrementally

4. **Validate improvements**
   - Re-run checklist
   - Measure improvements (cost, latency, quality)
   - Update documentation
