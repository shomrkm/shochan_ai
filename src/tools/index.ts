// src/tools/index.ts
import { AgentTool, ToolResult, TaskToolResult, ProjectToolResult, CreateTaskTool, CreateProjectTool, QuestionResult, AskQuestionTool } from '../types/tools';
import { NotionClient } from '../clients/notion';
import { QuestionHandler } from './question-handler';

export class ToolExecutor {
  private notionClient: NotionClient;
  private questionHandler: QuestionHandler;

  constructor() {
    this.notionClient = new NotionClient();
    this.questionHandler = new QuestionHandler();
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

        case 'ask_question': {
          if(!isAskQuestionTool(tool)) {
            throw new Error('Invalid tool type for askQuestion');
          }
          const result = await this.questionHandler.execute(tool);
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

// Type guards
function isCreateTaskTool(tool: AgentTool): tool is CreateTaskTool {
  return tool.function.name === 'create_task';
}

function isCreateProjectTool(tool: AgentTool): tool is CreateProjectTool {
  return tool.function.name === 'create_project';
}

function isAskQuestionTool(tool: AgentTool): tool is AskQuestionTool {
  return tool.function.name === 'ask_question';
}
