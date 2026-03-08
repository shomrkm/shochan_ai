export interface TaskInfo {
  task_id: string;
  title: string;
  description: string;
  task_type: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin';
  scheduled_date?: string;
  project_id?: string;
  project_name?: string;
  created_at: Date;
  updated_at: Date;
  notion_url?: string;
  status: 'active' | 'completed' | 'archived';
  content?: string;
}

export interface ProjectInfo {
  project_id: string;
  name: string;
  description?: string;
  importance?: string;
  status?: string;
  action_plan?: string;
  notion_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectDetails {
  project_id: string;
  name: string;
  description?: string;
  importance?: string;
  status?: string;
  action_plan?: string;
  notion_url?: string;
  page_content?: string;
  related_tasks: TaskInfo[];
  created_at: Date;
  updated_at: Date;
}
