/**
 * ContextManager - Factor 3: Own Your Context Window
 * Comprehensive context management for AI agent interactions including:
 * - Conversation history management
 * - Tool execution context tracking
 * - Prompt context building
 * - Statistical analysis and debugging support
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { PromptContext } from '../types/prompt-types';
import { Thread } from '../events/thread';
import type { EventType, EventTypeDataMap } from '../events/types';
import {
  isNotionProjectResultData,
  isNotionTaskResultData,
  isUserInputResultData,
} from '../types/toolGuards';
import type { AgentTool, ToolResult } from '../types/tools';

/**
 * Comprehensive context manager for AI agent interactions
 * Implements Factor 3 principles with unified context management across:
 * - Conversation flows
 * - Tool execution tracking
 * - Statistical analysis
 * - Prompt context generation
 */
export class ContextManager {
  private thread: Thread;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private useXMLContext: boolean = false; // Feature flag for XML mode

  constructor(options: { xmlMode?: boolean } = {}) {
    this.thread = new Thread();
    this.useXMLContext = options.xmlMode ?? false;
  }

  /**
   * Add user message to context history
   */
  addUserMessage(message: string): void {
    // Add to legacy conversation history
    this.conversationHistory.push({
      role: 'user',
      content: message,
    });
    // Add to new event-based thread
    this.thread.addEvent('user_message', {
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add assistant response to context history
   */
  addAssistantResponse(response: string): void {
    // Add to legacy conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: response,
    });
    // Add to new event-based thread
    this.thread.addEvent('agent_response', {
      message: response,
      timestamp: new Date().toISOString(),
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
   * Uses XML context if xmlMode is enabled, otherwise uses legacy conversation history
   */
  buildPromptContext(userMessage: string): PromptContext {
    return {
      userMessage,
      conversationHistory: this.useXMLContext ? [] : this.getConversationHistory(),
      thread: this.useXMLContext ? this.thread : undefined,
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
    // Create new thread for XML mode
    this.thread = new Thread();
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
            resultSummary.taskTitle =
              toolResult.data.properties?.Title?.title?.[0]?.plain_text || 'Unknown';
          }
          break;
        case 'create_project':
          if (isNotionProjectResultData(toolResult.data)) {
            resultSummary.projectId = toolResult.data.id;
            resultSummary.projectName =
              toolResult.data.properties?.Name?.title?.[0]?.plain_text || 'Unknown';
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

  // New XML-based methods
  /**
   * Add event directly to thread for XML context
   */
  addEvent<K extends EventType>(type: K, data: EventTypeDataMap[K]): void {
    this.thread.addEvent(type, data);
  }

  /**
   * Enable XML mode for context generation
   */
  enableXMLMode(): void {
    this.useXMLContext = true;
  }

  /**
   * Disable XML mode and use legacy conversation history
   */
  disableXMLMode(): void {
    this.useXMLContext = false;
  }

  /**
   * Check if XML mode is currently enabled
   */
  isXMLModeEnabled(): boolean {
    return this.useXMLContext;
  }

  /**
   * Get access to the underlying Thread for direct manipulation
   */
  getThread(): Thread {
    return this.thread;
  }
}
