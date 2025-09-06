import type { ToolCall, CreateProjectTool, CreateTaskTool, GetTasksTool } from './tools';

export function isCreateTaskTool(tool: ToolCall): tool is CreateTaskTool {
  return tool.intent === 'create_task';
}

export function isCreateProjectTool(tool: ToolCall): tool is CreateProjectTool {
  return tool.intent === 'create_project';
}

export function isGetTasksTool(tool: ToolCall): tool is GetTasksTool {
  return tool.intent === 'get_tasks';
}
