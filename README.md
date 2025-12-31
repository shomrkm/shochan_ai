# Shochan AI Agent

A personal AI-powered task management agent that integrates with Notion to provide intelligent GTD (Getting Things Done) system management through natural language conversation.

> **Personal Project Note**: This is a personal project designed specifically for my own task management needs. The codebase is tailored to my workflow and preferences for managing tasks and projects through natural language interaction with Notion databases.

## Overview

Shochan AI is a TypeScript-based intelligent agent built as a personal project for task and project management. It uses AI to understand natural language requests and performs operations on your Notion databases, enabling seamless task creation, retrieval, and project management through conversational interfaces.

## Features

- **Natural Language Processing**: Interact with your task management system using natural language
- **Notion Integration**: Seamlessly integrates with Notion databases for tasks and projects
- **GTD System Support**: Built-in support for Getting Things Done methodology with task types:
  - Today
  - Next Actions
  - Someday / Maybe
  - Wait for
  - Routine
- **Intelligent Task Management**: Create, retrieve, update, delete, and get detailed information about tasks with AI assistance
- **Task Detail Retrieval**: Get comprehensive task information including page content from Notion
- **Project Management**: Create and manage projects with importance levels and action plans
- **CLI Interface**: Simple command-line interface for quick interactions

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v8 or higher)
- TypeScript
- Notion account with API access
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/shomrkm/shochan_ai.git
cd shochan_ai
```

2. Install dependencies:
```bash
pnpm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
OPENAI_API_KEY=your_openai_api_key_here
NOTION_API_KEY=your_notion_api_key_here
NOTION_TASKS_DATABASE_ID=your_notion_tasks_database_id
NOTION_PROJECTS_DATABASE_ID=your_notion_projects_database_id
```

## Usage

### CLI Mode

Run the agent with a natural language command:

```bash
pnpm cli "Show me my tasks for today"
pnpm cli "Create a new project for learning TypeScript"
pnpm cli "Add a task to review the quarterly report"
```

### Build and Run

Build the project and run:

```bash
pnpm build
pnpm cli "your message here"
```

## Example Interactions

**Task Retrieval:**
```bash
pnpm cli "今週のタスクを10件教えて"
# Returns up to 10 tasks for this week
```

**Task Creation:**
```bash
pnpm cli "明日までにレポートを完成させるタスクを作成して"
# Creates a task to complete a report by tomorrow
```

**Task Details:**
```bash
pnpm cli "タスクID 277d4af9764f803a81ccef04703e79fb の詳細を教えて"
# Gets detailed information including page content for a specific task
```

**Task Management:**
```bash
pnpm cli "タスクを完了状態に更新して"
# Updates task status to completed
pnpm cli "不要なタスクを削除して"
# Deletes a task (requires approval)
```

**Project Management:**
```bash
pnpm cli "新しいWebサイト開発プロジェクトを作成して"
# Creates a new website development project
```

## Configuration

### Notion Database Setup

1. Create two Notion databases:
   - **Tasks Database** with properties:
     - Title (Title)
     - Description (Text)
     - Task Type (Select: Today, Next Actions, Someday / Maybe, Wait for, Routine)
     - Scheduled Date (Date)
     - Project (Relation to Projects database)
     - Status (Select)

   - **Projects Database** with properties:
     - Name (Title)
     - Description (Text)
     - Importance (Select: ⭐, ⭐⭐, ⭐⭐⭐, ⭐⭐⭐⭐, ⭐⭐⭐⭐⭐)
     - Action Plan (Text)

2. Get your database IDs from the Notion URLs
3. Create a Notion integration and get your API key
4. Share your databases with the integration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key for AI access
- `NOTION_API_KEY`: Your Notion integration token
- `NOTION_TASKS_DATABASE_ID`: The ID of your tasks Notion database
- `NOTION_PROJECTS_DATABASE_ID`: The ID of your projects Notion database

## Commands

- `pnpm build`: Build all packages in the monorepo
- `pnpm cli`: Run CLI with arguments
- `pnpm test`: Run test suite
- `pnpm test:watch`: Run tests in watch mode
- `pnpm format`: Format code with Biome
- `pnpm lint`: Lint code with Biome
- `pnpm check`: Run all checks (format + lint)
- `pnpm check:fix`: Auto-fix formatting and linting issues

## Testing

Run the test suite:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

## Project Structure

This project uses a monorepo structure with pnpm workspaces:

```
packages/
├── core/                        # Business logic (zod only)
│   ├── src/
│   │   ├── agent/              # Stateless Reducer, Orchestrator, Executors
│   │   ├── thread/             # Conversation thread management
│   │   ├── state/              # State persistence interfaces
│   │   ├── types/              # TypeScript type definitions with zod schemas
│   │   │   ├── tools.ts        # Tool call schemas and inferred types
│   │   │   ├── toolGuards.ts   # Type guard functions
│   │   │   └── event.ts        # Event type definitions
│   │   ├── utils/              # Utility functions
│   │   │   ├── notion-query-builder.ts  # Notion query construction
│   │   │   └── notion-task-parser.ts    # Notion response parsing
│   │   └── prompts/            # System prompts and messaging
│   │       └── system-prompt.ts # 12-factor agents system prompt
│   └── package.json
│
├── client/                      # API clients (depends on core)
│   ├── src/
│   │   ├── openai.ts           # OpenAI client with runtime validation
│   │   ├── notion.ts           # Notion API client with full CRUD operations
│   │   └── notionUtils.ts      # Notion utility functions
│   └── package.json
│
├── cli/                         # CLI implementation (depends on core + client)
│   ├── src/
│   │   ├── index.ts            # CLI entry point with AgentOrchestrator
│   │   └── agent/
│   │       └── task-agent-tools.ts  # Tool definitions for OpenAI
│   └── package.json
│
└── web/                         # Web API server (depends on core + client)
    ├── src/
    │   ├── server.ts           # Server initialization
    │   ├── app.ts              # Express app configuration
    │   ├── routes/             # API endpoints (agent, stream)
    │   ├── state/              # Redis state persistence
    │   └── streaming/          # SSE session management
    └── package.json
```

**Dependency Graph:**
- `packages/core` depends on zod only (for runtime type validation)
- `packages/client` depends on `@shochan_ai/core`
- `packages/cli` depends on `@shochan_ai/core` and `@shochan_ai/client`
- `packages/web` depends on `@shochan_ai/core` and `@shochan_ai/client`

**Package Documentation:**
- [Core Package](packages/core/README.md) - Business logic and agent core
- [Web API Package](packages/web/README.md) - RESTful API server with SSE streaming

## Available Tools

The agent supports 8 different tools for comprehensive task and project management:

1. **get_tasks** - Retrieve and filter tasks
2. **get_task_details** - Get detailed information about a specific task including page content
3. **create_task** - Create new tasks with full GTD categorization
4. **update_task** - Modify existing tasks (title, type, dates, project, status)
5. **delete_task** - Remove tasks (requires human approval)
6. **create_project** - Create new projects with importance levels
7. **request_more_information** - Ask for clarification when needed
8. **done_for_now** - Provide natural language responses


## License

ISC License

## Support

For issues and feature requests, please visit: https://github.com/shomrkm/shochan_ai/issues
