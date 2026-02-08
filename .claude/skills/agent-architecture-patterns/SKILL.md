---
name: agent-architecture-patterns
description: Production-grade agent architecture based on 12-factor agents principles. Use when designing new agents, refactoring existing agents, reviewing agent implementations, implementing specific patterns (context management, state management, tool definitions, human-in-the-loop), or applying best practices for LLM-powered applications. Triggers on agent design, architecture review, refactoring requests, or mentions of 12-factor agents.
---

# Agent Architecture Patterns

Production-grade patterns for building reliable, maintainable LLM-powered agents based on the 12-factor agents methodology.

## Overview

This skill provides architectural guidance for building production-ready agents that are:
- **Reliable**: Structured outputs, proper error handling, state management
- **Maintainable**: Clear prompts, explicit control flow, modular design
- **Scalable**: Stateless patterns, multi-channel triggers, focused agents

The 12-factor agents framework applies principles from the 12-factor app methodology specifically to agent architectures.

## When to Use This Skill

**Design Phase:**
- "Design an agent following 12-factor principles"
- "Help me architect a task management agent"
- "What's the best way to structure this agent?"

**Implementation:**
- "Implement context window management"
- "Add human-in-the-loop approval"
- "Create a stateless agent reducer"

**Review & Refactoring:**
- "Review this agent architecture against 12-factor principles"
- "Refactor this code to follow best practices"
- "Identify issues with this implementation"

## Core Concepts

### The 12 Factors

The framework organizes into four layers:

**LLM Interface Layer** (Factors 1-4):
1. Natural Language to Tool Calls - Structured outputs, not text parsing
2. Own Your Prompts - Direct control over prompts
3. Own Your Context Window - Deliberate context management
4. Tools Are Structured Outputs - Well-designed tool schemas

**Execution Management** (Factors 5-7):
5. Unify Execution and Business State - Atomic state updates
6. Launch/Pause/Resume APIs - Explicit lifecycle control
7. Contact Humans with Tool Calls - Human-in-the-loop as tools

**Architecture Patterns** (Factors 8-10):
8. Own Your Control Flow - Deterministic + LLM decisions
9. Compact Errors into Context - Efficient error encoding
10. Small, Focused Agents - Specialized over universal

**Deployment Strategy** (Factors 11-12):
11. Trigger from Anywhere - Channel-agnostic core
12. Stateless Reducer Pattern - Pure functions for agents

### Key Philosophy

> "The fastest way to get good AI software in the hands of customers is to take small, modular concepts from agent building and incorporate them into existing products."

Production agents are primarily **software with strategically placed LLM steps**, not pure "loop until goal" systems.

## Quick Decision Tree

**Starting a new agent?**
→ Read [principles.md](references/principles.md) for detailed factor explanations
→ Use [patterns.md](references/patterns.md) for implementation templates

**Reviewing existing code?**
→ Use [review-checklist.md](references/review-checklist.md) for systematic review
→ Check [antipatterns.md](references/antipatterns.md) for common mistakes

**Implementing specific feature?**
→ Find relevant pattern in [patterns.md](references/patterns.md)
→ Cross-reference with principle in [principles.md](references/principles.md)

**Fixing issues?**
→ Identify anti-pattern in [antipatterns.md](references/antipatterns.md)
→ Apply fix from the anti-pattern entry

## Common Workflows

### Workflow 1: Design New Agent

1. Read **principles.md** - Understand all 12 factors
2. Identify which factors are critical for your use case
3. Review **patterns.md** for relevant implementation patterns
4. Start with Factors 1, 2, 4 (structured outputs and prompts)
5. Add execution management (Factors 5-7) as needed
6. Validate with **review-checklist.md**

### Workflow 2: Refactor Existing Agent

1. Use **review-checklist.md** to identify violations
2. Check **antipatterns.md** for specific fixes
3. Prioritize:
   - Critical: Factors 1, 5, 9 (reliability)
   - Important: Factors 2, 3, 4, 8, 10 (quality)
   - Beneficial: Factors 6, 7, 11, 12 (scalability)
4. Apply patterns from **patterns.md**
5. Re-validate with checklist

### Workflow 3: Implement Specific Feature

**Context Window Management:**
- Read Factor 3 in **principles.md**
- Use "Context Window Management" pattern from **patterns.md**
- Avoid Anti-Pattern 3 (Context Bloat) in **antipatterns.md**

**Human-in-the-Loop:**
- Read Factor 7 in **principles.md**
- Use "Human-in-the-Loop Pattern" from **patterns.md**
- Avoid Anti-Pattern 7 (Special Human Handling)

**State Management:**
- Read Factor 5 in **principles.md**
- Use "Stateless Agent with State Management" pattern
- Avoid Anti-Pattern 5 (State Drift)

## Reference Files

### [principles.md](references/principles.md)
Complete explanation of all 12 factors with:
- Detailed principle descriptions
- Why each factor matters
- TypeScript implementation examples
- Key takeaways
- Relationships between factors

**Read this when:** Designing new agents or understanding the framework deeply.

### [patterns.md](references/patterns.md)
Proven implementation patterns including:
- The Agent Loop pattern
- Stateless Agent with State Management
- Tool Registry pattern
- Context Window Management
- Human-in-the-Loop pattern
- Error Recovery pattern
- Multi-Agent Orchestration
- Prompt Template Management

**Read this when:** Implementing specific features or looking for code examples.

### [review-checklist.md](references/review-checklist.md)
Systematic review checklist with:
- Checklist items for each factor
- Review questions
- Red flags to watch for
- Scoring system
- Remediation guide

**Read this when:** Reviewing existing implementations or validating new code.

### [antipatterns.md](references/antipatterns.md)
Common mistakes and fixes for:
- Text Parsing Hell
- Framework Lock-In
- Context Bloat
- Vague Tool Schemas
- State Drift
- No Pause Capability
- Special Human Handling
- LLM for Everything
- Verbose Error Context
- Universal Agent
- Interface Coupling
- Stateful Singleton

**Read this when:** Debugging issues or identifying improvement opportunities.

## This Project's Context

This project (shochan_ai) is a task management agent system. Key architectural considerations:

**Current State:**
- Monorepo with pnpm workspaces
- TypeScript strict mode
- OpenAI and Notion API integrations
- Multiple packages: core, client, cli, web, web-ui

**Apply These Factors:**
- **Factor 1**: Use OpenAI function calling for task operations
- **Factor 2**: Store prompts in `packages/core/src/prompts/`
- **Factor 3**: Manage context for task history
- **Factor 4**: Well-defined task tool schemas (already using Zod)
- **Factor 5**: Notion database as unified state store
- **Factor 10**: Separate TaskAgent and ProjectAgent

## Getting Started

1. **For new features**: Start by reading the relevant factor in principles.md
2. **For implementation**: Find the pattern in patterns.md
3. **For review**: Use review-checklist.md systematically
4. **For troubleshooting**: Check antipatterns.md for the issue

The 12 factors work together to create production-ready agent systems. You don't need to implement all 12 immediately - start with the LLM Interface Layer (1-4) and add execution management (5-7) as needs grow.
