# Tool-Based Implementation Plan
## TaskAgent への段階的Tool実装戦略

---

## 📋 Implementation Overview

### Strategy
クラス単位ではなく**Tool単位**での段階的実装により、各機能を独立してテスト・デプロイ可能にし、リスクを最小化しながら確実に機能拡張を進める。

### Benefits of Tool-Based Approach
- **🔄 Incremental Delivery**: 各Toolが完成次第すぐに利用可能
- **📊 Risk Mitigation**: 1つのToolに問題があっても他に影響なし
- **🧪 Independent Testing**: Tool毎に完全なテスト実行
- **⚡ Faster Feedback**: 早期にユーザーフィードバック取得
- **🔧 Easy Rollback**: 問題のあるTool単体を無効化可能

---

## 🎯 Tool Implementation Priority

### ✅ Phase A: Core Query Tool - COMPLETED
**Tool**: `get_tasks` - タスク一覧取得
**Priority**: ⭐⭐⭐⭐⭐ (最高優先度)
**Status**: ✅ **IMPLEMENTED AND DEPLOYED**
**Rationale**: 最も利用頻度が高く、ユーザー価値が最大

### Phase B: Project Discovery Tool
**Tool**: `get_projects` - プロジェクト一覧取得  
**Priority**: ⭐⭐⭐⭐ (高優先度)
**Rationale**: プロジェクト管理の基本機能

### Phase C: Project-Task Relationship Tool
**Tool**: `get_project_tasks` - プロジェクト関連タスク取得
**Priority**: ⭐⭐⭐ (中優先度)  
**Rationale**: Project-Task連携の強化

### Phase D: Task Detail Tool
**Tool**: `get_task_by_id` - 特定タスク詳細取得
**Priority**: ⭐⭐ (低優先度)
**Rationale**: 詳細確認機能（必要時のみ）

---

## 🔧 Phase A: `get_tasks` Tool Implementation

### A.1 Type System Foundation

#### File: `src/types/tools.ts` (Partial Update)

```typescript
// ===== ADD get_tasks TOOL ONLY =====

// タスク一覧取得ツール
export interface GetTasksTool extends ToolCall {
  function: {
    name: 'get_tasks';
    parameters: {
      task_type?: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
      project_id?: string;
      limit?: number; // Default: 10, Max: 100
      include_completed?: boolean; // Default: false
      sort_by?: 'created_at' | 'updated_at' | 'scheduled_date';
      sort_order?: 'asc' | 'desc'; // Default: 'desc'
    };
  };
}

// タスク情報（拡張版）
export interface TaskInfo {
  task_id: string;
  title: string;
  description: string;
  task_type: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
  scheduled_date?: string;
  project_id?: string;
  project_name?: string;
  created_at: Date;
  updated_at: Date;
  notion_url?: string;
  status: 'active' | 'completed' | 'archived';
}

// タスククエリ結果
export interface TaskQueryResult {
  tasks: TaskInfo[];
  total_count: number;
  has_more: boolean;
  query_parameters: Record<string, unknown>;
}

// ===== EXTEND UNION TYPES (Add get_tasks only) =====
export type AgentTool = 
  | CreateTaskTool 
  | CreateProjectTool 
  | UserInputTool
  | GetTasksTool;          // ADD THIS ONLY

// ===== EXTEND RESULT TYPE MAPPING =====
export interface ToolResultTypeMap {
  // Existing
  create_task: TaskCreationResult;
  user_input: UserInputResult;
  create_project: ProjectCreationResult;
  // New - get_tasks only
  get_tasks: TaskQueryResult;
}

// Type-safe result type
export type GetTasksToolResult = ToolResultFor<'get_tasks'>;
```

#### File: `src/types/toolGuards.ts` (Add get_tasks only)

```typescript
// ===== ADD get_tasks TOOL GUARD ONLY =====

import type { GetTasksTool, TaskQueryResult } from './tools';

export function isGetTasksTool(tool: AgentTool): tool is GetTasksTool {
  return tool.function.name === 'get_tasks';
}

export function isTaskQueryResultData(data: unknown): data is TaskQueryResult {
  return typeof data === 'object' && 
         data !== null && 
         'tasks' in data && 
         'total_count' in data &&
         Array.isArray((data as TaskQueryResult).tasks);
}

// Helper function for query tool detection (get_tasks only for now)
export function isQueryTool(tool: AgentTool): boolean {
  return isGetTasksTool(tool);
}
```

### A.2 Event System Extension

#### File: `src/events/types.ts` (Add get_tasks events only)

