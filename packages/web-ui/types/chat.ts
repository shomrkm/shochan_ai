import type {
  Event,
  ToolCallEvent,
  ToolResponseEvent,
  ErrorEvent,
  CompleteEvent,
  TextChunkEvent,
  ThinkingChunkEvent,
  ConnectedEvent,
} from '@shochan_ai/core'

export type {
  Event,
  ToolCallEvent,
  ToolResponseEvent,
  ErrorEvent,
  CompleteEvent,
  TextChunkEvent,
  ThinkingChunkEvent,
  ConnectedEvent,
}

export interface Message {
  id: string
  type: 'user' | 'agent' | 'system'
  subtype?: 'tool_response'
  content: string
  timestamp: number
}

// API Response Types
export interface SendMessageResponse {
  conversationId: string
}

export interface ApiError {
  error: string
}
