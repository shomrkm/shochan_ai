# Architecture Documentation

## Overview

Shochan AI is built as a conversational AI agent that bridges natural language requests with structured operations on external systems (Notion databases). The architecture follows clean separation of concerns with a focus on type safety, maintainability, and extensibility.

## High-Level Architecture

```
┌─────────────────┐
│   CLI Interface │  ← Entry point for user interaction
└─────────┬───────┘
          │
┌─────────▼───────┐
│   Task Agent    │  ← Core orchestrator and decision maker
└─────────┬───────┘
          │
┌─────────▼───────┐
│     Thread      │  ← Conversation state management
└─────────┬───────┘
          │
    ┌─────┼─────┐
    │     │     │
    ▼     ▼     ▼
┌─────┐ ┌───┐ ┌────┐
│Claude│ │API│ │Utils│  ← External integrations & utilities
└─────┘ └───┘ └────┘
```

## Core Components

### 1. CLI Interface (`src/cli.ts`)

The command-line interface serves as the entry point for user interactions.

**Responsibilities:**
- Parse command-line arguments
- Initialize the TaskAgent with user input
- Handle conversational loops for multi-turn interactions
- Manage user input/output for interactive sessions

**Key Features:**
- Single-command execution mode
- Interactive conversation handling
- Graceful error handling and process management

### 2. Task Agent (`src/agent/task-agent.ts`)

The central orchestrator that implements the main agent loop and decision-making logic.

**Responsibilities:**
- Convert natural language to structured tool calls via Claude
- Execute tool calls against external systems
- Manage conversation flow and state transitions
- Determine when to request more information vs. provide final responses

**Agent Loop Flow:**
```
1. Determine Next Step (via Claude)
2. Add step to conversation thread
3. Execute tool if needed
4. Continue loop until done_for_now or request_more_information
```

**Supported Tools:**
- `get_tasks`: Retrieve tasks from Notion with filtering options
- `create_task`: Create new tasks in Notion GTD system
- `create_project`: Create new projects with importance levels
- `request_more_information`: Ask user for clarification
- `done_for_now`: Provide final response to user

### 3. Thread Management (`src/thread/thread.ts`)

Manages conversation state and context serialization.

**Responsibilities:**
- Store conversation events in chronological order
- Serialize conversation context for AI model consumption
- Provide recursive object serialization for complex data structures
- Determine conversation state (awaiting response, approval, etc.)

**Event Structure:**
```typescript
interface Event {
  type: string;
  data: any;
}
```

**Serialization Features:**
- XML-based context serialization
- Recursive handling of nested objects and arrays
- Intelligent filtering of internal fields (e.g., 'intent')

### 4. External Clients

#### Claude Client (`src/clients/claude.ts`)

Handles integration with Anthropic's Claude API.

**Responsibilities:**
- Generate structured tool calls from natural language
- Manage API communication with retry logic
- Handle rate limiting and error recovery

**Features:**
- Configurable retry mechanism (3 attempts with exponential backoff)
- Comprehensive error handling
- Support for conversation history and tool definitions

#### Notion Client (`src/clients/notion.ts`)

Manages all interactions with Notion databases.

**Responsibilities:**
- CRUD operations on tasks and projects
- Database querying with filtering and sorting
- Data transformation between internal and Notion formats

**Supported Operations:**
- Task creation with GTD categorization
- Project creation with importance levels
- Task retrieval with advanced filtering options
- Proper error handling and validation

### 5. Type System (`src/types/`)

Comprehensive type definitions ensuring type safety across the application.

**Key Type Categories:**
- **Tool Types**: Structured definitions for all supported tools
- **Notion Types**: Database schema and API response types  
- **Task Types**: GTD system task categorizations
- **Tool Guards**: Runtime type validation functions

**Type Safety Features:**
- Strict TypeScript configuration
- Runtime type validation
- Discriminated unions for tool calls
- Comprehensive error type definitions

### 6. Utilities (`src/utils/`)

Supporting utilities for data processing and API interactions.

**Components:**
- **Notion Query Builder**: Constructs complex database queries
- **Notion Task Parser**: Transforms Notion responses to internal format
- **Notion Utils**: Helper functions for API parameter construction

## Data Flow

### 1. Request Processing Flow

```
User Input → CLI → TaskAgent → Claude Client → Tool Call
                     ↓
Thread ← Notion Client ← Tool Execution ← Tool Call
    ↓
Serialization → Claude Client → Next Action Decision
                    ↓
Final Response → CLI → User Output
```

### 2. Conversation State Management

The system maintains conversation state through an event-driven model:

1. **User Input Events**: Capture user requests and responses
2. **Tool Call Events**: Record AI decisions and tool invocations  
3. **Tool Result Events**: Store external system responses
4. **System Events**: Track state transitions and errors

### 3. Context Serialization

The Thread component serializes conversation context into XML format for AI consumption:

