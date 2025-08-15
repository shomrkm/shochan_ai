import {
  type AgentTool,
  type AskQuestionTool,
  type CreateProjectTool,
  type CreateTaskTool,
  type QuestionToolResult,
  TaskToolResult,
  type ToolResult,
} from './tools';

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
