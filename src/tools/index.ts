// src/tools/index.ts

import { NotionClient } from '../clients/notion';
import { isCreateProjectTool, isCreateTaskTool } from '../types/toolGuards';
import type { AgentTool, ProjectToolResult, TaskToolResult, ToolResult } from '../types/tools';
import { UserInputHandler } from './user-input-handler';

export class ToolExecutor {
  private notionClient: NotionClient;
  private userInputHandler: UserInputHandler;

  constructor() {
    this.notionClient = new NotionClient();
    this.userInputHandler = new UserInputHandler();
  }

  async execute(tool: AgentTool): Promise<ToolResult> {
    console.log(`🔧 Executing tool: ${tool.function.name}`);
    console.log(`📝 Parameters:`, JSON.stringify(tool.function.parameters, null, 2));

    try {
      switch (tool.function.name) {
        case 'create_task': {
          const result = await this.executeCreateTask(tool);
          return result;
        }

        case 'create_project': {
          const result = await this.executeCreateProject(tool);
          return result;
        }

        case 'user_input': {
          const result = await this.userInputHandler.execute(tool);
          return result;
        }

        default:
          throw new Error(`Unknown tool: ${(tool as AgentTool).function.name}`);
      }
    } catch (error) {
      console.error(`❌ Tool execution failed:`, error);
      return {
        success: false,
        message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
    }
  }

  private async executeCreateTask(tool: AgentTool): Promise<TaskToolResult> {
    if (!isCreateTaskTool(tool)) {
      throw new Error('Invalid tool type for createTask');
    }

    const result = await this.notionClient.createTask(tool);

    console.log(`✅ Task created successfully: ${result.title}`);
    console.log(`🔗 Notion URL: ${result.notion_url || 'N/A'}`);

    return {
      success: true,
      message: `Task "${result.title}" created successfully`,
      data: result,
      timestamp: new Date(),
    };
  }

  private async executeCreateProject(tool: AgentTool): Promise<ProjectToolResult> {
    if (!isCreateProjectTool(tool)) {
      throw new Error('Invalid tool type for createProject');
    }

    const result = await this.notionClient.createProject(tool);

    console.log(`✅ Project created successfully: ${result.name}`);
    console.log(`🔗 Notion URL: ${result.notion_url || 'N/A'}`);

    return {
      success: true,
      message: `Project "${result.name}" created successfully`,
      data: result,
      timestamp: new Date(),
    };
  }

  // Notion接続テスト
  async testConnection(): Promise<boolean> {
    return await this.notionClient.testConnection();
  }
}
