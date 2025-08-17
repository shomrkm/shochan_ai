import { v4 as uuidv4 } from 'uuid';
import type {
  AgentThread,
  ThreadEvent,
  ThreadStatus,
  EventType,
  EventData,
  EventMetadata,
  ThreadCreatedEventData,
  ConversationStartedEventData,
  UserMessageEventData,
  ContextOptimizedEventData,
  PromptGeneratedEventData,
  ToolCallEventData,
  ToolExecutedEventData,
  InfoCollectedEventData,
  AgentResponseEventData,
  StageChangedEventData,
  ErrorEventData,
  ThreadCompletedEventData,
  ThreadPausedEventData,
  ThreadResumedEventData,
  CheckpointCreatedEventData,
} from '../types/thread-types';
import {
  isStageChangedEvent,
  isUserMessageEvent,
  isAgentResponseEvent,
  isToolExecutedEvent,
  isInfoCollectedEvent,
  isErrorOccurredEvent,
} from '../types/thread-types';
import type { AgentTool } from '../types/tools';
import type { EnrichedToolResult } from '../tools/tool-execution-context';
import type { ThreadStorage } from './thread-storage';

/**
 * AgentThread: Unified state management for Factor 5
 * 
 * Manages all agent state as a sequence of events, unifying execution state
 * and business state into a single, observable, serializable thread.
 */
export class AgentThreadManager {
  private thread: AgentThread;
  private storage?: ThreadStorage;
  private autoSave: boolean = false;

  constructor(threadId?: string, storage?: ThreadStorage, autoSave: boolean = false) {
    this.storage = storage;
    this.autoSave = autoSave;
    
    this.thread = {
      threadId: threadId || uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'idle',
      events: [],
    };

    // Record thread creation event
    this.addEvent('thread_created', {
      threadId: this.thread.threadId,
      createdAt: this.thread.createdAt,
    });
  }

  /**
   * Add checkpoint event (used by recovery system)
   */
  addCheckpoint(checkpointId: string, label?: string, eventIndex?: number): ThreadEvent {
    const eventData: CheckpointCreatedEventData = {
      checkpointId,
      label,
      eventIndex: eventIndex ?? this.thread.events.length,
    };
    return this.addEvent('checkpoint_created', eventData);
  }

  /**
   * Add an event to the thread
   */
  private addEvent(
    type: EventType,
    data: EventData,
    metadata?: EventMetadata
  ): ThreadEvent {
    const event: ThreadEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type,
      data,
      metadata,
    };

    this.thread.events.push(event);
    this.thread.updatedAt = new Date();
    
    // Update derived state
    this.updateDerivedState();
    
    // Auto-save if enabled
    if (this.autoSave && this.storage) {
      this.storage.save(this.thread.threadId, this.thread).catch(error => {
        console.error('Auto-save failed:', error);
      });
    }
    
