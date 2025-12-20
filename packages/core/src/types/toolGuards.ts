import type {
  ToolCall,
  CreateProjectTool,
  CreateTaskTool,
  GetTasksTool,
  DeleteTaskTool,
  UpdateTaskTool,
  GetTaskDetailsTool,
  RequestMoreInformationTool,
  DoneForNowTool,
} from './tools';

export function isCreateTaskTool(tool: ToolCall): tool is CreateTaskTool {
  return tool.intent === 'create_task';
}

export function isCreateProjectTool(tool: ToolCall): tool is CreateProjectTool {
  return tool.intent === 'create_project';
}

export function isGetTasksTool(tool: ToolCall): tool is GetTasksTool {
  return tool.intent === 'get_tasks';
}

export function isDeleteTaskTool(tool: ToolCall): tool is DeleteTaskTool {
  return tool.intent === 'delete_task';
}

export function isUpdateTaskTool(tool: ToolCall): tool is UpdateTaskTool {
  return tool.intent === 'update_task';
}

export function isGetTaskDetailsTool(tool: ToolCall): tool is GetTaskDetailsTool {
  return tool.intent === 'get_task_details';
}

export function isRequestMoreInformationTool(tool: ToolCall): tool is RequestMoreInformationTool {
  return tool.intent === 'request_more_information';
}

export function isDoneForNowTool(tool: ToolCall): tool is DoneForNowTool {
  return tool.intent === 'done_for_now';
}