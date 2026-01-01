export interface Message {
  id: string
  type: 'user' | 'agent' | 'system'
  content: string
  timestamp: number
}
