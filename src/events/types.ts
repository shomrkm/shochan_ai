/**
 * Event Types for YAML-in-XML Context Management
 * Following 12-factor agents Factor 3 principles
 */

export type EventType =
  // User actions
  | 'user_message'
  | 'user_input_request'
  | 'user_input_response'

  // Tool executions
  | 'create_task'
  | 'create_project'
  | 'user_input'
  | 'get_tasks'

  // Tool results
  | 'create_task_result'
  | 'create_project_result'
  | 'user_input_result'
  | 'get_tasks_result'

  // Agent responses
  | 'agent_response'
  | 'conversation_end'
  | 'error';

// Event data interfaces matching current project schema
export interface UserMessageData {
  message: string;
  timestamp: string;
}

export interface CreateTaskData {
  title: string;
  description: string;
  task_type: 'Today' | 'Next Actions' | 'Someday / Maybe' | 'Wait for' | 'Routin'; // Actual project schema
  scheduled_date?: string;
  project_id?: string;
}

export interface CreateTaskResultData {
  success: boolean;
  task_id?: string;
  title?: string;
  description?: string;
  task_type?: string;
  created_at?: string;
  notion_url?: string;
  scheduled_date?: string;
  project_id?: string;
  error?: string;
  execution_time: number;
}

export interface CreateProjectData {
  name: string;
  description: string;
  importance: '⭐' | '⭐⭐' | '⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐⭐⭐'; // Actual star format
  action_plan?: string;
}

export interface CreateProjectResultData {
  success: boolean;
  project_id?: string;
  name?: string;
  description?: string;
  importance?: string;
  created_at?: string;
  notion_url?: string;
  action_plan?: string;
  error?: string;
  execution_time: number;
}

export interface UserInputData {
  message: string;
  context: string;
}

export interface UserInputResultData {
  success: boolean;
  user_response?: string;
  error?: string;
  execution_time: number;
}

export interface AgentResponseData {
  message: string;
  timestamp: string;
}

export interface ErrorData {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface GetTasksData {
  task_type?: string;
  project_id?: string;
  limit?: number;
  include_completed?: boolean;
  sort_by?: string;
  sort_order?: string;
}

export interface GetTasksResultData {
  success: boolean;
  query_parameters: Record<string, unknown>;
  tasks?: Array<{
    task_id: string;
    title: string;
    description: string;
    task_type: string;
    scheduled_date?: string;
    project_id?: string;
    project_name?: string;
    created_at: string;
    updated_at: string;
    notion_url?: string;
    status: string;
  }>;
  total_count?: number;
  has_more?: boolean;
  error?: string;
  execution_time: number;
}

// Event type to data mapping for strict type safety
export interface EventTypeDataMap {
  user_message: UserMessageData;
  user_input_request: UserMessageData; // Can reuse UserMessageData structure
  user_input_response: UserMessageData; // Can reuse UserMessageData structure

  create_task: CreateTaskData;
  create_project: CreateProjectData;
  user_input: UserInputData;
  get_tasks: GetTasksData; // Phase A addition

  create_task_result: CreateTaskResultData;
  create_project_result: CreateProjectResultData;
  user_input_result: UserInputResultData;
  get_tasks_result: GetTasksResultData; // Phase A addition

  agent_response: AgentResponseData;
  conversation_end: AgentResponseData; // Can reuse AgentResponseData structure
  error: ErrorData;
}

// Union type for all event data (derived from mapping)
export type EventData = EventTypeDataMap[keyof EventTypeDataMap] | Record<string, any> | string;
