export interface CreateTaskTool {
  intent: 'create_task';
  parameters: {
    title: string;
    description: string;
    task_type: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
    scheduled_date?: string; // ISO format date string
    project_id?: string;
  };
}

export interface CreateProjectTool {
  intent: 'create_project';
  parameters: {
    name: string;
    description: string;
    importance: '⭐' | '⭐⭐' | '⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐⭐⭐';
    action_plan?: string;
  };
}

export interface GetTasksTool {
  intent: 'get_tasks';
  parameters: {
    task_type?: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
    project_id?: string;
    search_title?: string; // Search tasks by title/name
    limit?: number; // Default: 10, Max: 100
    include_completed?: boolean; // Default: false
    sort_by?: 'created_at' | 'updated_at' | 'scheduled_date';
    sort_order?: 'asc' | 'desc'; // Default: 'desc'
  };
}

export interface DeleteTaskTool {
  intent: 'delete_task';
  parameters: {
    task_id: string;
    reason?: string;
  };
}

export interface UpdateTaskTool {
  intent: 'update_task';
  parameters: {
    task_id: string;
    title?: string;
    task_type?: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
    scheduled_date?: string | null;
    project_id?: string | null;
    is_archived?: boolean;
  };
}

export interface GetTaskDetailsTool {
  intent: 'get_task_details';
  parameters: {
    task_id: string;
  };
}

export interface RequestMoreInformationTool {
  intent: 'request_more_information';
  parameters: {
    message: string;
  };
}

export interface DoneForNowTool {
  intent: 'done_for_now';
  parameters: {
    message: string;
  };
}

/**
 * Union type of all available tool calls.
 * TypeScript will automatically narrow the type based on the intent field.
 */
export type ToolCall =
  | CreateTaskTool
  | CreateProjectTool
  | GetTasksTool
  | DeleteTaskTool
  | UpdateTaskTool
  | GetTaskDetailsTool
  | RequestMoreInformationTool
  | DoneForNowTool;
