import { Client } from '@notionhq/client';
import type { UpdatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import type { ToolCall } from '@shochan_ai/core';
import {
  buildProjectCreatePageParams,
  buildTaskCreatePageParams,
  buildTaskUpdatePageParams,
} from './notionUtils';
import { NotionQueryBuilder } from '@shochan_ai/core';
import { NotionTaskParser } from '@shochan_ai/core';
import {
  isCreateProjectTool,
  isCreateTaskTool,
  isGetTasksTool,
  isDeleteTaskTool,
  isUpdateTaskTool,
  isGetTaskDetailsTool,
} from '@shochan_ai/core';

export class NotionClient {
  private client: Client;
  private tasksDbId: string;
  private projectsDbId: string;
  private queryBuilder: NotionQueryBuilder;
  private taskParser: NotionTaskParser;

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
    this.taskParser = new NotionTaskParser();
  }

  async createTask(tool: ToolCall) {
    if (!isCreateTaskTool(tool)) {
      throw new Error('Invalid tool call');
    }

    const { title, description, task_type, scheduled_date, project_id } = tool.parameters;

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

      if (!this.taskParser.isFullPageResponse(response)) {
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

  async createProject(tool: ToolCall) {
    if (!isCreateProjectTool(tool)) {
      throw new Error('Invalid tool call');
    }

    const { name, description, importance, action_plan } = tool.parameters;

    try {
      const params = buildProjectCreatePageParams({
        databaseId: this.projectsDbId,
        name,
        description,
        importance,
        action_plan,
      });

      const response = await this.client.pages.create(params);

      if (!this.taskParser.isFullPageResponse(response)) {
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

  async getTasks(tool: ToolCall) {
    if (!isGetTasksTool(tool)) {
      throw new Error('Invalid tool call');
    }

    const {
      task_type,
      project_id,
      search_title,
      limit = 10,
      include_completed = false,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = tool.parameters;

    try {
      console.log(`🔍 [NOTION] Getting tasks with filters:`, tool.parameters);

      const query = this.queryBuilder.buildTaskQuery({
        task_type,
        project_id,
        search_title,
        include_completed,
        sort_by,
        sort_order,
      });

      const response = await this.client.databases.query({
        database_id: this.tasksDbId,
        ...query,
        page_size: Math.min(limit, 100), // Notion API limit
      });

      const tasks = await this.taskParser.parseTasksFromNotionResponse(response.results);

      console.log(`✅ [NOTION] Found ${tasks.length} tasks`);

      return {
        tasks,
        total_count: tasks.length,
        has_more: response.has_more,
        query_parameters: tool.parameters,
      };
    } catch (error) {
      console.error('❌ [NOTION] Get tasks failed:', error);
      throw new Error(
        `Failed to get tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async deleteTask(tool: ToolCall) {
    if (!isDeleteTaskTool(tool)) {
      throw new Error('Invalid tool call');
    }

    const { task_id } = tool.parameters;

    try {
      const response = await this.client.pages.update({
        page_id: task_id,
        archived: true,
      });

      return {
        task_id: response.id,
        deleted_at: new Date(),
        archived: true,
      };
    } catch (error) {
      console.error('Notion API error:', error);
      throw new Error(
        `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async updateTask(tool: ToolCall) {
    if (!isUpdateTaskTool(tool)) {
      throw new Error('Invalid tool call');
    }

    const { task_id, title, task_type, scheduled_date, project_id, is_archived } = tool.parameters;

    try {
      console.log(`🔄 [NOTION] Updating task ${task_id} with:`, tool.parameters);

      const params = buildTaskUpdatePageParams({
        pageId: task_id,
        title,
        task_type,
        scheduled_date,
        project_id,
        is_archived,
      });

      const response = await this.client.pages.update(params as UpdatePageParameters);

      if (!this.taskParser.isFullPageResponse(response)) {
        throw new Error(
          'Notion returned a partial page response. Ensure the integration has access to the page/database.'
        );
      }

      console.log(`✅ [NOTION] Task ${task_id} updated successfully`);

      return {
        task_id: response.id,
        updated_at: new Date(response.last_edited_time),
        notion_url: response.url,
        updated_properties: {
          title,
          task_type,
          scheduled_date,
          project_id,
          is_archived,
        },
      };
    } catch (error) {
      console.error('❌ [NOTION] Update task failed:', error);
      throw new Error(
        `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getTaskDetails(tool: ToolCall) {
    if (!isGetTaskDetailsTool(tool)) {
      throw new Error('Invalid tool call');
    }

    const { task_id } = tool.parameters;

    try {
      console.log(`🔍 [NOTION] Getting task details for ${task_id}`);

      const pageResponse = await this.client.pages.retrieve({
        page_id: task_id,
      });

      if (!this.taskParser.isFullPageResponse(pageResponse)) {
        throw new Error(
          'Notion returned a partial page response. Ensure the integration has access to the page/database.'
        );
      }

      const task = this.taskParser.parseTaskFromNotionPage(pageResponse);

      try {
        console.log(`🔍 [NOTION] Getting page content for ${task_id}`);
        const blocksResponse = await this.client.blocks.children.list({
          block_id: task_id,
          page_size: 100,
        });

        const content = this.taskParser.parseContentFromBlocks(blocksResponse.results);
        task.content = content;

        console.log(`✅ [NOTION] Task details and content retrieved successfully for ${task_id}`);
      } catch (contentError) {
        console.warn(`⚠️ [NOTION] Could not retrieve content for ${task_id}:`, contentError);
        task.content = undefined;
      }

      return task;
    } catch (error) {
      console.error('❌ [NOTION] Get task details failed:', error);

      if (error instanceof Error && error.message.includes('Could not find page')) {
        throw new Error(`Task with ID ${task_id} not found`);
      }

      if (error instanceof Error && error.message.includes('unauthorized')) {
        throw new Error(`Access denied to task ${task_id}. Check integration permissions.`);
      }

      throw new Error(
        `Failed to get task details: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

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
