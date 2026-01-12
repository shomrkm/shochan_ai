import type { Event } from '@shochan_ai/core'

export type { Event }

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
