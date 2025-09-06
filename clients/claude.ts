import Anthropic from '@anthropic-ai/sdk';
import type { ToolCall } from '../src/types/tools';

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
    conversationHistory: Anthropic.MessageParam[] = [],
    tools: Anthropic.Tool[] = []
  ): Promise<ToolCall | null> {
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
          tools,
        });

        const toolUse = response.content.find((content) => content.type === 'tool_use');
        if(!toolUse || toolUse.type !== 'tool_use') {
          return null;
        }

        return {
            intent: toolUse.name,
            parameters: toolUse.input as Record<string, unknown>,
        }
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
}
