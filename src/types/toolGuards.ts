import { AgentTool, CreateTaskTool, CreateProjectTool, AskQuestionTool } from './tools';

export function isCreateTaskTool(tool: AgentTool): tool is CreateTaskTool {
  return tool.function.name === 'create_task';
}

export function isCreateProjectTool(tool: AgentTool): tool is CreateProjectTool {
  return tool.function.name === 'create_project';
}

export function isAskQuestionTool(tool: AgentTool): tool is AskQuestionTool {
  return tool.function.name === 'ask_question';
}


