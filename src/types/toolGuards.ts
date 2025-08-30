import type { EnrichedToolResult } from '../tools/tool-execution-context';
import type {
  AgentTool,
  CreateProjectTool,
  CreateTaskTool,
  DoneResult,
  DoneTool,
  GetTasksTool,
  TaskQueryResult,
  ToolResult,
  UserInputTool,
  UserInputToolResult,
} from './tools';

export function isCreateTaskTool(tool: AgentTool): tool is CreateTaskTool {
  return tool.function.name === 'create_task';
}

export function isCreateProjectTool(tool: AgentTool): tool is CreateProjectTool {
  return tool.function.name === 'create_project';
}

export function isUserInputTool(tool: AgentTool): tool is UserInputTool {
  return tool.function.name === 'user_input';
}

export function isGetTasksTool(tool: AgentTool): tool is GetTasksTool {
  return tool.function.name === 'get_tasks';
}

export function isDoneTool(tool: AgentTool): tool is DoneTool {
  return tool.function.name === 'done';
}

export function isTaskQueryResultData(data: unknown): data is TaskQueryResult {
  return typeof data === 'object' && 
         data !== null && 
         'tasks' in data && 
         'total_count' in data &&
         Array.isArray((data as TaskQueryResult).tasks);
}

export function isDoneResultData(data: unknown): data is DoneResult {
  return typeof data === 'object' && 
         data !== null && 
         'final_answer' in data && 
         'conversation_complete' in data &&
         (data as DoneResult).conversation_complete === true;
}

export function isEnrichedUserInputToolResult(result: EnrichedToolResult): boolean {
  if (!result.data) return false;

  return 'message' in result.data;
}

// Type guard for user input tool result data (for context building)
export function isUserInputResultData(data: unknown): data is { user_response: string } {
  return typeof data === 'object' && data !== null && 'user_response' in data;
}

export function isEnrichedTaskToolResult(result: EnrichedToolResult): boolean {
  if (!result.data) return false;

  return 'task_id' in result.data && 'title' in result.data;
}

// Type guard for Notion task result data (for context building)
export function isNotionTaskResultData(data: unknown): data is { id: string; properties?: any } {
  return typeof data === 'object' && data !== null && 'id' in data;
}

export function isEnrichedProjectToolResult(result: EnrichedToolResult): boolean {
  if (!result.data) return false;

  return 'project_id' in result.data && 'name' in result.data;
}

// Type guard for Notion project result data (for context building)
export function isNotionProjectResultData(data: unknown): data is { id: string; properties?: any } {
  return typeof data === 'object' && data !== null && 'id' in data;
}

// Helper function for query tool detection (get_tasks only for now)
export function isQueryTool(tool: AgentTool): boolean {
  return isGetTasksTool(tool);
}

// Helper function to check if result has enriched structure
export function isEnrichedToolResult(result: any): result is EnrichedToolResult {
  return (
    result &&
    'context' in result &&
    'startTime' in result &&
    'endTime' in result &&
    'executionTimeMs' in result &&
    'status' in result &&
    'metadata' in result
  );
}
