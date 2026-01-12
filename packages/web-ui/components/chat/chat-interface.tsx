'use client'

import { useState, useCallback } from 'react'
import type { Message, Event } from '@/types/chat'
import { useSendMessage } from '@/lib/api'
import { useSSE } from '@/hooks/use-sse'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import { Card } from '@/components/ui/card'
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
    <Card className="flex flex-col h-[600px] w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-2xl font-bold">Chat</h2>
        {conversationId && <Badge variant="outline">Connected</Badge>}
      </div>
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} />
      </div>
      <div className="border-t p-4">
        <MessageInput onSend={handleSendMessage} disabled={mutation.isPending} />
      </div>
    </Card>
  )
}