```xml
<user_input>
今週のタスクを10件教えて
</user_input>

<get_tasks>
limit: 10
task_type: Today
</get_tasks>

<get_tasks_result>
tasks: [
  {title: "レポート作成", description: "月次レポートの作成"},
  {title: "会議準備", description: "プロジェクト会議の資料準備"}
]
</get_tasks_result>
```

## Design Patterns

### 1. Agent Pattern

The TaskAgent implements a classical agent pattern with:
- **Perception**: Natural language understanding via Claude
- **Decision Making**: Tool selection and parameter determination
- **Action**: Tool execution against external systems
- **Learning**: Conversation context accumulation

### 2. Command Pattern

Tool calls implement the command pattern:
- **Command Interface**: ToolCall with intent and parameters
- **Concrete Commands**: CreateTaskTool, GetTasksTool, etc.
- **Invoker**: TaskAgent orchestrates execution
- **Receiver**: Notion Client executes actual operations

### 3. Strategy Pattern

The system uses strategy pattern for:
- **Tool Execution Strategies**: Different handling for different tool types
- **Serialization Strategies**: Various data transformation approaches
- **Error Handling Strategies**: Context-specific error recovery

## Configuration Management

### Environment Variables

```env
ANTHROPIC_API_KEY          # Claude API access
NOTION_API_KEY             # Notion integration token
NOTION_TASKS_DATABASE_ID   # Tasks database identifier
NOTION_PROJECTS_DATABASE_ID # Projects database identifier
```

### System Configuration

- **Claude Model**: claude-3-5-sonnet-20241022
- **Max Tokens**: 1024 for tool call generation
- **Retry Policy**: 3 attempts with exponential backoff
- **Default Limits**: 10 tasks per query, configurable up to 100

## Error Handling Strategy

### 1. Layered Error Handling

```
CLI Layer: User-friendly error messages
Agent Layer: Conversation flow error recovery  
Client Layer: API-specific error handling
Utility Layer: Data validation and transformation errors
```

### 2. Error Types

- **Configuration Errors**: Missing environment variables
- **API Errors**: External service failures with retry logic
- **Validation Errors**: Invalid tool parameters or data structures
- **Business Logic Errors**: GTD system constraint violations

### 3. Recovery Mechanisms

- **Automatic Retry**: For transient API failures
- **Graceful Degradation**: Partial functionality when services are limited
- **User Feedback**: Clear error messages with suggested actions
- **Conversation Recovery**: Ability to continue after errors

## Performance Considerations

### 1. API Optimization

- **Request Batching**: Minimize API calls where possible
- **Caching Strategy**: No persistent caching (stateless design)
- **Rate Limiting**: Built-in retry logic respects API limits

### 2. Memory Management

- **Conversation History**: Grows linearly with interaction length
- **Object Serialization**: Recursive but bounded by conversation depth
- **Event Storage**: In-memory only, no persistent storage

### 3. Scalability Factors

- **Stateless Design**: Each CLI invocation is independent
- **Single User Model**: Designed for individual task management
- **Resource Usage**: Bounded by conversation length and tool complexity

## Security Considerations

### 1. API Key Management

- Environment variable storage only
- No key logging or persistence
- Secure client initialization patterns

### 2. Data Privacy

- No persistent storage of conversation data
- Notion data access limited to configured databases
- User data never logged or transmitted beyond necessary APIs

### 3. Input Validation

- Comprehensive type checking at API boundaries
- Runtime validation of tool parameters
- Sanitization of user inputs before external API calls

## Testing Strategy

### 1. Unit Testing

- Individual component testing with Vitest
- Mock external dependencies (Claude, Notion APIs)
- Type guard validation testing
- Utility function testing

### 2. Integration Testing

- End-to-end CLI testing scenarios
- API client integration verification
- Error handling pathway testing

### 3. Type Testing

- TypeScript strict mode enforcement
- Runtime type validation testing
- Tool call structure validation

## Deployment & Operations

### 1. Build Process

```bash
npm run build    # TypeScript compilation
npm run check    # Linting and formatting
npm test         # Test suite execution
```

### 2. Runtime Requirements

- Node.js 18+ environment
- Environment variable configuration
- Network access to Anthropic and Notion APIs

### 3. Monitoring

- Console-based logging for development
- Error tracking through CLI exit codes
- No persistent metrics or monitoring (CLI tool design)

## Future Extensibility

### 1. New Tool Integration

The architecture supports easy addition of new tools:

1. Define tool interface in `src/types/tools.ts`
2. Add tool definition to TaskAgent tool list
3. Implement tool execution in handleNextStep
4. Add type guards for validation

### 2. Additional Clients

New external service integration follows the pattern:

1. Create client class in `src/clients/`
2. Define service-specific types
3. Add to TaskAgent dependency injection
4. Implement error handling and retry logic

### 3. Enhanced Conversation Management

The Thread system can be extended for:

- Persistent conversation storage
- Multi-session conversation tracking
- Advanced context management strategies
- Conversation branching and merging

## Conclusion

Shochan AI's architecture prioritizes simplicity, type safety, and maintainability while providing a robust foundation for natural language task management. The clean separation of concerns and comprehensive error handling make it suitable for both development and production use cases.