import { Client } from '@notionhq/client';
import type { CreatePageResponse, PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { CreateTaskTool, CreateProjectTool, TaskCreationResult, ProjectCreationResult } from '../types/tool';

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
      const properties = this.buildTaskProperties({
        title,
        task_type,
        scheduled_date,
        project_id,
      });

      const response = await this.client.pages.create({
        parent: {
          database_id: this.tasksDbId,
        },
        properties,
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: description,
                  },
                },
              ],
            },
          },
        ],
      });

      if (!isFullPageResponse(response)) {
        throw new Error('Notion returned a partial page response. Ensure the integration has access to the page/database.');
      }

      return {
        task_id: response.id,
        title,
        created_at: new Date(response.created_time),
        notion_url: response.url,
      };
    } catch (error) {
      console.error('Notion API error:', error);
      throw new Error(`Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createProject(tool: CreateProjectTool): Promise<ProjectCreationResult> {
    const { name, description, importance, action_plan } = tool.function.parameters;

    try {
      const properties = this.buildProjectProperties({
        name,
        importance,
        action_plan,
      });

      const response = await this.client.pages.create({
        parent: {
          database_id: this.projectsDbId,
        },
        properties,
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: description,
                  },
                },
              ],
            },
          },
        ],
      });

      if (!isFullPageResponse(response)) {
        throw new Error('Notion returned a partial page response. Ensure the integration has access to the page/database.');
      }

      return {
        project_id: response.id,
        name,
        created_at: new Date(response.created_time),
        notion_url: response.url,
      };
    } catch (error) {
      console.error('Notion API error:', error);
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  private buildTaskProperties(args: {
    title: string;
    task_type: string;
    scheduled_date?: string;
    project_id?: string;
  }): Record<string, any> {
    const { title, task_type, scheduled_date, project_id } = args;

    const properties: Record<string, any> = {
      Name: {
        title: [
          {
            text: {
              content: title,
            },
          },
        ],
      },
      タスク種別: {
        select: {
          name: task_type,
        },
      },
    };

    if (scheduled_date) {
      properties['実施予定日'] = {
        date: {
          start: scheduled_date,
        },
      };
    }

    if (project_id) {
      properties['プロジェクト'] = {
        relation: [
          {
            id: project_id,
          },
        ],
      };
    }

    return properties;
  }

  private buildProjectProperties(args: {
    name: string;
    importance: string;
    action_plan?: string;
  }): Record<string, any> {
    const { name, importance, action_plan } = args;

    const properties: Record<string, any> = {
      名前: {
        title: [
          {
            text: {
              content: name,
            },
          },
        ],
      },
      重要度: {
        select: {
          name: importance,
        },
      },
      ステータス: {
        status: {
          name: 'Not started',
        },
      },
    };

    if (action_plan) {
      properties['アクションプラン'] = {
        rich_text: [
          {
            text: {
              content: action_plan,
            },
          },
        ],
      };
    }

    return properties;
  }
}

function isFullPageResponse(response: CreatePageResponse): response is PageObjectResponse {
  return (
    (response as any).object === 'page' &&
    'created_time' in response &&
    'url' in response as any
  );
}