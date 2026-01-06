'use client'

import { useState } from 'react'
import type { Message } from '@/types/chat'
import { useSendMessage } from '@/lib/api'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import { Card } from '@/components/ui/card'

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])

  const mutation = useSendMessage({
    onSuccess: (data) => {
      // Store conversationId for future SSE connection (Phase 5.6)
      console.log('Conversation started:', data.conversationId)

      // Temporary mock response until SSE is implemented
      const agentMessage: Message = {
        id: crypto.randomUUID(),
        type: 'agent',
        content: `Conversation started. ID: ${data.conversationId}`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, agentMessage])
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
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} />
      </div>
      <div className="border-t p-4">
        <MessageInput onSend={handleSendMessage} disabled={mutation.isPending} />
      </div>
    </Card>
  )
}