```typescript
// ===== ADD get_tasks EVENTS ONLY =====
export type EventType =
  // Existing events
  | 'user_message'
  | 'user_input_request'
  | 'user_input_response'
  | 'create_task' | 'create_project' | 'user_input'
  | 'create_task_result' | 'create_project_result' | 'user_input_result'
  | 'agent_response' | 'conversation_end' | 'error'
  // New get_tasks events ONLY
  | 'get_tasks' | 'get_tasks_result';

// ===== get_tasks EVENT DATA INTERFACES =====

export interface GetTasksData {
  task_type?: string;
  project_id?: string;
  limit?: number;
  include_completed?: boolean;
  sort_by?: string;
  sort_order?: string;
}

export interface GetTasksResultData {
  success: boolean;
  query_parameters: Record<string, unknown>;
  tasks?: TaskInfo[];
  total_count?: number;
  has_more?: boolean;
  error?: string;
  execution_time: number;
}

// ===== EXTEND EVENT TYPE DATA MAP (get_tasks only) =====
export interface EventTypeDataMap {
  // Existing mappings...
  user_message: UserMessageData;
  create_task: CreateTaskData;
  create_project: CreateProjectData;
  user_input: UserInputData;
  create_task_result: CreateTaskResultData;
  create_project_result: CreateProjectResultData;
  user_input_result: UserInputResultData;
  agent_response: AgentResponseData;
  conversation_end: AgentResponseData;
  error: ErrorData;
  
  // New get_tasks event mappings ONLY
  get_tasks: GetTasksData;
  get_tasks_result: GetTasksResultData;
}
```

### A.3 Notion API Implementation

#### File: `src/clients/notion.ts` (Add getTasks method only)

```typescript
// ===== ADD IMPORT FOR get_tasks ONLY =====
import type {
  GetTasksTool,
  TaskInfo,
  TaskQueryResult,
} from '../types/tools';

export class NotionClient {
  // ... existing methods ...

  // ===== NEW: getTasks METHOD ONLY =====

  /**
   * Get tasks with optional filtering
   */
  async getTasks(tool: GetTasksTool): Promise<TaskQueryResult> {
    const { 
      task_type, 
      project_id, 
      limit = 10, 
      include_completed = false,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = tool.function.parameters;

    try {
      console.log(`🔍 [NOTION] Getting tasks with filters:`, tool.function.parameters);
      
      const query = this.buildTaskQuery({
        task_type,
        project_id,
        include_completed,
        sort_by,
        sort_order
      });

      const response = await this.client.databases.query({
        database_id: this.tasksDbId,
        ...query,
        page_size: Math.min(limit, 100) // Notion API limit
      });

      const tasks = await this.parseTasksFromNotionResponse(response.results);
      
      console.log(`✅ [NOTION] Found ${tasks.length} tasks`);
      
      return {
        tasks,
        total_count: tasks.length,
        has_more: response.has_more,
        query_parameters: tool.function.parameters
      };
    } catch (error) {
      console.error('❌ [NOTION] Get tasks failed:', error);
      throw new Error(`Failed to get tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===== PRIVATE HELPER METHODS FOR get_tasks =====

  /**
   * Build Notion query for tasks
   */
  private buildTaskQuery(filters: {
    task_type?: string;
    project_id?: string;
    include_completed?: boolean;
    sort_by?: string;
    sort_order?: string;
  }) {
    const notionFilters: any[] = [];
    
    // Task type filter
    if (filters.task_type) {
      notionFilters.push({
        property: 'Type',
        select: { equals: filters.task_type }
      });
    }

    // Project filter
    if (filters.project_id) {
      notionFilters.push({
        property: 'Project',
        relation: { contains: filters.project_id }
      });
    }

    // Completion status filter
    if (!filters.include_completed) {
      notionFilters.push({
        property: 'Status',
        checkbox: { equals: false }
      });
    }

    // Build sorts
    const sorts = [];
    if (filters.sort_by) {
      const property = this.mapSortFieldToNotionProperty(filters.sort_by);
      sorts.push({
        property,
        direction: filters.sort_order === 'asc' ? 'ascending' : 'descending'
      });
    }

    return {
      filter: notionFilters.length > 0 ? { and: notionFilters } : undefined,
      sorts: sorts.length > 0 ? sorts : undefined
    };
  }

  /**
   * Map sort field to Notion property name
   */
  private mapSortFieldToNotionProperty(sortField: string): string {
    const mapping: Record<string, string> = {
      'created_at': 'Created time',
      'updated_at': 'Last edited time',
      'scheduled_date': 'Scheduled Date',
    };
    
    return mapping[sortField] || 'Created time';
  }

  /**
   * Parse tasks from Notion response
   */
  private async parseTasksFromNotionResponse(results: any[]): Promise<TaskInfo[]> {
    const tasks: TaskInfo[] = [];
    
    for (const result of results) {
      if (!isFullPageResponse(result)) continue;
      
      try {
        const task = this.parseTaskFromNotionPage(result);
        tasks.push(task);
      } catch (error) {
        console.warn(`Failed to parse task ${result.id}:`, error);
        // Continue processing other tasks
      }
    }
    
    return tasks;
  }

  /**
   * Parse single task from Notion page
   */
  private parseTaskFromNotionPage(page: PageObjectResponse): TaskInfo {
    const properties = page.properties;
    
    // Extract basic task information
    const title = this.extractTextFromProperty(properties, 'Name') || 'Untitled Task';
    const description = this.extractTextFromProperty(properties, 'Description') || '';
    const task_type = this.extractSelectFromProperty(properties, 'Type') || 'Next Actions';
    
    // Extract dates
    const scheduled_date = this.extractDateFromProperty(properties, 'Scheduled Date');
    
    // Extract project information
    const project_id = this.extractRelationFromProperty(properties, 'Project');
    const project_name = this.extractTextFromProperty(properties, 'Project Name'); // If available
    
    // Extract status
    const completed = this.extractCheckboxFromProperty(properties, 'Status') || false;
    
    return {
      task_id: page.id,
      title,
      description,
      task_type: task_type as TaskInfo['task_type'],
      scheduled_date,
      project_id,
      project_name,
      created_at: new Date(page.created_time),
      updated_at: new Date(page.last_edited_time),
      notion_url: page.url,
      status: completed ? 'completed' : 'active'
    };
  }

  // ===== UTILITY METHODS (Reusable for future tools) =====
  
  private extractTextFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop) return undefined;
    
    if (prop.type === 'title' && prop.title.length > 0) {
      return prop.title[0].plain_text;
    }
    if (prop.type === 'rich_text' && prop.rich_text.length > 0) {
      return prop.rich_text[0].plain_text;
    }
    
    return undefined;
  }
  
  private extractSelectFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'select') return undefined;
    
    return prop.select?.name;
  }
  
  private extractDateFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'date') return undefined;
    
    return prop.date?.start;
  }
  
  private extractRelationFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'relation') return undefined;
    
    return prop.relation.length > 0 ? prop.relation[0].id : undefined;
  }
  
  private extractCheckboxFromProperty(properties: any, propertyName: string): boolean {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'checkbox') return false;
    
    return prop.checkbox || false;
  }
}
```

### A.4 Enhanced Tool Executor Extension

#### File: `src/tools/enhanced-tool-executor.ts` (Add get_tasks execution only)

```typescript
// ===== ADD IMPORT FOR get_tasks ONLY =====
import type { GetTasksTool } from '../types/tools';
import { isGetTasksTool } from '../types/toolGuards';

