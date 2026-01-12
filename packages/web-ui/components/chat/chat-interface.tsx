'use client'

import { useState, useCallback } from 'react'
import type { Message, Event } from '@/types/chat'
import { useSendMessage } from '@/lib/api'
import { useSSE } from '@/hooks/use-sse'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import { Badge } from '@/components/ui/badge'

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)

  const mutation = useSendMessage({
    onSuccess: (data) => {
      setConversationId(data.conversationId)
    },
    onError: () => {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        type: 'system',
        content: 'Failed to send message. Please try again.',
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
    },
  })

  const handleSSEEvent = useCallback((event: Event) => {
    switch (event.type) {
      case 'tool_call':
        setMessages((prev) => [
          ...prev,
          {
            id: `tool-call-${event.timestamp}`,
            type: 'system',
            content: `🔧 Tool call: ${event.data.intent}`,
            timestamp: event.timestamp,
          },
        ])
        break

      case 'tool_response':
        setMessages((prev) => [
          ...prev,
          {
            id: `tool-response-${event.timestamp}`,
            type: 'system',
            content: JSON.stringify(event.data, null, 2),
            timestamp: event.timestamp,
          },
        ])
        break

      case 'complete':
        setMessages((prev) => [
          ...prev,
          {
            id: `complete-${event.timestamp}`,
            type: 'system',
            content: '✅ Processing complete',
            timestamp: event.timestamp,
          },
        ])
        break

      case 'error':
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${event.timestamp}`,
            type: 'system',
            content: `❌ Error: ${event.data.error}`,
            timestamp: event.timestamp,
          },
        ])
        break
    }
  }, [])

  useSSE(conversationId, handleSSEEvent)

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    mutation.mutate(content)
  }

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="flex justify-between items-center p-4 border-b bg-background">
        <h2 className="text-2xl font-bold">Shochan AI Chat</h2>
        {conversationId && <Badge variant="outline">Connected</Badge>}
      </div>

      <div className="flex-1 overflow-y-auto pb-32 px-4">
        <div className="max-w-4xl mx-auto">
          <MessageList messages={messages} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-t p-4">
        <div className="max-w-4xl mx-auto">
          <MessageInput onSend={handleSendMessage} disabled={mutation.isPending} />
        </div>
      </div>
    </div>
  )
}
