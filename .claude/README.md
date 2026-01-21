# Claude Code Configuration

This directory contains Claude Code configurations customized for the shochan_ai project.

## Directory Structure

```
.claude/
├── README.md           # This file
├── settings.json       # Hooks configuration
├── agents/            # Specialized subagents
│   ├── monorepo-planner.md
│   ├── api-integration-reviewer.md
│   ├── react-component-architect.md
│   └── code-reviewer.md
├── rules/             # Always-enforced guidelines
│   ├── monorepo-standards.md
│   ├── typescript-strict.md
│   ├── biome-standards.md
│   ├── nextjs-patterns.md
│   ├── api-security.md
│   └── testing.md
├── commands/          # Executable commands
│   ├── monorepo-build.md
│   ├── package-test.md
│   └── api-review.md
└── skills/            # Workflow knowledge base
    ├── monorepo-workflow.md
    ├── notion-integration.md
    ├── openai-patterns.md
    └── nextjs-development.md
```

## Components Overview

### Rules (/.claude/rules/)

Always-enforced guidelines that Claude follows automatically:

- **monorepo-standards.md**: pnpm workspace best practices, dependency graph rules
- **typescript-strict.md**: TypeScript strict mode standards, Zod validation patterns
- **biome-standards.md**: Biome formatting and linting rules
- **nextjs-patterns.md**: Next.js 16 + React 19 development patterns
- **api-security.md**: OpenAI and Notion API security requirements
- **testing.md**: Vitest testing standards and patterns

### Agents (/.claude/agents/)

Specialized subagents for complex tasks:

- **monorepo-planner.md**: Plans features across multiple packages
- **api-integration-reviewer.md**: Reviews API integration security and reliability
- **react-component-architect.md**: Designs React/Next.js components
- **code-reviewer.md**: Comprehensive code review across all dimensions

**Usage**: Agents activate proactively based on task context or can be invoked explicitly.

### Commands (/.claude/commands/)

Executable workflows:

- **monorepo-build.md**: Build all packages in dependency order
- **package-test.md**: Run tests for specific or all packages
- **api-review.md**: Security audit of API integrations

**Usage**: Type command name or describe the task (e.g., "Build the monorepo")

### Skills (/.claude/skills/)

Knowledge base and workflow documentation:

- **monorepo-workflow.md**: Day-to-day monorepo development workflows
- **notion-integration.md**: Notion API patterns and best practices
- **openai-patterns.md**: OpenAI API integration patterns
- **nextjs-development.md**: Next.js development workflows

**Usage**: Referenced automatically when relevant to the task

### Hooks (/.claude/settings.json)

Automated checks and actions:

**PreToolUse Hooks** (before operations):
- Prevent unnecessary markdown file creation
- Run Biome checks before git operations
- Remind to build before running tests

**PostToolUse Hooks** (after operations):
- Auto-format TypeScript files after edit
- Run type check after TypeScript edits
- Warn about console.log statements
- Suggest tests after core package changes

**Stop Hooks** (end of session):
- Check git status
- Run final code quality check
- Warn about uncommitted changes

## Project-Specific Customizations

### Monorepo Architecture

This project uses pnpm workspace with strict dependency hierarchy:
```
core (zod only) → client → cli, web
                            ↓
                         web-ui (independent)
```

All configurations respect this architecture and enforce it through rules and agents.

### Technology Stack

- **Package Manager**: pnpm workspace
- **Language**: TypeScript (strict mode)
- **Code Quality**: Biome (linter + formatter)
- **Testing**: Vitest + Testing Library
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **APIs**: OpenAI + Notion
- **Architecture**: 12-factor agents pattern

### Security Focus

Special emphasis on API security:
- No hardcoded credentials
- Input validation with Zod
- Safe error handling
- Rate limiting
- Cost monitoring

## Usage Guide

### For Developers

The configurations are automatically active when using Claude Code in this project.

**Common Workflows**:

1. **Adding a New Feature**:
   - Claude will use monorepo-planner to create implementation plan
   - Follows dependency order (core → client → cli/web)
   - Runs tests and type checks after each step

2. **Modifying API Integrations**:
   - api-integration-reviewer automatically reviews changes
   - Ensures security standards are met
   - Validates error handling and rate limiting

3. **Creating React Components**:
   - react-component-architect provides design guidance
   - Suggests Server vs Client Component usage
   - Includes testing and Storybook story templates

4. **Before Committing**:
   - Hooks automatically run Biome checks
   - Type checking with TypeScript
   - Git status review

### Manual Commands

You can explicitly invoke commands:

```bash
# Build all packages
"Build the monorepo"

# Test specific package
"Test the core package"

# Review API security
"Review API integrations"

# Get monorepo advice
"How do I add a dependency to the core package?"
```

### Customizing Hooks

Edit `.claude/settings.json` to customize automated behaviors:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "name": "custom-hook",
        "pattern": "Bash.*custom-pattern",
        "action": "pause",
        "message": "Custom message"
      }
    ]
  }
}
```

## Best Practices

1. **Trust the Rules**: Configurations enforce project standards automatically
2. **Use Agents**: Let specialized agents handle complex planning and review
3. **Follow Workflows**: Skills documents provide tested workflows
4. **Respect Hooks**: Automated checks prevent common mistakes
5. **Update Configs**: Keep configurations in sync with project evolution

## Troubleshooting

### Hooks Not Working

- Check `.claude/settings.json` syntax (valid JSON)
- Verify hook patterns match tool usage
- Review Claude Code logs for hook errors

### Agent Not Activating

- Agents activate based on context
- Try explicit invocation: "Use the monorepo-planner agent"
- Check agent activation triggers in agent file

### Rules Not Applied

- Rules are always active but not always visible
- Review rule files for specific guidelines
- Claude follows rules implicitly in responses

## Maintenance

### When to Update

- **Project structure changes**: Update monorepo-standards.md
- **New dependencies**: Update relevant rules (e.g., api-security.md)
- **New workflows**: Add to skills/ directory
- **New automated checks**: Add hooks to settings.json
- **Better practices discovered**: Update corresponding agent or rule

### Version Control

- Commit all `.claude/` changes to git
- Document significant config changes in commit messages
- Review configurations during code reviews

## Resources

- **Claude Code Documentation**: https://github.com/anthropics/claude-code
- **Reference Configuration**: https://github.com/affaan-m/everything-claude-code
- **Project README**: /README.md
- **Development Guidelines**: /CLAUDE.md

## Support

For issues with configurations:
1. Check this README first
2. Review specific rule/agent/skill file
3. Consult project CLAUDE.md
4. Ask Claude Code for help: "Explain the monorepo configuration"