export class EnhancedToolExecutor {
  // ... existing methods ...

  /**
   * Enhanced executeWithContext with get_tasks support
   */
  async executeWithContext<T = Record<string, unknown>>(
    tool: AgentTool,
    options: ExecutionOptions = {}
  ): Promise<EnrichedToolResult<T>> {
    const startTime = new Date();

    try {
      // ... existing validation logic ...

      // Execute tool based on type
      let result: any;
      if (isCreateTaskTool(tool)) {
        result = await this.legacyExecutor.createTask(tool);
      } else if (isCreateProjectTool(tool)) {
        result = await this.legacyExecutor.createProject(tool);
      } else if (isUserInputTool(tool)) {
        result = await this.legacyExecutor.getUserInput(tool);
      } 
      // NEW: get_tasks tool execution ONLY
      else if (isGetTasksTool(tool)) {
        result = await this.executeGetTasks(tool);
      } else {
        throw new Error(`Unknown tool type: ${tool.function.name}`);
      }

      // ... existing result processing ...

      return this.createSuccessResult<T>(tool, startTime, result, options);
    } catch (error) {
      return this.createErrorResult<T>(tool, startTime, 'EXECUTION_FAILED', 
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        options);
    }
  }

  // ===== NEW: get_tasks EXECUTION METHOD ONLY =====

  /**
   * Execute get_tasks tool
   */
  private async executeGetTasks(tool: GetTasksTool): Promise<any> {
    try {
      console.log(`🔍 [EXECUTOR] Getting tasks with filters:`, tool.function.parameters);
      
      const result = await this.notionClient.getTasks(tool);
      
      console.log(`✅ [EXECUTOR] Found ${result.tasks.length} tasks`);
      return result;
    } catch (error) {
      console.error('❌ [EXECUTOR] Get tasks failed:', error);
      throw error;
    }
  }

