import { useEffect, useRef } from 'react'
import { SSEClient } from '@/lib/sse-client'
import type { Event } from '@/types/chat'

export function useSSE(
  conversationId: string | null,
  onEvent: (event: Event) => void
) {
  const clientRef = useRef<SSEClient | null>(null)

  useEffect(() => {
    if (!conversationId) return

    clientRef.current = new SSEClient()
    clientRef.current.connect(conversationId, onEvent)

    return () => {
      clientRef.current?.disconnect()
    }
  }, [conversationId, onEvent])
}
