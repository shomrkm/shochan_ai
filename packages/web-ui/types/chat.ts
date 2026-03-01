import type {
  CompleteEvent,
  ConnectedEvent,
  ErrorEvent,
  Event,
  TextChunkEvent,
  ThinkingChunkEvent,
  ToolCall,
  ToolCallEvent,
  ToolResponseEvent,
} from '@shochan_ai/core';

export type {
  Event,
  ToolCall,
  ToolCallEvent,
  ToolResponseEvent,
  ErrorEvent,
  CompleteEvent,
  TextChunkEvent,
  ThinkingChunkEvent,
  ConnectedEvent,
};

export interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  subtype?: 'tool_response';
  content: string;
  timestamp: number;
}

// API Response Types
export interface SendMessageResponse {
  conversationId: string;
}

export interface ApiError {
  error: string;
}