  // ... existing methods remain unchanged ...
}
```

### A.5 Claude API Tool Definition

#### File: `src/clients/claude.ts` (Add get_tasks tool definition only)

```typescript
async generateToolCall(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Anthropic.MessageParam[] = []
): Promise<AgentTool | null> {
  // ... existing retry logic ...

  const response = await this.client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools: [
      // ===== EXISTING TOOLS (unchanged) =====
      {
        name: 'create_task',
        description: 'Create a new task in the GTD system',
        input_schema: {
          // ... existing create_task schema ...
        },
      },
      {
        name: 'create_project',
        description: 'Create a new project in the GTD system',
        input_schema: {
          // ... existing create_project schema ...
        },
      },
      {
        name: 'user_input',
        description: 'Request input from user when more information is needed',
        input_schema: {
          // ... existing user_input schema ...
        },
      },

      // ===== NEW: get_tasks TOOL DEFINITION ONLY =====
      {
        name: 'get_tasks',
        description: 'Retrieve tasks with optional filtering and sorting',
        input_schema: {
          type: 'object',
          properties: {
            task_type: {
              type: 'string',
              enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin'],
              description: 'Filter by task type'
            },
            project_id: {
              type: 'string',
              description: 'Filter by project ID'
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 10,
              description: 'Maximum number of tasks to return'
            },
            include_completed: {
              type: 'boolean',
              default: false,
              description: 'Whether to include completed tasks'
            },
            sort_by: {
              type: 'string',
              enum: ['created_at', 'updated_at', 'scheduled_date'],
              default: 'created_at',
              description: 'Field to sort by'
            },
            sort_order: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
              description: 'Sort order'
            }
          },
          required: []
        },
      }
    ],
  });

  // ... existing response processing ...
}
```

### A.6 TaskCreatorAgent Integration

#### File: `src/agents/task-creator.ts` (Add get_tasks support only)

```typescript
// ===== ADD IMPORTS FOR get_tasks ONLY =====
import {
  isCreateProjectTool,
  isCreateTaskTool,
  isUserInputResultData,
  isUserInputTool,
  // New: get_tasks support only
  isGetTasksTool,
  isTaskQueryResultData,
} from '../types/toolGuards';

export class TaskCreatorAgent {
  // ... existing methods unchanged ...

  /**
   * Enhanced tool execution with get_tasks support
   */
  private async executeTool(toolCall: AgentTool): Promise<ProcessMessageResult> {
    this.displayToolCallInfo(toolCall);

    const result = await this.executeToolWithContext(toolCall);
    
    // Enhanced result handling
    if (isUserInputTool(toolCall)) {
      this.handleUserInputResult(toolCall, result);
    } else if (isGetTasksTool(toolCall)) {
      this.handleGetTasksResult(toolCall, result);  // NEW: get_tasks result handling
    }

    return { toolCall, toolResult: result };
  }

  /**
   * Enhanced display for get_tasks tool
   */
  private displayToolCallInfo(toolCall: AgentTool): void {
    this.displayManager.displayToolCall(toolCall.function.name);

    if (isGetTasksTool(toolCall)) {
      console.log(`🔍 [QUERY] Executing get_tasks with parameters:`, 
        toolCall.function.parameters);
    } else if (toolCall.function.name === 'user_input') {
      this.displayManager.displayQuestionTimeout();
    }
  }

  // ===== NEW: get_tasks RESULT HANDLING =====

  /**
   * Handle get_tasks result with enhanced display
   */
  private handleGetTasksResult(toolCall: GetTasksTool, enrichedResult: EnrichedToolResult): void {
    if (!this.isResultSuccessful({ toolCall, toolResult: enrichedResult })) {
      console.log('❌ [QUERY] Get tasks failed');
      return;
    }

    const data = enrichedResult.data;
    if (isTaskQueryResultData(data)) {
      this.displayTaskQueryResults(data, toolCall.function.parameters);
    }
  }

