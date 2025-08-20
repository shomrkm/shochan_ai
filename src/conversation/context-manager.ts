/**
 * ContextManager - Factor 3: Own Your Context Window
 * Comprehensive context management for AI agent interactions including:
 * - Conversation history management
 * - Tool execution context tracking
 * - Prompt context building
 * - Statistical analysis and debugging support
 */

import type { PromptContext } from '../types/prompt-types';
import type { AgentTool, ToolResult } from '../types/tools';
import { isUserInputResultData, isNotionTaskResultData, isNotionProjectResultData } from '../types/toolGuards';
import type Anthropic from '@anthropic-ai/sdk';


/**
 * Comprehensive context manager for AI agent interactions
 * Implements Factor 3 principles with unified context management across:
 * - Conversation flows
 * - Tool execution tracking 
 * - Statistical analysis
 * - Prompt context generation
 */
export class ContextManager {
  private conversationHistory: Anthropic.MessageParam[] = [];

  /**
   * Add user message to context history
   */
  addUserMessage(message: string): void {
    this.conversationHistory.push({ 
      role: 'user', 
      content: message 
    });
  }

  /**
   * Add assistant response to context history
   */
  addAssistantResponse(response: string): void {
    this.conversationHistory.push({ 
      role: 'assistant', 
      content: response 
    });
  }

  /**
   * Add tool execution result to context history using Anthropic standard format
   */
  addToolExecution(toolCall: AgentTool, toolResult: ToolResult): void {
    // Generate a single ID for both tool_use and tool_result
    const toolId = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Add assistant message with tool call
    this.conversationHistory.push({
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: toolId,
          name: toolCall.function.name,
          input: toolCall.function.parameters,
        },
      ],
    });

    // Add tool result message with execution context
    const toolResultContent = this.buildToolResultContent(toolCall, toolResult);
    this.conversationHistory.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolId,
          content: toolResultContent,
        },
      ],
    });

  }

  /**
   * Build prompt context from current context state
   */
  buildPromptContext(userMessage: string): PromptContext {
    return {
      userMessage,
      conversationHistory: this.getConversationHistory(),
    };
  }

  /**
   * Get current context history (read-only)
   */
  getConversationHistory(): Anthropic.MessageParam[] {
    return [...this.conversationHistory];
  }


  /**
   * Clear context history
   */
  clear(): void {
    this.conversationHistory = [];
  }

  /**
   * Build structured tool result content for context storage
   * @private
   */
  private buildToolResultContent(toolCall: AgentTool, toolResult: ToolResult): string {
    const resultSummary: Record<string, any> = {
      success: toolResult.success,
      status: toolResult.status,
      executionTime: toolResult.executionTime ? `${toolResult.executionTime}ms` : 'unknown',
      timestamp: toolResult.timestamp.toISOString(),
    };

    // Add tool-specific result data
    if (toolResult.success && toolResult.data) {
      switch (toolCall.function.name) {
        case 'create_task':
          if (isNotionTaskResultData(toolResult.data)) {
            resultSummary.taskId = toolResult.data.id;
            resultSummary.taskTitle = toolResult.data.properties?.Title?.title?.[0]?.plain_text || 'Unknown';
          }
          break;
        case 'create_project':
          if (isNotionProjectResultData(toolResult.data)) {
            resultSummary.projectId = toolResult.data.id;
            resultSummary.projectName = toolResult.data.properties?.Name?.title?.[0]?.plain_text || 'Unknown';
          }
          break;
        case 'user_input':
          if (isUserInputResultData(toolResult.data)) {
            resultSummary.userResponse = toolResult.data.user_response;
          }
          break;
      }
    }

    // Add error information if present
    if (!toolResult.success && toolResult.error) {
      resultSummary.error = {
        code: toolResult.error.code,
        message: toolResult.error.message,
        recoverable: toolResult.error.recoverable,
      };
    }

    return JSON.stringify(resultSummary, null, 2);
  }


  /**
   * Export complete context data for analysis or persistence
   */
  exportHistory(): {
    timestamp: string;
    messageCount: number;
    messages: Anthropic.MessageParam[];
  } {
    return {
      timestamp: new Date().toISOString(),
      messageCount: this.conversationHistory.length,
      messages: [...this.conversationHistory],
    };
  }
}