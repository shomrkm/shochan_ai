import type { EnrichedToolResult } from '../tools/tool-execution-context';
import type {
  AgentTool,
  CreateProjectTool,
  CreateTaskTool,
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

export function isEnrichedUserInputToolResult(result: EnrichedToolResult): boolean {
  if (!result.data) return false;

  return 'message' in result.data;
}

export function isEnrichedTaskToolResult(result: EnrichedToolResult): boolean {
  if (!result.data) return false;

  return 'task_id' in result.data && 'title' in result.data;
}

export function isEnrichedProjectToolResult(result: EnrichedToolResult): boolean {
  if (!result.data) return false;

  return 'project_id' in result.data && 'name' in result.data;
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