  /**
   * Display task query results
   */
  private displayTaskQueryResults(result: TaskQueryResult, parameters: any): void {
    console.log('\n📋 Task Query Results:');
    console.log(`   Found: ${result.tasks.length} tasks`);
    if (result.has_more) {
      console.log('   📄 More results available');
    }

    // Show applied filters
    if (parameters.task_type) {
      console.log(`   🏷️  Filter: ${parameters.task_type}`);
    }
    if (parameters.project_id) {
      console.log(`   📁 Project: ${parameters.project_id}`);
    }

    // Display tasks
    result.tasks.forEach((task, index) => {
      console.log(`\n   ${index + 1}. ${task.title}`);
      console.log(`      Type: ${task.task_type}`);
      console.log(`      Status: ${task.status}`);
      if (task.project_name) {
        console.log(`      Project: ${task.project_name}`);
      }
      if (task.scheduled_date) {
        console.log(`      Due: ${task.scheduled_date}`);
      }
      console.log(`      ID: ${task.task_id}`);
    });
  }

  // ===== ENHANCED EVENT RECORDING FOR get_tasks =====

  /**
   * Record tool execution event (add get_tasks support)
   */
  private recordToolExecutionEvent(toolCall: AgentTool): void {
    // ... existing event recording logic ...

    // NEW: get_tasks event recording
    if (isGetTasksTool(toolCall)) {
      this.contextManager.addEvent('get_tasks', {
        task_type: toolCall.function.parameters.task_type,
        project_id: toolCall.function.parameters.project_id,
        limit: toolCall.function.parameters.limit,
        include_completed: toolCall.function.parameters.include_completed,
        sort_by: toolCall.function.parameters.sort_by,
        sort_order: toolCall.function.parameters.sort_order,
      });
    }
  }

  /**
   * Record tool result event (add get_tasks support)
   */
  private recordToolResultEvent(toolCall: AgentTool, result: EnrichedToolResult): void {
    // ... existing result recording logic ...

    // NEW: get_tasks result recording
    if (isGetTasksTool(toolCall)) {
      this.contextManager.addEvent('get_tasks_result', {
        success: result.success,
        query_parameters: toolCall.function.parameters,
        tasks: isTaskQueryResultData(result.data) ? result.data.tasks : undefined,
        total_count: isTaskQueryResultData(result.data) ? result.data.total_count : 0,
        has_more: isTaskQueryResultData(result.data) ? result.data.has_more : false,
        error: result.success ? undefined : result.error?.message,
        execution_time: result.executionTimeMs || 0,
      });
    }
  }

  // ... all other methods remain unchanged ...
}
```

### A.7 System Prompt Update

#### File: `src/prompts/system-prompt.ts` (Add get_tasks support only)

```typescript
export const buildSystemPrompt = (context: PromptContext) => `
You are a Notion GTD system task management assistant.

## Available Tools

### Creation Tools
1. **create_task** - Create a new task when you have sufficient information
   - title: Task title (required)
   - description: Detailed description (required)
   - task_type: "Today" | "Next Actions" | "Someday / Maybe" | "Wait for" | "Routin"
   - scheduled_date: Scheduled date (ISO format, optional)
   - project_id: Related project ID (optional)

2. **create_project** - Create a new project when you have sufficient information
   - name: Project name (required)
   - description: Project description (required)
   - importance: "⭐" | "⭐⭐" | "⭐⭐⭐" | "⭐⭐⭐⭐" | "⭐⭐⭐⭐⭐" (required, default: "⭐⭐⭐")
   - action_plan: Action plan (optional)

3. **user_input** - Request input from user when you need more information
   - message: Clear explanation of what information you need and why
   - context: Context of what you are trying to accomplish

### NEW: Query Tool
4. **get_tasks** - Retrieve tasks with filtering options
   - task_type: Filter by task type (optional)
   - project_id: Filter by project ID (optional)  
   - limit: Number of results (1-100, default: 10)
   - include_completed: Include completed tasks (default: false)
   - sort_by: "created_at" | "updated_at" | "scheduled_date" (default: "created_at")
   - sort_order: "asc" | "desc" (default: "desc")

## Current Context
- Current user message: "${context.userMessage}"
${buildContextualInformation(context)}

## Enhanced Strategy (Now with Task Queries!)

### For Query Requests:
1. **"Show my tasks"** → get_tasks with no filters (recent tasks)
2. **"Today's tasks"** → get_tasks with task_type: "Today"
3. **"What's in my backlog?"** → get_tasks with task_type: "Someday / Maybe"
4. **"Show completed tasks"** → get_tasks with include_completed: true
5. **"Recent tasks"** → get_tasks with sort_by: "created_at", limit: 5

### For Creation Requests (Enhanced):
1. **Check for similar tasks first** (use get_tasks with relevant filters)
2. **If duplicates found, confirm creation** or offer alternatives
3. **If no duplicates, create as usual**

### Smart Examples:
- "What should I work on?" → get_tasks with task_type: "Today"
- "Show me my urgent tasks" → get_tasks with task_type: "Today", limit: 5
- "List all my next actions" → get_tasks with task_type: "Next Actions"
- "What have I completed recently?" → get_tasks with include_completed: true, limit: 10

## Decision Logic (Updated):
1. **For task queries** → Use get_tasks with appropriate filters
2. **Before creating tasks** → Check for duplicates with get_tasks
3. **For vague creation requests** → Use user_input to clarify
4. **Always provide context** → Show relevant task information to help decisions

You can now both CREATE and VIEW tasks! Use this to provide smarter, more informed assistance.
`;

