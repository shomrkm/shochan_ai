'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { Message } from '@/types/chat'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import { Card } from '@/components/ui/card'

async function sendMessage(message: string) {
  const response = await fetch('/api/agent/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    throw new Error('Failed to send message')
  }

  return response.json()
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])

  const mutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (data) => {
      const agentMessage: Message = {
        id: crypto.randomUUID(),
        type: 'agent',
        content: data.response,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, agentMessage])
    },
    onError: (error) => {
      console.error('Failed to send message:', error)
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
