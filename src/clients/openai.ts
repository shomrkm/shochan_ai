import OpenAI from 'openai';
import type { ToolCall } from '../types/tools';

type InputMessage =
  | { role: 'user' | 'system' | 'developer'; content: string }
  | OpenAI.Responses.ResponseFunctionToolCall
  | { type: 'function_call_output'; call_id: string; output: string };

type Params = {
  systemPrompt: string;
  inputMessages: InputMessage[];
  tools?: OpenAI.Responses.FunctionTool[];
};

type GenerateToolCallResult = {
  toolCall: ToolCall | null;
  fullOutput: OpenAI.Responses.ResponseOutputItem[];
};

export class OpenAIClient {
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generates a tool call using OpenAI Responses API.
   *
   * @param systemPrompt - System instructions for the model
   * @param inputMessages - Array of input messages including user messages, tool calls, and tool outputs
   * @param tools - Array of available tools (function definitions)
   * @returns Tool call result and full response output
   */
  async generateToolCall({
    systemPrompt,
    inputMessages,
    tools = [],
  }: Params): Promise<GenerateToolCallResult> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.responses.create({
          model: 'gpt-4o',
          instructions: systemPrompt,
          input: inputMessages as OpenAI.Responses.ResponseInput,
          tools: tools.length > 0 ? tools : undefined,
        });

        // Responses API の output から function_call を抽出
        const functionCallItem = response.output.find(
          (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === 'function_call'
        );

        if (!functionCallItem) {
          return {
            toolCall: null,
            fullOutput: response.output,
          };
        }

        return {
          toolCall: {
            intent: functionCallItem.name,
            parameters: (typeof functionCallItem.arguments === 'string'
              ? JSON.parse(functionCallItem.arguments)
              : functionCallItem.arguments) as Record<string, unknown>,
          },
          fullOutput: response.output,
        };
      } catch (error) {
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = baseDelay * 2 ** (attempt - 1); // Exponential backoff
          console.log(
            `🔄 OpenAI API error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`
          );
          await this.sleep(delay);
          continue;
        }

        console.error('OpenAI API error:', error);
        throw error;
      }
    }

    throw new Error('Max retries exceeded for OpenAI API');
  }

  private isRetryableError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as unknown as { status: number }).status;
      // Retry on 429 (rate limit), 500, 502, 503, 504
      return [429, 500, 502, 503, 504].includes(status);
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