const buildContextualInformation = (context: PromptContext): string => {
  if (context.thread.isEmpty()) return '';
  return `\n${context.thread.toPrompt()}`;
};
```

### A.8 Testing & Validation

#### File: `src/test-get-tasks.ts` (Dedicated get_tasks test)

```typescript
import dotenv from 'dotenv';
import { TaskCreatorAgent } from './agents/task-creator';

dotenv.config();

async function testGetTasksTool() {
  console.log('🚀 Testing get_tasks Tool Implementation\n');

  try {
    const agent = new TaskCreatorAgent();

    // Test connections
    const connectionsOk = await agent.testConnections();
    if (!connectionsOk) {
      console.log('❌ Connection tests failed');
      return;
    }

    console.log('✅ Connections successful!\n');

    // ===== get_tasks SPECIFIC TESTS =====

    console.log('=== Test 1: Get All Tasks ===');
    await agent.processMessage('Show me all my tasks');
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('=== Test 2: Get Today Tasks ===');
    await agent.processMessage('What do I need to do today?');
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('=== Test 3: Get Next Actions ===');
    await agent.processMessage('Show me my next actions');
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('=== Test 4: Get Recent Tasks (Limited) ===');
    await agent.processMessage('Show me my 5 most recent tasks');
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('=== Test 5: Get Completed Tasks ===');
    await agent.processMessage('What have I completed recently?');
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('=== Test 6: Smart Task Creation (with duplicate check) ===');
    await agent.processMessage('Create a task to review quarterly reports');
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('🎊 get_tasks tool testing completed!');
    
  } catch (error) {
    console.error('❌ Testing failed:', error);
  }
}

if (require.main === module) {
  testGetTasksTool();
}
```

#### Unit Test: `src/agents/task-creator.get-tasks.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskCreatorAgent } from './task-creator';
import type { GetTasksTool, TaskQueryResult, TaskInfo } from '../types/tools';

