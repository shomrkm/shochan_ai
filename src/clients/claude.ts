import Anthropic from '@anthropic-ai/sdk';
import type { AgentTool } from '../types/tools';

export class ClaudeClient {
  private client: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateToolCall(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Anthropic.MessageParam[] = []
  ): Promise<AgentTool | null> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
      const messages: Anthropic.MessageParam[] = [
        ...conversationHistory,
        {
          role: 'user',
          content: userMessage,
        },
      ];

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: [
          {
            name: 'create_task',
            description: 'Create a new task in the GTD system',
            input_schema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Task title' },
                description: { type: 'string', description: 'Task description' },
                task_type: {
                  type: 'string',
                  enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin'],
                  description: 'Type of task in GTD system',
                },
                scheduled_date: { type: 'string', description: 'Scheduled date in ISO format' },
                project_id: { type: 'string', description: 'Related project ID' },
              },
              required: ['title', 'description', 'task_type'],
            },
          },
          {
            name: 'user_input',
            description:
              'Request input from user when more information is needed to create task/project. Use this when you need clarification, more details, or confirmation from the user.',
            input_schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description:
                    'Clear message explaining what information you need from the user and why',
                },
                context: {
                  type: 'string',
                  description: 'Context of what you are trying to accomplish',
                },
              },
              required: ['message', 'context'],
            },
          },
          {
            name: 'create_project',
            description: 'Create a new project',
            input_schema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Project name' },
                description: { type: 'string', description: 'Project description' },
                importance: {
                  type: 'string',
                  enum: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'],
                  description: 'Project importance level',
                },
                action_plan: { type: 'string', description: 'Action plan' },
              },
              required: ['name', 'description', 'importance'],
            },
          },
          {
            name: 'get_tasks',
            description: 'Retrieve tasks with optional filtering and sorting',
            input_schema: {
              type: 'object',
              properties: {
                task_type: {
                  type: 'string',
                  enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin'],
                  description: 'Filter by task type',
                },
                project_id: {
                  type: 'string',
                  description: 'Filter by project ID',
                },
                limit: {
                  type: 'number',
                  minimum: 1,
                  maximum: 100,
                  description: 'Maximum number of tasks to return (default: 10)',
                },
                include_completed: {
                  type: 'boolean',
                  description: 'Whether to include completed tasks (default: false)',
                },
                sort_by: {
                  type: 'string',
                  enum: ['created_at', 'updated_at', 'scheduled_date'],
                  description: 'Field to sort by (default: created_at)',
                },
                sort_order: {
                  type: 'string',
                  enum: ['asc', 'desc'],
                  description: 'Sort order (default: desc)',
                },
              },
              required: [],
            },
          },
          {
            name: 'done',
            description: 'Complete conversation with natural response',
            input_schema: {
              type: 'object',
              properties: {
                final_answer: {
                  type: 'string',
                  description: 'Natural language response to user',
                },
              },
              required: ['final_answer'],
            },
          },
          {
            name: 'display_result',
            description: 'Display information, results, or messages to the user. Use this to show task results, lists, or any user-facing information based on the XML context.',
            input_schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Natural language message to display to the user. Can include formatting, lists, and contextual information from previous tool results.',
                },
                message_type: {
                  type: 'string',
                  enum: ['success', 'error', 'info', 'warning'],
                  description: 'Type of message for appropriate styling and user feedback',
                  default: 'info',
                },
              },
              required: ['message'],
            },
          },
        ],
      });

      // ツール呼び出しを抽出
      const toolUse = response.content.find((content) => content.type === 'tool_use');

      if (toolUse && toolUse.type === 'tool_use') {
        const agentTool = {
          function: {
            name: toolUse.name,
            parameters: toolUse.input as Record<string, unknown>,
          },
        } as AgentTool;
        
        return agentTool;
      }

        return null;
      } catch (error) {
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`🔄 Claude API error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        
        console.error('Claude API error:', error);
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded for Claude API');
  }

  private isRetryableError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      // Retry on 429 (rate limit), 529 (overloaded), 500, 502, 503, 504
      return [429, 500, 502, 503, 504, 529].includes(status);
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Anthropic.MessageParam[] = []
  ): Promise<string> {
    const maxRetries = 3;
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
      const messages: Anthropic.MessageParam[] = [
        ...conversationHistory,
        {
          role: 'user',
          content: userMessage,
        },
      ];

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      const textContent = response.content.find((content) => content.type === 'text');

        return textContent?.type === 'text' ? textContent.text : '';
      } catch (error) {
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`🔄 Claude API error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        
        console.error('Claude API error:', error);
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded for Claude API');
  }
}
