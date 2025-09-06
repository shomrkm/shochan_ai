import type { EnhancedToolExecutor } from '../tools/enhanced-tool-executor';
import type { EnrichedToolResult } from '../tools/tool-execution-context';
import type { ProcessMessageResult } from '../types/conversation-types';
import { isEnrichedUserInputToolResult } from '../types/toolGuards';

/**
 * Manages all display and logging functionality for the conversation
 */
export class DisplayManager {
  /**
   * Log current iteration progress
   */
  logIteration(current: number, max: number): void {
    console.log(`\n🔄 Conversation iteration ${current}/${max}`);
  }

  /**
   * Display simplified execution completion message
   */
  displayExecutionStats(toolExecutor: EnhancedToolExecutor, currentTraceId: string | null): void {
    console.log('\n✅ Tool execution completed successfully');
    if (currentTraceId) {
      console.log(`🔍 Trace ID: ${currentTraceId}`);
    }
    console.log('');
  }

  /**
   * Display enhanced information about question processing
   */
  displayQuestionProcessingInfo(result: ProcessMessageResult): void {
    if (!this.hasCalledTool(result)) return;

    if (isEnrichedUserInputToolResult(result.toolResult)) {
      console.log(`⚡ Question processing took ${result.toolResult.executionTimeMs}ms`);

      if (result.toolResult.inputValidation?.warnings.length) {
        console.log(`⚠️ Input warnings: ${result.toolResult.inputValidation.warnings.join(', ')}`);
      }

      if (result.toolResult.outputValidation?.warnings.length) {
        console.log(`⚠️ Output warnings: ${result.toolResult.outputValidation.warnings.join(', ')}`);
      }

      if (result.toolResult.metadata.retryCount && result.toolResult.metadata.retryCount > 0) {
        console.log(`🔄 Required ${result.toolResult.metadata.retryCount} retries`);
      }
    }
  }

  /**
   * Display enhanced error information for question processing
   */
  displayQuestionErrorInfo(result: ProcessMessageResult): void {
    if (!this.hasCalledTool(result)) return;

    if (result.toolResult.error) {
      console.log(
        `🔍 Error details: ${result.toolResult.error.code} - ${result.toolResult.error.message}`
      );
      if (result.toolResult.error.suggestedAction) {
        console.log(`💡 Suggestion: ${result.toolResult.error.suggestedAction}`);
      }
    } else {
      console.log(`🔍 Basic error: ${result.toolResult.message}`);
    }
  }

  /**
   * Display initialization message
   */
  displayInitialization(): void {
    console.log('🎯 Starting interactive conversation...\n');
  }

  /**
   * Display history cleared message
   */
  displayHistoryCleared(): void {
    console.log('🧹 Conversation history and collected info cleared');
  }

  /**
   * Display conversation completion message
   */
  displayConversationCompleted(iterations: number, maxIterations: number): void {
    if (iterations >= maxIterations) {
      console.log('⚠️  Maximum iterations reached. Conversation ended.');
    }
    console.log('🏁 Conversation completed!\n');
  }

  /**
   * Display user message
   */
  displayUserMessage(message: string): void {
    console.log(`\n👤 User: ${message}`);
  }

  /**
   * Display agent response
   */
  displayAgentResponse(response: string): void {
    console.log(`🤖 Claude: ${response}`);
  }

  /**
   * Display tool call information
   */
  displayToolCall(toolName: string): void {
    console.log(`🤖 Claude generated tool call: ${toolName}`);
  }

  /**
   * Display timeout warning for ask_question tool
   */
  displayQuestionTimeout(): void {
    console.log('⏰ You have 10 minutes to respond to the question');
  }

  /**
   * Check if the result contains a tool call
   */
  private hasCalledTool(
    result: ProcessMessageResult
  ): result is { toolCall: any; toolResult: EnrichedToolResult } {
    return 'toolCall' in result && 'toolResult' in result;
  }
}