describe('TaskCreatorAgent - get_tasks Tool', () => {
  let agent: TaskCreatorAgent;
  let mockToolExecutor: any;

  beforeEach(() => {
    mockToolExecutor = {
      executeWithContext: vi.fn(),
    };

    agent = new TaskCreatorAgent();
    (agent as any).toolExecutor = mockToolExecutor;
  });

  describe('get_tasks functionality', () => {
    it('should handle "show my tasks" request', async () => {
      const mockResult: TaskQueryResult = {
        tasks: [
          {
            task_id: 'task1',
            title: 'Test Task',
            description: 'Test Description',
            task_type: 'Today',
            created_at: new Date(),
            updated_at: new Date(),
            status: 'active'
          } as TaskInfo
        ],
        total_count: 1,
        has_more: false,
        query_parameters: {}
      };

      mockToolExecutor.executeWithContext.mockResolvedValue({
        success: true,
        data: mockResult,
        executionTimeMs: 100
      });

      const result = await agent.processMessage("Show me my tasks");
      
      expect(result.toolCall?.function.name).toBe('get_tasks');
      expect(mockToolExecutor.executeWithContext).toHaveBeenCalled();
    });

    it('should filter by task type for "today tasks"', async () => {
      mockToolExecutor.executeWithContext.mockResolvedValue({
        success: true,
        data: { tasks: [], total_count: 0, has_more: false, query_parameters: {} }
      });

      const result = await agent.processMessage("What do I need to do today?");
      
      const toolCall = result.toolCall as GetTasksTool;
      expect(toolCall.function.name).toBe('get_tasks');
      expect(toolCall.function.parameters.task_type).toBe('Today');
    });

    it('should include completed tasks when requested', async () => {
      mockToolExecutor.executeWithContext.mockResolvedValue({
        success: true,
        data: { tasks: [], total_count: 0, has_more: false, query_parameters: {} }
      });

      const result = await agent.processMessage("Show me completed tasks");
      
      const toolCall = result.toolCall as GetTasksTool;
      expect(toolCall.function.parameters.include_completed).toBe(true);
    });

    it('should limit results when requested', async () => {
      const result = await agent.processMessage("Show me my 5 most recent tasks");
      
      const toolCall = result.toolCall as GetTasksTool;
      expect(toolCall.function.parameters.limit).toBe(5);
    });

    it('should record events in XML context', async () => {
      mockToolExecutor.executeWithContext.mockResolvedValue({
        success: true,
        data: { tasks: [], total_count: 0, has_more: false, query_parameters: {} }
      });

      await agent.processMessage("Show me my tasks");
      
      const context = agent.contextManager.exportHistory();
      expect(context.threadContext).toContain('<get_tasks>');
      expect(context.threadContext).toContain('<get_tasks_result>');
    });
  });
});
```

### A.9 Package.json Script Update

#### File: `package.json` (Add get_tasks test script)

```json
{
  "scripts": {
    // ... existing scripts ...
    "test-get-tasks": "tsx src/test-get-tasks.ts"
  }
}
```

### A.10 Phase A Completion Checklist

```typescript
// Phase A Validation Checklist
const phaseACompletion = {
  typeSystem: [
    '✅ GetTasksTool interface defined',
    '✅ TaskInfo and TaskQueryResult interfaces created', 
    '✅ Type guards implemented (isGetTasksTool, isTaskQueryResultData)',
    '✅ AgentTool union type extended',
    '✅ Event types extended (get_tasks, get_tasks_result)'
  ],
  
  implementation: [
    '✅ NotionClient.getTasks() method implemented',
    '✅ EnhancedToolExecutor.executeGetTasks() added',
    '✅ Claude API tool definition added',
    '✅ TaskCreatorAgent.handleGetTasksResult() implemented',
    '✅ System prompt updated with get_tasks documentation'
  ],
  
  testing: [
    '✅ Unit tests for get_tasks functionality',
    '✅ Integration test script (test-get-tasks.ts)',
    '✅ XML context event recording verified',
    '✅ Error handling tested'
  ],
  
  validation: [
    'npm run build',
    'npx tsc --noEmit', 
    'npm run test-get-tasks',
    'npm run interactive'
  ]
};
```

---

## 🔧 Phase B: `get_projects` Tool Implementation

### B.1 Incremental Type Extensions

#### File: `src/types/tools.ts` (Add get_projects only)

```typescript
// ===== ADD get_projects TOOL (Phase B) =====

export interface GetProjectsTool extends ToolCall {
  function: {
    name: 'get_projects';
    parameters: {
      importance?: '⭐' | '⭐⭐' | '⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐⭐⭐';
      limit?: number; // Default: 10, Max: 50
      sort_by?: 'created_at' | 'updated_at' | 'importance';
      sort_order?: 'asc' | 'desc'; // Default: 'desc'
    };
  };
}

// プロジェクト情報（拡張版）
export interface ProjectInfo {
  project_id: string;
  name: string;
  description: string;
  importance: '⭐' | '⭐⭐' | '⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐⭐⭐';
  action_plan?: string;
  task_count: number;
  completed_task_count: number;
  created_at: Date;
  updated_at: Date;
  notion_url?: string;
}

// プロジェクトクエリ結果
export interface ProjectQueryResult {
  projects: ProjectInfo[];
  total_count: number;
  has_more: boolean;
  query_parameters: Record<string, unknown>;
}

// ===== EXTEND UNION TYPE (Add get_projects) =====
export type AgentTool = 
  | CreateTaskTool 
  | CreateProjectTool 
  | UserInputTool
  | GetTasksTool          // From Phase A
  | GetProjectsTool;      // Phase B addition

// ===== EXTEND RESULT TYPE MAPPING =====
export interface ToolResultTypeMap {
  // Existing + Phase A
  create_task: TaskCreationResult;
  user_input: UserInputResult;
  create_project: ProjectCreationResult;
  get_tasks: TaskQueryResult;
  // Phase B addition
  get_projects: ProjectQueryResult;
}

