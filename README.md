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
- Dynamic prompt management system with conversation stage awareness
- Structured prompt functions for different conversation phases:
  - `initial`: Handling ambiguous user requests
  - `gathering_info`: Efficient information collection
  - `confirming`: Pre-creation confirmation
  - `executing`: Actual task/project creation

### Factor 3: Own Your Context Window
- Efficient conversation history management with 30-60% token savings
- Priority-based message retention and automatic summarization
- Real-time context statistics and optimization
- Strategic context window adjustment

### Factor 4: Tools are Just Structured Outputs
- Enhanced tool execution with comprehensive validation
- Rich structured outputs with execution metadata
- Tool-specific timeout configuration (ask_question: 10min, API calls: 30s)
- Distributed tracing and performance monitoring
- Type-safe input/output validation without `as` casting

## 🏗️ Architecture

### Core Components

- **`TaskCreatorAgent`**: Main orchestrator agent with clean separation of concerns
- **`ConversationManager`**: Conversation state and flow control management
- **`DisplayManager`**: Centralized display and logging functionality
- **`ContextManager`**: Strategic context window optimization (Factor 3)
- **`EnhancedToolExecutor`**: Structured tool execution with validation (Factor 4)
- **`PromptManager`**: Dynamic prompt selection and management
- **`ClaudeClient`**: Anthropic Claude API integration
- **`NotionClient`**: Notion API integration for GTD system

### Available Tools

1. **`create_task`**: Creates tasks in Notion GTD system
2. **`ask_question`**: Interactive user questioning for information gathering
3. **`create_project`**: Creates projects with importance levels

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
│   └── task-creator.ts           # Main orchestrator agent (refactored)
├── clients/
│   ├── claude.ts                 # Anthropic Claude API client
│   └── notion.ts                 # Notion API client
├── conversation/                 # Conversation management components
│   ├── conversation-manager.ts   # Conversation state and flow control
│   ├── collected-info-manager.ts # User information collection
│   └── display-manager.ts        # Display and logging functionality
├── context/                      # Factor 3: Context Management
│   ├── context-manager.ts        # Strategic context optimization
│   ├── message-prioritizer.ts    # Message priority assessment
│   └── token-counter.ts          # Token calculation utilities
├── tools/                        # Factor 1 & 4: Tool System
│   ├── index.ts                  # Legacy tool execution engine
│   ├── enhanced-tool-executor.ts # Factor 4: Enhanced execution with validation
│   ├── tool-execution-context.ts # Factor 4: Execution context management
│   ├── tool-result-validator.ts  # Factor 4: Input/output validation
│   └── question-handler.ts       # Interactive questioning
├── prompts/                      # Factor 2: Prompt Management
│   ├── prompt-functions.ts       # Dynamic prompt functions
│   └── prompt-manager.ts         # Prompt orchestration
├── types/
│   ├── conversation-types.ts     # Conversation-related types
│   ├── context-types.ts          # Context management types
│   ├── prompt-types.ts           # Prompt system types
│   ├── tools.ts                  # Tool system types
│   └── toolGuards.ts            # Runtime type validation
├── utils/
│   └── notionUtils.ts           # Notion utility functions
└── test-*.ts                    # Various test scenarios
```

## 🗺️ Development Roadmap

See [PLAN.md](./PLAN.md) for the comprehensive development plan covering all 12 factors.

### Next Priorities

1. **Factor 3**: Context Window Management
2. **Factor 4**: Structured Tool Outputs
3. **Factor 5**: State Management
4. Enhanced test coverage and error handling

## 🌟 Key Features

- **Clean Architecture**: Refactored with separation of concerns and single responsibility principle
- **Modular Components**: Simplified architecture with direct conversation history management
- **Dynamic Conversation Management**: Adapts prompts based on conversation stage
- **Type-Safe Architecture**: Full TypeScript implementation with strict typing
- **Enhanced Maintainability**: Easy to extend, test, and modify individual components
- **Production-Ready**: Following enterprise-grade development practices
- **Interactive Learning**: Demonstrates 12-factor agents principles progressively

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
