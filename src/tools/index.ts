// src/tools/index.ts

import { NotionClient } from '../clients/notion';
import { isCreateProjectTool, isCreateTaskTool, isDoneTool, isGetTasksTool } from '../types/toolGuards';
import type { AgentTool, ProjectToolResult, TaskToolResult, ToolResult } from '../types/tools';
import { UserInputHandler } from './user-input-handler';

export class ToolExecutor {
  private notionClient: NotionClient;
  private userInputHandler: UserInputHandler;
  private debugMode: boolean;

  constructor(debugMode: boolean = false) {
    this.notionClient = new NotionClient();
    this.userInputHandler = new UserInputHandler();
    this.debugMode = debugMode;
  }

  async execute(tool: AgentTool): Promise<ToolResult> {
    if (this.debugMode) {
      console.log(`🔧 [DEBUG] Executing tool: ${tool.function.name}`);
      console.log(`📝 [DEBUG] Parameters:`, JSON.stringify(tool.function.parameters, null, 2));
    }

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

        case 'get_tasks': {
          const result = await this.executeGetTasks(tool);
          return result;
        }

        case 'done': {
          const result = await this.executeDone(tool);
          return result;
        }

        default:
          throw new Error(`Unknown tool: ${(tool as AgentTool).function.name}`);
      }
    } catch (error) {
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

    if (this.debugMode) {
      console.log(`✅ [DEBUG] Task created: ${result.title}`);
      console.log(`🔗 [DEBUG] Notion URL: ${result.notion_url || 'N/A'}`);
    }

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

    if (this.debugMode) {
      console.log(`✅ [DEBUG] Project created: ${result.name}`);
      console.log(`🔗 [DEBUG] Notion URL: ${result.notion_url || 'N/A'}`);
    }

    return {
      success: true,
      message: `Project "${result.name}" created successfully`,
      data: result,
      timestamp: new Date(),
    };
  }

  private async executeGetTasks(tool: AgentTool): Promise<ToolResult> {
    if (!isGetTasksTool(tool)) {
      throw new Error('Invalid tool type for getTasks');
    }

    const result = await this.notionClient.getTasks(tool);

    if (this.debugMode) {
      console.log(`✅ [DEBUG] Tasks retrieved: ${result.tasks.length} found`);
      if (result.has_more) {
        console.log(`📄 [DEBUG] More results available`);
      }
      // 詳細なタスク情報をデバッグ出力
      result.tasks.forEach((task, index) => {
        console.log(`   [DEBUG] ${index + 1}. ${task.title} (${task.task_type}) - ${task.status}`);
      });
    }

    return {
      success: true,
      message: `Retrieved ${result.tasks.length} tasks`,
      data: result,
      timestamp: new Date(),
    };
  }

  private async executeDone(tool: AgentTool): Promise<ToolResult> {
    if (!isDoneTool(tool)) {
      throw new Error('Invalid tool type for done');
    }

    const finalAnswer = tool.function.parameters.final_answer;
    
    if (this.debugMode) {
      console.log(`✅ [DEBUG] Conversation completed with final answer`);
    }
    
    return {
      success: true,
      message: 'Conversation completed successfully',
      data: {
        final_answer: finalAnswer,
        conversation_complete: true,
      },
      timestamp: new Date(),
    };
  }

  // Notion接続テスト
  async testConnection(): Promise<boolean> {
    return await this.notionClient.testConnection();
  }
}
