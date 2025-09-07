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
- **Intelligent Task Management**: Create, retrieve, and organize tasks with AI assistance
- **Project Management**: Create and manage projects with importance levels and action plans
- **CLI Interface**: Simple command-line interface for quick interactions

## Prerequisites

- Node.js (v18 or higher)
- TypeScript
- Notion account with API access
- Anthropic API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/shomrkm/shochan_ai.git
cd shochan_ai
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NOTION_API_KEY=your_notion_api_key_here
NOTION_TASKS_DATABASE_ID=your_notion_tasks_database_id
NOTION_PROJECTS_DATABASE_ID=your_notion_projects_database_id
```

## Usage

### CLI Mode

Run the agent with a natural language command:

```bash
npm run cli "Show me my tasks for today"
npm run cli "Create a new project for learning TypeScript"
npm run cli "Add a task to review the quarterly report"
```

### Development Mode

Run in development mode with hot reloading:

```bash
npm run dev
```

### Build and Run

Build the project and run:

```bash
npm run build
npm start
```

## Example Interactions

**Task Retrieval:**
```bash
npm run cli "今週のタスクを10件教えて"
# Returns up to 10 tasks for this week
```

**Task Creation:**
```bash
npm run cli "明日までにレポートを完成させるタスクを作成して"
# Creates a task to complete a report by tomorrow
```

**Project Management:**
```bash
npm run cli "新しいWebサイト開発プロジェクトを作成して"
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

- `ANTHROPIC_API_KEY`: Your Anthropic API key for AI access
- `NOTION_API_KEY`: Your Notion integration token
- `NOTION_TASKS_DATABASE_ID`: The ID of your tasks Notion database
- `NOTION_PROJECTS_DATABASE_ID`: The ID of your projects Notion database

## Commands

- `npm run build`: Build the TypeScript project
- `npm start`: Run the built application
- `npm run dev`: Run in development mode
- `npm run cli`: Run CLI with arguments
- `npm test`: Run test suite
- `npm run test:watch`: Run tests in watch mode
- `npm run format`: Format code with Biome
- `npm run lint`: Lint code with Biome
- `npm run check`: Run all checks (format + lint)

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Project Structure

```
src/
├── agent/          # Core agent logic
├── clients/        # External API clients (Claude, Notion)
├── prompts/        # System prompts and messaging
├── thread/         # Conversation thread management
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── cli.ts          # Command-line interface
```


## License

ISC License

## Support

For issues and feature requests, please visit: https://github.com/shomrkm/shochan_ai/issues
