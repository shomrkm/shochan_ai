import { Client } from '@notionhq/client';
import type {
  CreatePageResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import type {
  CreateProjectTool,
  CreateTaskTool,
  ProjectCreationResult,
  TaskCreationResult,
} from '../types/tools';
import { buildProjectCreatePageParams, buildTaskCreatePageParams } from '../utils/notionUtils';

export class NotionClient {
  private client: Client;
  private tasksDbId: string;
  private projectsDbId: string;

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
}

function isFullPageResponse(response: CreatePageResponse): response is PageObjectResponse {
  return (
    (response as any).object === 'page' &&
    'created_time' in response &&
    (('url' in response) as any)
  );
}
