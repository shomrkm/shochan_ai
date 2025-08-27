import { Client } from '@notionhq/client';
import type {
  CreatePageResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import type {
  CreateProjectTool,
  CreateTaskTool,
  GetTasksTool,
  ProjectCreationResult,
  TaskCreationResult,
  TaskInfo,
  TaskQueryResult,
} from '../types/tools';
import { buildProjectCreatePageParams, buildTaskCreatePageParams } from '../utils/notionUtils';
import { NotionQueryBuilder } from './notion-query-builder';

export class NotionClient {
  private client: Client;
  private tasksDbId: string;
  private projectsDbId: string;
  private queryBuilder: NotionQueryBuilder;

  constructor() {
    if (!process.env.NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY is not set in environment variables');
    }
    if (!process.env.NOTION_TASKS_DATABASE_ID) {
      throw new Error('NOTION_TASKS_DATABASE_ID is not set in environment variables');
    }
    if (!process.env.NOTION_PROJECTS_DATABASE_ID) {
      throw new Error('NOTION_PROJECTS_DATABASE_ID is not set in environment variables');
    }

    this.client = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    this.tasksDbId = process.env.NOTION_TASKS_DATABASE_ID;
    this.projectsDbId = process.env.NOTION_PROJECTS_DATABASE_ID;
    this.queryBuilder = new NotionQueryBuilder();
  }

  async createTask(tool: CreateTaskTool): Promise<TaskCreationResult> {
    const { title, description, task_type, scheduled_date, project_id } = tool.function.parameters;

    try {
      const params = buildTaskCreatePageParams({
        databaseId: this.tasksDbId,
        title,
        description,
        task_type,
        scheduled_date,
        project_id,
      });

      const response = await this.client.pages.create(params);

      if (!isFullPageResponse(response)) {
        throw new Error(
          'Notion returned a partial page response. Ensure the integration has access to the page/database.'
        );
      }

      return {
        task_id: response.id,
        title,
        description,
        task_type,
        created_at: new Date(response.created_time),
        notion_url: response.url,
      };
    } catch (error) {
      console.error('Notion API error:', error);
      throw new Error(
        `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async createProject(tool: CreateProjectTool): Promise<ProjectCreationResult> {
    const { name, description, importance, action_plan } = tool.function.parameters;

    try {
      const params = buildProjectCreatePageParams({
        databaseId: this.projectsDbId,
        name,
        description,
        importance,
        action_plan,
      });

      const response = await this.client.pages.create(params);

      if (!isFullPageResponse(response)) {
        throw new Error(
          'Notion returned a partial page response. Ensure the integration has access to the page/database.'
        );
      }

      return {
        project_id: response.id,
        name,
        description,
        importance,
        created_at: new Date(response.created_time),
        notion_url: response.url,
      };
    } catch (error) {
      console.error('Notion API error:', error);
      throw new Error(
        `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // データベース接続テスト用
  async testConnection(): Promise<boolean> {
    try {
      await this.client.databases.retrieve({ database_id: this.tasksDbId });
      await this.client.databases.retrieve({ database_id: this.projectsDbId });
      return true;
    } catch (error) {
      console.error('Notion connection test failed:', error);
      return false;
    }
  }

  // ===== Phase A: get_tasks Method =====

  /**
   * Get tasks with optional filtering
   */
  async getTasks(tool: GetTasksTool): Promise<TaskQueryResult> {
    const { 
      task_type, 
      project_id, 
      limit = 10, 
      include_completed = false,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = tool.function.parameters;

    try {
      console.log(`🔍 [NOTION] Getting tasks with filters:`, tool.function.parameters);
      
      const query = this.queryBuilder.buildTaskQuery({
        task_type,
        project_id,
        include_completed,
        sort_by,
        sort_order
      });

      const response = await this.client.databases.query({
        database_id: this.tasksDbId,
        ...query,
        page_size: Math.min(limit, 100) // Notion API limit
      });

      const tasks = await this.parseTasksFromNotionResponse(response.results);
      
      console.log(`✅ [NOTION] Found ${tasks.length} tasks`);
      
      return {
        tasks,
        total_count: tasks.length,
        has_more: response.has_more,
        query_parameters: tool.function.parameters
      };
    } catch (error) {
      console.error('❌ [NOTION] Get tasks failed:', error);
      throw new Error(`Failed to get tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===== Private Helper Methods for get_tasks =====

  /**
   * Parse tasks from Notion response
   */
  private async parseTasksFromNotionResponse(results: any[]): Promise<TaskInfo[]> {
    const tasks: TaskInfo[] = [];
    
    for (const result of results) {
      if (!isFullPageResponse(result)) continue;
      
      try {
        const task = this.parseTaskFromNotionPage(result);
        tasks.push(task);
      } catch (error) {
        console.warn(`Failed to parse task ${result.id}:`, error);
        // Continue processing other tasks
      }
    }
    
    return tasks;
  }

  /**
   * Parse single task from Notion page
   */
  private parseTaskFromNotionPage(page: PageObjectResponse): TaskInfo {
    const properties = page.properties;
    
    // Extract basic task information
    const title = this.extractTextFromProperty(properties, 'Name') || 'Untitled Task';
    const description = this.extractTextFromProperty(properties, 'Description') || '';
    const task_type = this.extractSelectFromProperty(properties, 'task_type') || 'Next Actions';
    
    // Extract dates
    const scheduled_date = this.extractDateFromProperty(properties, 'due_date');
    
    // Extract project information
    const project_id = this.extractRelationFromProperty(properties, 'project');
    const project_name = this.extractTextFromProperty(properties, 'Project Name'); // If available
    
    // Extract status from formula property
    const completed = this.extractFormulaFromProperty(properties, 'is_completed') || false;
    
    return {
      task_id: page.id,
      title,
      description,
      task_type: task_type as TaskInfo['task_type'],
      scheduled_date,
      project_id,
      project_name,
      created_at: new Date(page.created_time),
      updated_at: new Date(page.last_edited_time),
      notion_url: page.url,
      status: completed ? 'completed' : 'active'
    };
  }

  // ===== Utility Methods (Reusable for future tools) =====
  
  private extractTextFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop) return undefined;
    
    if (prop.type === 'title' && prop.title.length > 0) {
      return prop.title[0].plain_text;
    }
    if (prop.type === 'rich_text' && prop.rich_text.length > 0) {
      return prop.rich_text[0].plain_text;
    }
    
    return undefined;
  }
  
  private extractSelectFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'select') return undefined;
    
    return prop.select?.name;
  }
  
  private extractDateFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'date') return undefined;
    
    return prop.date?.start;
  }
  
  private extractRelationFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'relation') return undefined;
    
    return prop.relation.length > 0 ? prop.relation[0].id : undefined;
  }
  
  private extractFormulaFromProperty(properties: any, propertyName: string): boolean {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'formula') return false;
    
    return prop.formula?.boolean || false;
  }
}

function isFullPageResponse(response: CreatePageResponse): response is PageObjectResponse {
  return (
    (response as any).object === 'page' &&
    'created_time' in response &&
    (('url' in response) as any)
  );
}
