import type { EnrichedToolResult } from '../tools/tool-execution-context';
import type { ProcessMessageResult } from '../types/conversation-types';
import type { PromptContext } from '../types/prompt-types';
import { isCreateProjectTool, isCreateTaskTool, isUserInputTool } from '../types/toolGuards';
import type { AgentTool } from '../types/tools';

/**
 * Manages conversation state, flow control, and stage transitions
 */
export class ConversationManager {
  private conversationStage: PromptContext['conversationStage'] = 'initial';
  private currentTraceId: string | null = null;
  private questionCount: number = 0;

  /**
   * Initialize a new conversation
   */
  initializeConversation(): void {
    this.conversationStage = 'initial';
    this.questionCount = 0;
    this.currentTraceId = `conversation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    console.log(`🔍 Starting trace: ${this.currentTraceId}`);
  }

  /**
   * Get current conversation stage
   */
  getConversationStage(): PromptContext['conversationStage'] {
    return this.conversationStage;
  }

  /**
   * Get current trace ID
   */
  getCurrentTraceId(): string | null {
    return this.currentTraceId;
  }

  /**
   * Get current question count
   */
  getQuestionCount(): number {
    return this.questionCount;
  }

  /**
   * Handle the result of processing a message and determine next action
   */
  handleConversationResult(
    result: ProcessMessageResult,
    collectedInfo: Record<string, string>
  ): { continue: boolean; nextMessage?: string } {
    if (!this.hasCalledTool(result)) {
      console.log('💬 Agent provided a response without tools.');
      return { continue: false };
    }

    if (isCreateTaskTool(result.toolCall) || isCreateProjectTool(result.toolCall)) {
      console.log('✅ Task/Project created successfully!');
      return { continue: false };
    }

    if (isUserInputTool(result.toolCall)) {
      return this.handleUserInputResult(result, collectedInfo);
    }

    return { continue: true };
  }

  /**
   * Handle user input tool result - much simpler now
   */
  private handleUserInputResult(
    result: ProcessMessageResult,
    _collectedInfo: Record<string, string>
  ): { continue: boolean; nextMessage?: string } {
    if (!this.hasCalledTool(result)) {
      return { continue: false };
    }

    this.questionCount++;

    if (this.isResultSuccessful(result) && this.getResultData(result)?.user_response) {
      const answer = this.getResultData(result).user_response;
      console.log('📝 User provided input, continuing conversation...');
      return { continue: true, nextMessage: answer };
    } else {
      console.log('❌ Failed to get user input, ending conversation.');
      return { continue: false };
    }
  }

  // Note: Stage inference is no longer needed since LLM handles everything

  /**
   * Reset conversation state
   */
  clearState(): void {
    this.conversationStage = 'initial';
    this.questionCount = 0;
    this.currentTraceId = null;
  }

  /**
   * Check if the result contains a tool call
   */
  private hasCalledTool(
    result: ProcessMessageResult
  ): result is { toolCall: AgentTool; toolResult: EnrichedToolResult } {
    return 'toolCall' in result && 'toolResult' in result;
  }

  /**
   * Safely access result data from ProcessMessageResult
   */
  private getResultData(result: ProcessMessageResult): any {
    if (!this.hasCalledTool(result)) return null;
    return result.toolResult.data;
  }

  /**
   * Check if the result was successful
   */
  private isResultSuccessful(result: ProcessMessageResult): boolean {
    if (!this.hasCalledTool(result)) return false;
    return result.toolResult.success;
  }
}