export type GetProjectsToolResult = ToolResultFor<'get_projects'>;
```

### B.2 Incremental Implementation Strategy

Following the same pattern as Phase A, implement:

1. **Type Guards** (`src/types/toolGuards.ts`)
2. **Event System** (`src/events/types.ts`) 
3. **Notion API** (`src/clients/notion.ts`)
4. **Tool Executor** (`src/tools/enhanced-tool-executor.ts`)
5. **Claude API** (`src/clients/claude.ts`)
6. **Agent Integration** (`src/agents/task-creator.ts`)
7. **System Prompt** (`src/prompts/system-prompt.ts`)
8. **Testing** (`src/test-get-projects.ts`)

**Phase B Focus:**
- Project listing and filtering
- Project-task relationship understanding
- Importance-based filtering
- Integration with existing get_tasks functionality

---

## 🔗 Phase C: `get_project_tasks` Tool Implementation

### C.1 Tool Definition

```typescript
// Phase C: Project-Task relationship tool
export interface GetProjectTasksTool extends ToolCall {
  function: {
    name: 'get_project_tasks';
    parameters: {
      project_id: string; // Required - from Phase B context
      task_type?: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
      limit?: number; // Default: 20
      include_completed?: boolean; // Default: false
    };
  };
}
```

**Phase C Focus:**
- Project-task relationship queries
- Context-aware project ID resolution
- Combined filtering (project + task type)
- Integration with Phase A and B functionality

---

## 📝 Phase D: `get_task_by_id` Tool Implementation  

### D.1 Tool Definition

```typescript
// Phase D: Task detail retrieval
export interface GetTaskByIdTool extends ToolCall {
  function: {
    name: 'get_task_by_id';
    parameters: {
      task_id: string; // Required - from Phase A context
    };
  };
}
```

**Phase D Focus:**
- Individual task detail retrieval
- Task ID resolution from conversation context
- Detailed task information display
- Final integration testing

---

## 🧪 Cross-Phase Integration Strategy

### Integration Points

```typescript
// Phase Integration Dependencies
const phaseIntegrations = {
  'Phase A → Phase B': [
    'Project filtering in get_tasks results',
    'Project context for task queries'
  ],
  
  'Phase B → Phase C': [
    'Project ID extraction from get_projects results',
    'Context-aware project-task queries'  
  ],
  
  'Phase C → Phase D': [
    'Task ID extraction from query results',
    'Detailed task inspection workflow'
  ],
  
  'All Phases': [
    'XML context integration',
    'Unified error handling',
    'Performance monitoring'
  ]
};
```

### Smart Context Resolution

```typescript
// Example: Phase C using Phase B results
class SmartContextManager {
  // Get project ID from recent get_projects results
  extractProjectIdFromContext(projectName: string): string | undefined {
    const projectResults = this.thread.getEventsByType('get_projects_result');
    const latestResult = projectResults[projectResults.length - 1];
    
    if (latestResult?.data.success && latestResult.data.projects) {
      const project = latestResult.data.projects.find(p => 
        p.name.toLowerCase().includes(projectName.toLowerCase())
      );
      return project?.project_id;
    }
    
    return undefined;
  }
}
```

---

## 📊 Tool-Based Implementation Benefits

### 1. **Risk Minimization**
- Each tool can be independently tested and validated
- Problems with one tool don't affect others
- Easy rollback of individual features

### 2. **Incremental Value Delivery**
- Users get immediate benefit from each completed tool
- Feedback loop enables rapid iteration
- Early validation of user needs

### 3. **Development Efficiency**  
- Focused implementation reduces complexity
- Parallel development possible for different tools
- Easier debugging and troubleshooting

### 4. **Quality Assurance**
- Comprehensive testing per tool
- Independent validation
- Gradual integration verification

---

## 📅 Revised Implementation Timeline

| Phase | Tool | Duration | Key Deliverable | Validation |
|-------|------|----------|-----------------|------------|
| **A** | `get_tasks` | Week 1 | Task querying capability | `npm run test-get-tasks` |
| **B** | `get_projects` | Week 2 | Project discovery | `npm run test-get-projects` |
| **C** | `get_project_tasks` | Week 3 | Project-task relationships | `npm run test-project-tasks` |
| **D** | `get_task_by_id` | Week 4 | Task detail retrieval | `npm run test-task-details` |

**Benefits over Class-Based Approach:**
- ✅ **Faster Time-to-Value**: Each tool usable immediately
- ✅ **Lower Risk**: Isolated implementation and testing
- ✅ **Better Feedback**: Early user validation per tool
- ✅ **Easier Maintenance**: Independent tool lifecycle management

---

## 🚀 Getting Started with Phase A

### Quick Start Commands

```bash
# 1. Start with Phase A implementation
git checkout -b feature/get-tasks-tool

# 2. Implement Phase A changes (follow A.1 - A.10 above)

# 3. Test Phase A
npm run build
npm run test-get-tasks
npm run interactive

# 4. Validate Phase A completion
npx tsc --noEmit
npm test

# 5. Deploy Phase A (users can start using get_tasks)
git add .
git commit -m "feat: implement get_tasks tool (Phase A)"
git push origin feature/get-tasks-tool

# 6. Continue with Phase B...
```

この Tool-Based アプローチにより、より安全で効率的な実装が可能になり、各段階でユーザーに価値を提供しながら機能を拡張していけます。