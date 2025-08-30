# 🤖 Shochan AI Agent

A TypeScript-based AI agent implementation following the [12-factor agents](https://github.com/humanlayer/12-factor-agents) principles for building reliable, production-ready AI-powered software.

## 🎯 Project Overview

This is a **personal learning project** designed to systematically study and implement the [12-factor agents](https://github.com/humanlayer/12-factor-agents) principles. The project creates an AI agent that converts natural language requests into structured tool calls for task and project management using Notion as the backend.

**Learning Goals:**
- Understand and apply 12-factor agents principles in practice
- Build production-ready AI agent architecture
- Explore advanced prompt engineering techniques
- Develop type-safe, maintainable AI systems

## ✅ Implemented Factors

### Factor 1: Natural Language to Tool Calls
- Converts user natural language input into structured tool calls
- Supports task creation, project creation, and interactive questioning
- Integration with Anthropic Claude API for intelligent processing

### Factor 2: Own Your Prompts
- Unified system prompt management with context-aware generation
- Single comprehensive prompt that adapts based on conversation history
- Simplified prompt architecture using conversation context directly

### Factor 3: Own Your Context Window
- XML-based context management with event-driven Thread model
- YAML-in-XML serialization for structured conversation context
- Complete tool execution tracking and conversation state visibility
- Enhanced debugging capabilities with full event audit trail

### Factor 4: Tools are Just Structured Outputs
- Enhanced tool execution with comprehensive validation and XML event recording
- Rich structured outputs with execution metadata and event tracking
- Tool-specific timeout configuration (ask_question: 10min, API calls: 30s)
- Distributed tracing and performance monitoring with XML context
- Type-safe input/output validation without `as` casting
- Complete event audit trail for all tool executions

## 🏗️ Architecture

### Core Components

- **`TaskCreatorAgent`**: Main orchestrator agent implementing 12-factor pattern with `determineNextStep()` and `executeTool()`
- **`ContextManager`**: XML-based context management with event-driven Thread model
- **`DisplayManager`**: Centralized display and logging functionality
- **`EnhancedToolExecutor`**: Structured tool execution with validation and XML event recording
- **`ClaudeClient`**: Anthropic Claude API integration
- **`NotionClient`**: Notion API integration for GTD system
- **`InputHelper`**: Unified input handling to prevent character duplication

### Available Tools

1. **`create_task`**: Creates tasks in Notion GTD system with title, description, task_type, etc.
2. **`user_input`**: Unified tool for requesting user input when more information is needed
3. **`create_project`**: Creates projects with name, description, and importance levels

## 🚀 Getting Started

### Interactive Mode (Recommended)

Start an interactive session where you can continuously create tasks and projects:

```bash
npm run interactive
```

This mode allows you to:
- 🔄 **Continuous conversation** - Create multiple tasks/projects in one session  
- ✅ **Natural language input** - Just describe what you want to create
- 🛑 **Graceful exit** - Press `Ctrl+C` anytime to exit
- 💬 **Follow-up actions** - Keep creating after each successful task/project

Example session:
```
🎯 Your request: Create a task to review quarterly reports
✅ Task created successfully!
💬 You can continue to create more tasks/projects or press Ctrl+C to exit.

🎯 What would you like to do next? Create a project for mobile app redesign
✅ Project created successfully!
💬 You can continue to create more tasks/projects or press Ctrl+C to exit.
```

### Prerequisites

- Node.js 18+ and npm
- Anthropic API key
- Notion integration with databases for tasks and projects

### Installation

```bash
# Clone the repository
git clone https://github.com/shomrkm/shochan_ai.git
cd shochan_ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Environment Variables

Create a `.env` file with the following variables:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
NOTION_API_KEY=your_notion_integration_token
NOTION_TASKS_DATABASE_ID=your_tasks_database_id
NOTION_PROJECTS_DATABASE_ID=your_projects_database_id
```

### Building and Running

```bash
# Build the project
npm run build

# Run different test scenarios
npm run test-dialogue      # Basic dialogue testing
npm run test-factor2       # Factor 2 implementation testing
npm run test-notion        # Notion connection testing

# Development mode
npm run dev

# Watch mode
npm run watch
```

## 🧪 Testing

The project includes several test scripts to demonstrate different capabilities:

- **`test-dialogue`**: Interactive conversation testing
- **`test-factor2`**: Dynamic prompt management demonstration
- **`test-notion`**: Notion API connection verification

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode testing
```

## 🎨 Code Quality

This project uses [Biome](https://biomejs.dev) for code formatting and linting:

```bash
# Format code
npm run format

# Check formatting
npm run format:check

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Run all checks and fixes
npm run check:fix
```

## 📁 Project Structure

```
src/
├── agents/
│   └── notion-task-agent.ts      # Main orchestrator with 12-factor done intent pattern
├── clients/
│   ├── claude.ts                 # Anthropic Claude API client
│   ├── notion.ts                 # Notion API client with get_tasks support
│   └── notion-task-parser.ts     # Notion task parsing utilities
├── conversation/
│   ├── context-manager.ts        # XML-based context management with Thread model
│   └── display-manager.ts        # Centralized display and logging functionality
├── events/                       # Factor 3: XML Context System
│   ├── types.ts                  # Event type definitions and data structures
│   ├── thread.ts                 # Event-driven conversation flow with XML serialization
│   ├── yaml-utils.ts             # YAML-in-XML formatting utilities
│   └── *.test.ts                 # Event system test suites
├── prompts/
│   └── system-prompt.ts          # 12-factor decision framework with done intent
├── tools/                        # Factor 1 & 4: Enhanced Tool System
│   ├── index.ts                  # Legacy tool execution engine
│   ├── enhanced-tool-executor.ts # XML event recording with validation
│   ├── tool-execution-context.ts # Execution context management
│   ├── tool-result-validator.ts  # Input/output validation
│   └── user-input-handler.ts     # User input handling
├── types/
│   ├── conversation-types.ts     # Conversation-related types
│   ├── notion.ts                 # Notion API types
│   ├── prompt-types.ts           # XML-aware prompt system types
│   ├── tools.ts                  # Tool system types (includes get_tasks and done tools)
│   └── toolGuards.ts            # Runtime type validation
├── utils/
│   ├── input-helper.ts           # Unified input handling
│   └── notionUtils.ts           # Notion utility functions
├── cli.ts                       # Production-ready CLI tool
└── index.ts                     # Development/demo entry point
```

## 🗺️ Development Roadmap

See [PLAN.md](./PLAN.md) for the comprehensive development plan covering all 12 factors.

### Next Priorities

1. **Factor 5**: Unify Execution State with Business State
2. **Factor 6**: Agent Interaction APIs
3. **Factor 7**: Agents are Async Everywhere
4. Enhanced monitoring and production optimization

## 🌟 Key Features

- **XML-Based Context Management**: Event-driven Thread model with YAML-in-XML serialization
- **Complete Event Tracking**: Full audit trail of all tool executions and conversation flows
- **Enhanced Debugging**: Structured XML context provides complete conversation state visibility
- **Type-Safe Architecture**: Full TypeScript implementation with strict typing and event type safety
- **Production-Ready**: Following 12-factor agents principles with modern architecture
- **Zero Legacy Dependencies**: Clean codebase with XML-only context management
- **Interactive Learning**: Demonstrates advanced 12-factor agents principles progressively

## 🔧 Configuration

The project uses several configuration files:

- **`biome.json`**: Code formatting and linting rules
- **`tsconfig.json`**: TypeScript compiler configuration
- **`package.json`**: Dependencies and scripts
- **`.env`**: Environment variables (create from .env.example)

## 📚 Learning Resources

- [12-factor agents](https://github.com/humanlayer/12-factor-agents) - Core principles
- [Anthropic Claude API](https://docs.anthropic.com/) - AI capabilities
- [Notion API](https://developers.notion.com/) - Database integration
- [Project Documentation](https://www.notion.so/shomrkm/Learning-AI-Agent-Development-24bd4af9764f800c9fe9ca2a490386d5) - Detailed progress notes


## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [humanlayer/12-factor-agents](https://github.com/humanlayer/12-factor-agents) for the foundational principles
- Anthropic for the Claude API
- Notion for the powerful API and database capabilities

---

**Note**: This is a **personal learning and educational project** demonstrating the step-by-step implementation of 12-factor agents principles. It serves as both a practical study guide and a reference implementation for anyone interested in building reliable AI agent systems. The project documents the learning journey through detailed progress notes and structured implementation phases.
