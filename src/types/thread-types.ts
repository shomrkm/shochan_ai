/**
 * Factor 5: Unified Execution State and Business State
 * 
 * All agent state is represented as a sequence of events in a thread.
 * This unifies execution state (current step, status) with business state (messages, tool calls).
 */

export type ThreadStatus = 
  | 'idle'           // Thread created but not started
  | 'active'         // Currently processing
  | 'waiting_input'  // Waiting for user input
  | 'completed'      // Task completed successfully
  | 'failed'         // Task failed
  | 'paused'         // Manually paused
  | 'cancelled';     // Cancelled by user

export type EventType =
  | 'thread_created'       // Thread initialization
  | 'conversation_started' // Conversation began
  | 'user_message'        // User sent a message
  | 'context_optimized'   // Context window optimized
  | 'prompt_generated'    // System prompt generated
  | 'tool_call_generated' // Claude generated tool call
  | 'tool_executed'       // Tool was executed
  | 'agent_response'      // Agent provided direct response
  | 'info_collected'      // User information collected
  | 'stage_changed'       // Conversation stage changed
  | 'error_occurred'      // Error happened
  | 'thread_completed'    // Thread finished
  | 'thread_paused'       // Thread paused
  | 'thread_resumed';     // Thread resumed

export interface EventMetadata {
  executionTimeMs?: number;
  tokensSaved?: number;
  savingsPercentage?: number;
  retryCount?: number;
  conversationStage?: string;
  toolName?: string;
  traceId?: string;
}

export interface ThreadEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  data: EventData;
  metadata?: EventMetadata;
}

// Union type for all possible event data
export type EventData = 
  | ThreadCreatedEventData
  | ConversationStartedEventData
  | UserMessageEventData
  | ContextOptimizedEventData
  | PromptGeneratedEventData
  | ToolCallEventData
  | ToolExecutedEventData
  | AgentResponseEventData
  | InfoCollectedEventData
  | StageChangedEventData
  | ErrorEventData
  | ThreadCompletedEventData
  | ThreadPausedEventData
  | ThreadResumedEventData;

export interface AgentThread {
  threadId: string;
  createdAt: Date;
  updatedAt: Date;
  status: ThreadStatus;
  events: ThreadEvent[];
  
  // Derived state (computed from events)
  currentConversationStage?: string;
  collectedInfo?: Record<string, string>;
  questionCount?: number;
  messageHistory?: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>;
  lastError?: string;
}

export interface ThreadSnapshot {
  thread: AgentThread;
  serializedAt: Date;
  version: string;
}

// Event data interfaces for type safety
import type { AgentTool } from './tools';
import type { EnrichedToolResult } from '../tools/tool-execution-context';

export interface ThreadCreatedEventData {
  threadId: string;
  createdAt: Date;
}

export interface ConversationStartedEventData {
  status: string;
}

export interface UserMessageEventData {
  content: string;
  messageContext: {
    isRecent: boolean;
    containsDecision: boolean;
    hasUserPreference: boolean;
    toolCallResult: boolean;
  };
}

export interface ContextOptimizedEventData {
  tokensSaved: number;
  savingsPercentage: number;
}

export interface PromptGeneratedEventData {
  systemPrompt: string;
  conversationStage: string;
}

export interface ToolCallEventData {
  toolCall: AgentTool;
  systemPrompt: string;
  conversationStage: string;
}

export interface ToolExecutedEventData {
  toolCall: AgentTool;
  result: EnrichedToolResult;
  success: boolean;
  executionTimeMs: number;
}

export interface InfoCollectedEventData {
  question: string;
  answer: string;
  category: string;
}

export interface AgentResponseEventData {
  content: string;
  responseType: 'direct' | 'tool_result';
}

export interface StageChangedEventData {
  oldStage: string;
  newStage: string;
  stage: string;
}

export interface ErrorEventData {
  error: string;
  stack?: string;
  context?: string;
  recoverable: boolean;
}

export interface ThreadCompletedEventData {
  completedAt: Date;
  finalStatus: string;
}

export interface ThreadPausedEventData {
  pausedAt: Date;
}

export interface ThreadResumedEventData {
  resumedAt: Date;
}

// Type Guards for runtime type checking
export function isThreadCreatedEvent(event: ThreadEvent): event is ThreadEvent & { data: ThreadCreatedEventData } {
  return event.type === 'thread_created';
}

export function isConversationStartedEvent(event: ThreadEvent): event is ThreadEvent & { data: ConversationStartedEventData } {
  return event.type === 'conversation_started';
}

export function isUserMessageEvent(event: ThreadEvent): event is ThreadEvent & { data: UserMessageEventData } {
  return event.type === 'user_message';
}

export function isContextOptimizedEvent(event: ThreadEvent): event is ThreadEvent & { data: ContextOptimizedEventData } {
  return event.type === 'context_optimized';
}

export function isPromptGeneratedEvent(event: ThreadEvent): event is ThreadEvent & { data: PromptGeneratedEventData } {
  return event.type === 'prompt_generated';
}

export function isToolCallGeneratedEvent(event: ThreadEvent): event is ThreadEvent & { data: ToolCallEventData } {
  return event.type === 'tool_call_generated';
}

export function isToolExecutedEvent(event: ThreadEvent): event is ThreadEvent & { data: ToolExecutedEventData } {
  return event.type === 'tool_executed';
}

export function isAgentResponseEvent(event: ThreadEvent): event is ThreadEvent & { data: AgentResponseEventData } {
  return event.type === 'agent_response';
}

export function isInfoCollectedEvent(event: ThreadEvent): event is ThreadEvent & { data: InfoCollectedEventData } {
  return event.type === 'info_collected';
}

export function isStageChangedEvent(event: ThreadEvent): event is ThreadEvent & { data: StageChangedEventData } {
  return event.type === 'stage_changed';
}

export function isErrorOccurredEvent(event: ThreadEvent): event is ThreadEvent & { data: ErrorEventData } {
  return event.type === 'error_occurred';
}

export function isThreadCompletedEvent(event: ThreadEvent): event is ThreadEvent & { data: ThreadCompletedEventData } {
  return event.type === 'thread_completed';
}

export function isThreadPausedEvent(event: ThreadEvent): event is ThreadEvent & { data: ThreadPausedEventData } {
  return event.type === 'thread_paused';
}

export function isThreadResumedEvent(event: ThreadEvent): event is ThreadEvent & { data: ThreadResumedEventData } {
  return event.type === 'thread_resumed';
}