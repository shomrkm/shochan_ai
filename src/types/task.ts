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
}
