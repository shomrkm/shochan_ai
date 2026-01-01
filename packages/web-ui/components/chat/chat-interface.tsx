'use client'

import { useState } from 'react'
import type { Message } from '@/types/chat'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import { Card } from '@/components/ui/card'

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])

    // Mock agent response after a short delay
    setTimeout(() => {
      const agentMessage: Message = {
        id: crypto.randomUUID(),
        type: 'agent',
        content: `You said: "${content}"\n\nThis is a mock response from the agent.`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, agentMessage])
    }, 1000)
  }

  return (
    <Card className="flex flex-col h-[600px] w-full max-w-4xl mx-auto">
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} />
      </div>
      <div className="border-t p-4">
        <MessageInput onSend={handleSendMessage} />
      </div>
    </Card>
  )
}
