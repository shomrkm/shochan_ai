import type { ContextManager } from '../context/context-manager';
import type { EnhancedToolExecutor } from '../tools/enhanced-tool-executor';
import type { EnrichedToolResult } from '../tools/tool-execution-context';
import type { ProcessMessageResult } from '../types/conversation-types';
import { isEnrichedQuestionToolResult } from '../types/toolGuards';

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
   * Display context manager statistics
   */
  displayContextStats(contextManager: ContextManager): void {
    const stats = contextManager.getContextStats();
    console.log('\n📊 Context Window Statistics:');
    console.log(
      `📏 Tokens: ${stats.currentTokens}/${stats.maxTokens} (${stats.utilizationPercentage.toFixed(1)}% utilized)`
    );
    console.log(`💬 Messages: ${stats.messageCount}`);
    console.log(`🔄 Has Summary: ${stats.hasSummary ? 'Yes' : 'No'}`);
    console.log(`⚡ Available: ${stats.availableTokens} tokens`);
    console.log('');
  }

  /**
   * Display tool execution statistics
   */
  displayExecutionStats(toolExecutor: EnhancedToolExecutor, currentTraceId: string | null): void {
    const stats = toolExecutor.getExecutionStats();

    console.log('\n📊 Tool Execution Statistics:');
    console.log(`🎯 Active Contexts: ${stats.activeContexts}`);
    console.log(`📈 Total Executions: ${stats.totalExecutions}`);
    console.log(`🔄 Average Retry Rate: ${stats.averageRetryRate.toFixed(2)}`);

    if (stats.topExecutedTools.length > 0) {
      console.log('🏆 Top Executed Tools:');
      stats.topExecutedTools.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.toolName}: ${tool.count} times`);
      });
    }

    if (currentTraceId) {
      const traceContexts = toolExecutor.getContextsByTrace(currentTraceId);
      console.log(`🔍 Trace "${currentTraceId}": ${traceContexts.length} executions`);
    }

    console.log('');
  }

  /**
   * Display summary of enriched tool execution result
   */
  displayEnrichedResultSummary(enrichedResult: EnrichedToolResult): void {
    console.log('\n🔍 Tool Execution Summary:');
    console.log(`⚡ Execution Time: ${enrichedResult.executionTimeMs}ms`);
    console.log(`🔄 Retry Count: ${enrichedResult.metadata.retryCount}`);
    console.log(`📊 Status: ${enrichedResult.status}`);

    if (enrichedResult.inputValidation) {
      console.log(
        `✅ Input Validation: ${enrichedResult.inputValidation.isValid ? 'Passed' : 'Failed'}`
      );
    }

    if (enrichedResult.outputValidation) {
      console.log(
        `✅ Output Validation: ${enrichedResult.outputValidation.isValid ? 'Passed' : 'Failed'}`
      );
    }

    if (enrichedResult.error) {
      console.log(`❌ Error: ${enrichedResult.error.code} - ${enrichedResult.error.message}`);
      if (enrichedResult.error.suggestedAction) {
        console.log(`💡 Suggestion: ${enrichedResult.error.suggestedAction}`);
      }
    }

    console.log('');
  }

  /**
   * Display enhanced information about question processing
   */
  displayQuestionProcessingInfo(result: ProcessMessageResult): void {
    if (!this.hasCalledTool(result)) return;

    if (isEnrichedQuestionToolResult(result.toolResult)) {
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
  displayToolCall(toolName: string, conversationStage: string): void {
    console.log(`🤖 Claude generated tool call: ${toolName}`);
    console.log(`📋 Using prompt stage: ${conversationStage}`);
  }

  /**
   * Display context optimization information
   */
  displayContextOptimization(tokensSaved: number, savingsPercentage: number): void {
    console.log(
      `🔧 Context optimized: saved ${tokensSaved} tokens (${savingsPercentage.toFixed(1)}%)`
    );
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
