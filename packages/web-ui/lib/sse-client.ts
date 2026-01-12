import type { Event } from '@/types/chat'

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

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Event
        console.log('📨 SSE Event:', data.type)
        onEvent(data)
      } catch (error) {
        console.error('Failed to parse SSE event:', error)
        onError?.(error as Error)
      }
    }

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
