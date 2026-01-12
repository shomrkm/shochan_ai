import type { Event } from '@/types/chat'

/**
 * SSE event types to listen for.
 */
const SSE_EVENT_TYPES: ReadonlyArray<Event['type'] | 'connected'> = [
  'user_input',
  'tool_call',
  'tool_response',
  'error',
  'awaiting_approval',
  'complete',
  'connected',
] as const

export class SSEClient {
  private eventSource: EventSource | null = null

  connect(
    conversationId: string,
    onEvent: (event: Event) => void,
    onError?: (error: Error) => void
  ) {
    const url = `${process.env.NEXT_PUBLIC_STREAM_URL}/api/stream/${conversationId}`
    this.eventSource = new EventSource(url)

    this.eventSource.onopen = () => {
      console.log('✅ SSE connected')
    }

    // Handle default message events (no event field specified)
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Event
        console.log('📨 SSE Event (default):', data.type, data)
        onEvent(data)
      } catch (error) {
        console.error('Failed to parse SSE event:', error)
        onError?.(error as Error)
      }
    }

    // Listen for custom event types
    SSE_EVENT_TYPES.forEach((eventType) => {
      this.eventSource?.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as Event
          console.log('📨 SSE Event:', data.type, data)
          onEvent(data)
        } catch (error) {
          console.error('Failed to parse SSE event:', error)
          onError?.(error as Error)
        }
      })
    })

    this.eventSource.onerror = () => {
      console.error('❌ SSE error')
      this.disconnect()
      onError?.(new Error('SSE connection error'))
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
      console.log('🔌 SSE disconnected')
    }
  }
}
