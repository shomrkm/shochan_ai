import { Client } from '@notionhq/client';
import type { UpdatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import type { ProjectDetails, ProjectInfo, ToolCall } from '@shochan_ai/core';
import {
  isCreateProjectTool,
  isCreateTaskTool,
  isDeleteTaskTool,
  isGetProjectDetailsTool,
  isGetProjectsTool,
  isGetTaskDetailsTool,
  isGetTasksTool,
  isUpdateTaskTool,
  NotionQueryBuilder,
  NotionTaskParser,
} from '@shochan_ai/core';
import {
  buildProjectCreatePageParams,
  buildTaskCreatePageParams,
  buildTaskUpdatePageParams,
  parseProjectFromNotionPage,
} from './notionUtils';

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

  async getProjects(tool: ToolCall): Promise<{
    projects: ProjectInfo[];
    total_count: number;
    has_more: boolean;
    query_parameters: ToolCall['parameters'];
  }> {
    if (!isGetProjectsTool(tool)) {
      throw new Error('Invalid tool call');
    }

    const { search_name, status, limit = 10 } = tool.parameters;

    try {
      console.log(`🔍 [NOTION] Getting projects with filters:`, tool.parameters);

      // Build filters
      type NotionFilter =
        | { property: string; title: { contains: string } }
        | { property: string; status: { equals: string } };

      const notionFilters: NotionFilter[] = [];

      if (search_name) {
        notionFilters.push({
          property: 'name',
          title: { contains: search_name },
        });
      }

      if (status) {
        notionFilters.push({
          property: 'status',
          status: { equals: status },
        });
      }

      const filter =
        notionFilters.length > 0
          ? notionFilters.length === 1
            ? notionFilters[0]
            : { and: notionFilters }
          : undefined;

      const response = await this.client.databases.query({
        database_id: this.projectsDbId,
        filter,
        page_size: Math.min(limit, 100), // Notion API limit
      });

      const projects: ProjectInfo[] = [];
      for (const result of response.results) {
        if (!this.taskParser.isFullPageResponse(result)) continue;
        try {
          const project = parseProjectFromNotionPage(result);
          projects.push(project);
        } catch (parseError) {
          console.warn(`Failed to parse project ${result.id}:`, parseError);
        }
      }

      console.log(`✅ [NOTION] Found ${projects.length} projects`);

      return {
        projects,
        total_count: projects.length,
        has_more: response.has_more,
        query_parameters: tool.parameters,
      };
    } catch (error) {
      console.error('❌ [NOTION] Get projects failed:', error);
      throw new Error(
        `Failed to get projects: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  async getProjectDetails(tool: ToolCall): Promise<ProjectDetails> {
    if (!isGetProjectDetailsTool(tool)) {
      throw new Error('Invalid tool call');
    }

    const { project_id } = tool.parameters;

    try {
      console.log(`🔍 [NOTION] Getting project details for ${project_id}`);

      const pageResponse = await this.client.pages.retrieve({
        page_id: project_id,
      });

      if (!this.taskParser.isFullPageResponse(pageResponse)) {
        throw new Error(
          'Notion returned a partial page response. Ensure the integration has access to the page/database.'
        );
      }

      const properties = pageResponse.properties;

      const name = this.extractTextFromProperty(properties, 'name') || 'Untitled Project';
      const description = this.extractTextFromProperty(properties, 'description');
      const importance = this.extractSelectFromProperty(properties, 'importance');
      const status = this.extractStatusFromProperty(properties, 'status');
      const action_plan = this.extractTextFromProperty(properties, 'action_plan');

      let page_content: string | undefined;
      try {
        console.log(`🔍 [NOTION] Getting page content for project ${project_id}`);
        const blocksResponse = await this.client.blocks.children.list({
          block_id: project_id,
          page_size: 100,
        });
        page_content = this.taskParser.parseContentFromBlocks(blocksResponse.results);
        console.log(`✅ [NOTION] Project page content retrieved for ${project_id}`);
      } catch (contentError) {
        console.warn(`⚠️ [NOTION] Could not retrieve page content for ${project_id}:`, contentError);
        page_content = undefined;
      }

      console.log(`🔍 [NOTION] Getting related tasks for project ${project_id}`);
      const tasksResponse = await this.client.databases.query({
        database_id: this.tasksDbId,
        filter: {
          property: 'project',
          relation: {
            contains: project_id,
          },
        },
        page_size: 100,
      });

      const related_tasks = await this.taskParser.parseTasksFromNotionResponse(
        tasksResponse.results
      );
      console.log(
        `✅ [NOTION] Found ${related_tasks.length} related tasks for project ${project_id}`
      );

      return {
        project_id: pageResponse.id,
        name,
        description,
        importance,
        status,
        action_plan,
        notion_url: pageResponse.url,
        page_content,
        related_tasks,
        created_at: new Date(pageResponse.created_time),
        updated_at: new Date(pageResponse.last_edited_time),
      };
    } catch (error) {
      console.error('❌ [NOTION] Get project details failed:', error);

      if (error instanceof Error && error.message.includes('Could not find page')) {
        throw new Error(`Project with ID ${project_id} not found`);
      }

      if (error instanceof Error && error.message.includes('unauthorized')) {
        throw new Error(`Access denied to project ${project_id}. Check integration permissions.`);
      }

      throw new Error(
        `Failed to get project details: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private extractTextFromProperty(
    properties: Record<string, unknown>,
    propertyName: string
  ): string | undefined {
    const prop = properties[propertyName];
    if (!prop || typeof prop !== 'object' || prop === null) return undefined;

    const propObj = prop as Record<string, unknown>;

    if (propObj.type === 'title' && Array.isArray(propObj.title) && propObj.title.length > 0) {
      const first = propObj.title[0] as { plain_text?: string };
      return first.plain_text;
    }
    if (
      propObj.type === 'rich_text' &&
      Array.isArray(propObj.rich_text) &&
      propObj.rich_text.length > 0
    ) {
      const first = propObj.rich_text[0] as { plain_text?: string };
      return first.plain_text;
    }

    return undefined;
  }

  private extractSelectFromProperty(
    properties: Record<string, unknown>,
    propertyName: string
  ): string | undefined {
    const prop = properties[propertyName];
    if (!prop || typeof prop !== 'object' || prop === null) return undefined;

    const propObj = prop as Record<string, unknown>;
    if (propObj.type !== 'select') return undefined;

    const select = propObj.select as { name?: string } | null;
    return select?.name;
  }

  private extractStatusFromProperty(
    properties: Record<string, unknown>,
    propertyName: string
  ): string | undefined {
    const prop = properties[propertyName];
    if (!prop || typeof prop !== 'object' || prop === null) return undefined;

    const propObj = prop as Record<string, unknown>;
    if (propObj.type !== 'status') return undefined;

    const status = propObj.status as { name?: string } | null;
    return status?.name;
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
