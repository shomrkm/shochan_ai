/**
 * ContextManager - Factor 3: Own Your Context Window
 * XML-based context management for AI agent interactions including:
 * - Event-driven thread context tracking
 * - Tool execution event recording
 * - XML prompt context building
 * - Statistical analysis and debugging support
 */

import type { PromptContext } from '../types/prompt-types';
import { Thread } from '../events/thread';
import type { EventType, EventTypeDataMap } from '../events/types';

/**
 * XML-based context manager for AI agent interactions
 * Implements Factor 3 principles with event-driven context management across:
 * - Thread-based conversation flows
 * - Tool execution event tracking
 * - Statistical analysis
 * - XML prompt context generation
 */
export class ContextManager {
  private thread: Thread;

  constructor() {
    this.thread = new Thread();
  }

  /**
   * Add user message to thread context
   */
  addUserMessage(message: string): void {
    this.thread.addEvent('user_message', {
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add assistant response to thread context
   */
  addAssistantResponse(response: string): void {
    this.thread.addEvent('agent_response', {
      message: response,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Build prompt context from current thread state
   */
  buildPromptContext(userMessage: string): PromptContext {
    return {
      userMessage,
      thread: this.thread,
    };
  }

  /**
   * Clear thread context
   */
  clear(): void {
    this.thread = new Thread();
  }

  /**
   * Export complete thread data for analysis or persistence
   */
  exportHistory(): {
    timestamp: string;
    eventCount: number;
    threadContext: string;
  } {
    return {
      timestamp: new Date().toISOString(),
      eventCount: this.thread.getEventCount(),
      threadContext: this.thread.toPrompt(),
    };
  }

  /**
   * Add event directly to thread context
   */
  addEvent<K extends EventType>(type: K, data: EventTypeDataMap[K]): void {
    this.thread.addEvent(type, data);
  }

  /**
   * Get access to the underlying Thread for direct manipulation
   */
  getThread(): Thread {
    return this.thread;
  }
}
