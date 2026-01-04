export interface Message {
  id: string
  type: 'user' | 'agent' | 'system'
  content: string
  timestamp: number
}

// API Response Types
export interface SendMessageResponse {
  conversationId: string
  response: string
}

export interface ApiError {
  error: string
}
