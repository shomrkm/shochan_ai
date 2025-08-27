// ToolCall for tool calling
export interface ToolCall {
  function: {
    name: string;
    parameters: Record<string, unknown>;
  };
}

// CreateTaskTool in Notion
export interface CreateTaskTool extends ToolCall {
  function: {
    name: 'create_task';
    parameters: {
      title: string;
      description: string;
      task_type: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
      scheduled_date?: string; // ISO format date string
      project_id?: string;
    };
  };
}

// UserInputTool for conversation - unified input collection
export interface UserInputTool extends ToolCall {
  function: {
    name: 'user_input';
    parameters: {
      message: string; // Message to display to user explaining what input is needed
      context: string; // Context of the request
    };
  };
}

// CreateProjectTool in Notion
export interface CreateProjectTool extends ToolCall {
  function: {
    name: 'create_project';
    parameters: {
      name: string;
      description: string;
      importance: '⭐' | '⭐⭐' | '⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐⭐⭐';
      action_plan?: string;
    };
  };
}

// GetTasksTool in Notion
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

export type AgentTool = CreateTaskTool | UserInputTool | CreateProjectTool | GetTasksTool;

// Tool to Result type mapping for strict type safety
export interface ToolResultTypeMap {
  create_task: TaskCreationResult;
  user_input: UserInputResult;
  create_project: ProjectCreationResult;
  get_tasks: TaskQueryResult; // Phase A addition
}

// Result types for each tool
export interface TaskCreationResult {
  task_id: string;
  title: string;
  description: string;
  task_type: string;
  created_at: Date;
  notion_url?: string;
  scheduled_date?: string;
  project_id?: string;
}

export interface ProjectCreationResult {
  project_id: string;
  name: string;
  description: string;
  importance: string;
  created_at: Date;
  notion_url?: string;
  action_plan?: string;
}

// Task query result
export interface TaskQueryResult {
  tasks: TaskInfo[];
  total_count: number;
  has_more: boolean;
  query_parameters: Record<string, unknown>;
}

export type AgentToolResult = TaskCreationResult | ProjectCreationResult | UserInputResult | TaskQueryResult | Record<string, unknown>;

// Factor 4: Enhanced structured tool results
export interface ToolExecutionMetadata {
  toolName: string;
  inputParameters: Record<string, unknown>;
  retryCount?: number;
  validationErrors?: string[];
  warnings?: string[];
}

export type ToolExecutionStatus =
  | 'success'
  | 'failure'
  | 'partial_success'
  | 'validation_error'
  | 'timeout'
  | 'retry_exhausted';

export interface ToolExecutionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
  suggestedAction?: string;
}

// Enhanced tool result with Factor 4 principles
export interface ToolResult<T extends AgentToolResult = AgentToolResult> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: Date;
  // Factor 4 enhancements
  executionTime?: number; // milliseconds
  metadata?: ToolExecutionMetadata;
  status?: ToolExecutionStatus;
  error?: ToolExecutionError;
}

// Type-safe tool result mapping
export type ToolResultFor<K extends keyof ToolResultTypeMap> = ToolResult<ToolResultTypeMap[K]>;

// Specific tool result types with strict mapping
export type TaskToolResult = ToolResultFor<'create_task'>;
export type ProjectToolResult = ToolResultFor<'create_project'>;
export type UserInputToolResult = ToolResultFor<'user_input'>;
export type GetTasksToolResult = ToolResultFor<'get_tasks'>; // Phase A addition

// Helper type for getting result type from tool type
export type ResultTypeForTool<T extends AgentTool> = 
  T extends CreateTaskTool ? TaskCreationResult :
  T extends CreateProjectTool ? ProjectCreationResult :
  T extends UserInputTool ? UserInputResult :
  T extends GetTasksTool ? TaskQueryResult : // Phase A addition
  never;

export interface UserInputResult {
  message: string; // Message displayed to user
  context: string;
  user_response?: string; // User's response
  timestamp: Date;
}
