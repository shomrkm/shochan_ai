import type {
  Event,
  ToolCallEvent,
  ToolResponseEvent,
  ErrorEvent,
  CompleteEvent,
} from '@shochan_ai/core'

export type { Event, ToolCallEvent, ToolResponseEvent, ErrorEvent, CompleteEvent }

export interface Message {
  id: string
  type: 'user' | 'agent' | 'system'
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
