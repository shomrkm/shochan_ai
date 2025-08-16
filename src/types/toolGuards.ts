import {
  type AgentTool,
  type AskQuestionTool,
  type CreateProjectTool,
  type CreateTaskTool,
  type QuestionToolResult,
  type ToolResult,
} from './tools';
import type { EnrichedToolResult } from '../tools/tool-execution-context';

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

// Factor 4 Phase 3: Enhanced tool result type guards
export function isEnrichedQuestionToolResult(result: EnrichedToolResult): boolean {
  if (!result.data) return false;
  
  return 'question' in result.data;
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
  return result && 
         'context' in result && 
         'startTime' in result && 
         'endTime' in result && 
         'executionTimeMs' in result &&
         'status' in result &&
         'metadata' in result;
}
