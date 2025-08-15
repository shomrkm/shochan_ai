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
            name: 'ask_question',
            description: 'Ask user for additional information',
            input_schema: {
              type: 'object',
              properties: {
                question: { type: 'string', description: 'Question to ask' },
                context: { type: 'string', description: 'Context of the question' },
                question_type: {
                  type: 'string',
                  enum: ['clarification', 'missing_info', 'confirmation'],
                  description: 'Type of question',
                },
              },
              required: ['question', 'context', 'question_type'],
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
        ],
      });

      // ツール呼び出しを抽出
      const toolUse = response.content.find((content) => content.type === 'tool_use');

      if (toolUse && toolUse.type === 'tool_use') {
        return {
          function: {
            name: toolUse.name,
            parameters: toolUse.input as Record<string, unknown>,
          },
        } as AgentTool;
      }

      return null;
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Anthropic.MessageParam[] = []
  ): Promise<string> {
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
      console.error('Claude API error:', error);
      throw error;
    }
  }
}
