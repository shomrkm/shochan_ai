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
    limit?: number; // Default: 10, Max: 100
    include_completed?: boolean; // Default: false
    sort_by?: 'created_at' | 'updated_at' | 'scheduled_date';
    sort_order?: 'asc' | 'desc'; // Default: 'desc'
  };
}