    return event;
  }

  /**
   * Update derived state from events
   */
  private updateDerivedState(): void {
    const events = this.thread.events;
    
    // Compute conversation stage
    const stageEvents = events.filter(isStageChangedEvent);
    this.thread.currentConversationStage = stageEvents.length > 0 
      ? stageEvents[stageEvents.length - 1].data.stage 
      : 'initial';

    // Compute collected info
    const infoEvents = events.filter(isInfoCollectedEvent);
    this.thread.collectedInfo = infoEvents.reduce((acc, event) => {
      (acc as Record<string, string>)[event.data.category] = event.data.answer;
      return acc;
    }, {} as Record<string, string>);

    // Compute question count
    const questionEvents = events.filter(e => {
      if (isToolExecutedEvent(e)) {
        return e.data.toolCall?.function?.name === 'ask_question';
      }
      return false;
    });
    this.thread.questionCount = questionEvents.length;

    // Compute message history
    const messageEvents = events.filter(e => 
      isUserMessageEvent(e) || isAgentResponseEvent(e)
    );
    this.thread.messageHistory = messageEvents.map(event => {
      if (isUserMessageEvent(event)) {
        return {
          role: 'user' as const,
          content: event.data.content,
          timestamp: event.timestamp,
        };
      } else if (isAgentResponseEvent(event)) {
        return {
          role: 'assistant' as const,
          content: event.data.content,
          timestamp: event.timestamp,
        };
      }
      // This should never happen due to filter, but TypeScript needs it
      throw new Error('Invalid message event type');
    });

    // Compute last error
    const errorEvents = events.filter(isErrorOccurredEvent);
    this.thread.lastError = errorEvents.length > 0 
      ? errorEvents[errorEvents.length - 1].data.error 
      : undefined;
  }

  /**
   * Start conversation
   */
  startConversation(): ThreadEvent {
    this.thread.status = 'active';
    return this.addEvent('conversation_started', {
      status: this.thread.status,
    });
  }

  /**
   * Add user message
   */
  addUserMessage(content: string, messageContext: UserMessageEventData['messageContext']): ThreadEvent {
    const eventData: UserMessageEventData = {
      content,
      messageContext,
    };
    return this.addEvent('user_message', eventData);
  }

  /**
   * Add context optimization event
   */
  addContextOptimization(tokensSaved: number, savingsPercentage: number): ThreadEvent {
    return this.addEvent('context_optimized', {
      tokensSaved,
      savingsPercentage,
    }, {
      tokensSaved,
      savingsPercentage,
    });
  }

  /**
   * Add prompt generation event
   */
  addPromptGenerated(systemPrompt: string, conversationStage: string): ThreadEvent {
    return this.addEvent('prompt_generated', {
      systemPrompt,
      conversationStage,
    }, {
      conversationStage,
    });
  }

  /**
   * Add tool call generation event
   */
  addToolCallGenerated(toolCall: AgentTool, systemPrompt: string, conversationStage: string): ThreadEvent {
    const eventData: ToolCallEventData = {
      toolCall,
      systemPrompt,
      conversationStage,
    };
    return this.addEvent('tool_call_generated', eventData, {
      conversationStage,
      toolName: toolCall?.function?.name,
    });
  }

  /**
   * Add tool execution event
   */
  addToolExecuted(
    toolCall: AgentTool, 
    result: EnrichedToolResult, 
    success: boolean, 
    executionTimeMs: number,
    retryCount?: number
  ): ThreadEvent {
    const eventData: ToolExecutedEventData = {
      toolCall,
      result,
      success,
      executionTimeMs,
    };
    return this.addEvent('tool_executed', eventData, {
      executionTimeMs,
      retryCount,
      toolName: toolCall?.function?.name,
    });
  }

  /**
   * Add agent response event
   */
  addAgentResponse(content: string, responseType: 'direct' | 'tool_result' = 'direct'): ThreadEvent {
    const eventData: AgentResponseEventData = {
      content,
      responseType,
    };
    return this.addEvent('agent_response', eventData);
  }

  /**
   * Add information collected event
   */
  addInfoCollected(question: string, answer: string, category: string): ThreadEvent {
    const eventData: InfoCollectedEventData = {
      question,
      answer,
      category,
    };
    return this.addEvent('info_collected', eventData);
  }

  /**
   * Add conversation stage change event
   */
  addStageChanged(oldStage: string, newStage: string): ThreadEvent {
    return this.addEvent('stage_changed', {
      oldStage,
      newStage,
      stage: newStage,
    });
  }

  /**
   * Add error event
   */
  addError(error: string, stack?: string, context?: string, recoverable: boolean = true): ThreadEvent {
    this.thread.status = recoverable ? 'active' : 'failed';
    const eventData: ErrorEventData = {
      error,
      stack,
      context,
      recoverable,
    };
    return this.addEvent('error_occurred', eventData);
  }

  /**
   * Complete thread
   */
  complete(): ThreadEvent {
    this.thread.status = 'completed';
    return this.addEvent('thread_completed', {
      completedAt: new Date(),
      finalStatus: this.thread.status,
    });
  }

  /**
   * Pause thread
   */
  pause(): ThreadEvent {
    this.thread.status = 'paused';
    return this.addEvent('thread_paused', {
      pausedAt: new Date(),
    });
  }

  /**
   * Resume thread
   */
  resume(): ThreadEvent {
    this.thread.status = 'active';
    return this.addEvent('thread_resumed', {
      resumedAt: new Date(),
    });
  }

  /**
   * Get current thread state
   */
  getThread(): AgentThread {
    return { ...this.thread };
  }

  /**
   * Get thread ID
   */
  getThreadId(): string {
    return this.thread.threadId;
  }

  /**
   * Get current status
   */
  getStatus(): ThreadStatus {
    return this.thread.status;
  }

  /**
   * Get all events
   */
  getEvents(): ThreadEvent[] {
    return [...this.thread.events];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: EventType): ThreadEvent[] {
    return this.thread.events.filter(event => event.type === type);
  }

  /**
   * Get derived conversation stage
   */
  getCurrentConversationStage(): string {
    return this.thread.currentConversationStage || 'initial';
  }

  /**
   * Get derived collected info
   */
  getCollectedInfo(): Record<string, string> {
    return this.thread.collectedInfo || {};
  }

  /**
   * Get derived question count
   */
  getQuestionCount(): number {
    return this.thread.questionCount || 0;
  }

  /**
   * Get derived message history
   */
  getMessageHistory(): Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}> {
    return this.thread.messageHistory || [];
  }

  /**
   * Get thread statistics
   */
  getStatistics() {
    const events = this.thread.events;
    return {
      totalEvents: events.length,
      eventsByType: events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<EventType, number>),
      duration: this.thread.updatedAt.getTime() - this.thread.createdAt.getTime(),
      averageEventInterval: events.length > 1 
        ? (this.thread.updatedAt.getTime() - this.thread.createdAt.getTime()) / (events.length - 1)
        : 0,
    };
  }
}