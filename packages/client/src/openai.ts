import OpenAI from 'openai';
import { toolCallSchema, type ToolCall } from '@shochan_ai/core';

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

/**
 * Error thrown when OpenAI API returns an invalid tool call structure.
 */
export class ToolCallValidationError extends Error {
  constructor(
    public readonly rawToolCall: unknown,
    public readonly validationErrors: string[],
  ) {
    super(`Invalid tool call from OpenAI API: ${validationErrors.join(', ')}`);
    this.name = 'ToolCallValidationError';
  }
}

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
          return { toolCall: null, fullOutput: response.output };
        }

        const toolCall = this.parseToolCall(functionCallItem);
        return { toolCall, fullOutput: response.output };
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

  /**
   * Parses a function call from OpenAI API response and validates with zod schema.
   * @throws ToolCallValidationError if the tool call doesn't match expected schema
   */
  private parseToolCall(
    functionCall: OpenAI.Responses.ResponseFunctionToolCall
  ): ToolCall {
    const rawToolCall = {
      intent: functionCall.name,
      parameters: JSON.parse(functionCall.arguments),
    };

    const result = toolCallSchema.safeParse(rawToolCall);

    if (!result.success) {
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      throw new ToolCallValidationError(rawToolCall, errors);
    }

    return result.data;
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
