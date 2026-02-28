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
  'text_chunk',
  'thinking_chunk',
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
      // Skip empty data (e.g., keep-alive or server-sent protocol messages)
      if (!event.data) return
      try {
        const data = JSON.parse(event.data) as Event
        console.log('📨 SSE Event (default):', data.type, data)
        onEvent(data)
      } catch (error) {
        console.warn('Failed to parse SSE event (skipping):', event.data, error)
      }
    }

    // Listen for custom event types
    SSE_EVENT_TYPES.forEach((eventType) => {
      this.eventSource?.addEventListener(eventType, (e: MessageEvent) => {
        if (!e.data) return
        try {
          const data = JSON.parse(e.data) as Event
          console.log('📨 SSE Event:', data.type, data)
          onEvent(data)
        } catch (error) {
          console.warn('Failed to parse SSE event (skipping):', e.data, error)
        }
      })
    })

    this.eventSource.onerror = () => {
      // Close the EventSource to prevent browser auto-reconnect.
      // Each stream is unique per conversation, so reconnecting is not desired.
      console.log('🔌 SSE stream ended, closing connection')
      onError?.(new Error('SSE stream ended'))
      this.disconnect()
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
