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

// AskQuestionTool for conversation
export interface AskQuestionTool extends ToolCall {
  function: {
    name: 'ask_question';
    parameters: {
      question: string;
      context: string;
      question_type: 'clarification' | 'missing_info' | 'confirmation';
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

export type AgentTool = CreateTaskTool | AskQuestionTool | CreateProjectTool;

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

// Factor 4: Enhanced structured tool results
export interface ToolExecutionMetadata {
  toolName: string;
  inputParameters: Record<string, unknown>;
  retryCount?: number;
  validationErrors?: string[];
  warnings?: string[];
}

// Type Guards for runtime type checking
export function isCreateTaskTool(tool: AgentTool): tool is CreateTaskTool {
  return tool.function.name === 'create_task';
}

export function isCreateProjectTool(tool: AgentTool): tool is CreateProjectTool {
  return tool.function.name === 'create_project';
}

export function isAskQuestionTool(tool: AgentTool): tool is AskQuestionTool {
  return tool.function.name === 'ask_question';
}

export function isQuestionToolResult(result: ToolResult): result is QuestionToolResult {
  if (!result.data) return false;
  return 'question' in result.data;
}

// Factor 4: Enhanced tool result type guards
export function isEnrichedQuestionToolResult(result: import('../tools/tool-execution-context').EnrichedToolResult): boolean {
  if (!result.data) return false;
  return 'question' in result.data;
}

export function isEnrichedTaskToolResult(result: import('../tools/tool-execution-context').EnrichedToolResult): boolean {
  if (!result.data) return false;
  return 'task_id' in result.data && 'title' in result.data;
}

export function isEnrichedProjectToolResult(result: import('../tools/tool-execution-context').EnrichedToolResult): boolean {
  if (!result.data) return false;
  return 'project_id' in result.data && 'name' in result.data;
}

// Helper function to check if result has enriched structure
export function isEnrichedToolResult(result: any): result is import('../tools/tool-execution-context').EnrichedToolResult {
  return result && 
         'context' in result && 
         'startTime' in result && 
         'endTime' in result && 
         'executionTimeMs' in result &&
         'status' in result &&
         'metadata' in result;
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
export interface ToolResult<T extends Record<string, any> = Record<string, any>> {
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

// Specific tool result types
export type TaskToolResult = ToolResult<TaskCreationResult>;
export type ProjectToolResult = ToolResult<ProjectCreationResult>;
export type QuestionToolResult = ToolResult<QuestionResult>;

export interface QuestionResult {
  question: string;
  context: string;
  question_type: string;
  answer?: string;
  timestamp: Date;
}
