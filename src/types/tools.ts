export interface ToolCall {
  intent: string;
  parameters: Record<string, unknown>;
}

export interface CreateTaskTool extends ToolCall {
  intent: 'create_task';
  parameters: {
    title: string;
    description: string;
    task_type: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
    scheduled_date?: string; // ISO format date string
    project_id?: string;
  };
}

export interface CreateProjectTool extends ToolCall {
  intent: 'create_project';
  parameters: {
    name: string;
    description: string;
    importance: '⭐' | '⭐⭐' | '⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐⭐⭐';
    action_plan?: string;
  };
}

export interface GetTasksTool extends ToolCall {
  intent: 'get_tasks';
  parameters: {
    task_type?: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
    project_id?: string;
    limit?: number; // Default: 10, Max: 100
    include_completed?: boolean; // Default: false
    sort_by?: 'created_at' | 'updated_at' | 'scheduled_date';
    sort_order?: 'asc' | 'desc'; // Default: 'desc'
  };
}

export interface DeleteTaskTool extends ToolCall {
  intent: 'delete_task';
  parameters: {
    task_id: string;
    reason?: string;
  };
}
