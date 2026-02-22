'use client'

import { useState, useCallback } from 'react'
import type { Message, Event, ToolCallEvent, ToolResponseEvent, ErrorEvent, CompleteEvent } from '@/types/chat'
import { useSendMessage } from '@/lib/api'
import { useSSE } from '@/hooks/use-sse'
import { useAutoScroll } from '@/hooks/use-auto-scroll'
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
    let message: Message | null = null

    switch (event.type) {
      case 'text_chunk':
        // Real-time text streaming: append chunks to existing message or create new one
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          const { messageId, content } = event.data

          // Append to existing message if same messageId
          if (lastMessage && lastMessage.id === messageId) {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, content: lastMessage.content + content },
            ]
          }

          // Create new message
          return [
            ...prev,
            {
              id: messageId,
              type: 'agent' as const,
              content,
              timestamp: event.timestamp,
            },
          ]
        })
        return

      case 'tool_call':
        message = createToolCallMessage(event)
        break

      case 'tool_response':
        message = createToolResponseMessage(event)
        break

      case 'complete':
        message = createCompleteMessage(event)
        break

      case 'error':
        message = createErrorMessage(event)
        break
    }

    if (message) {
      setMessages((prev) => [...prev, message])
    }
  }, [])

  useSSE(conversationId, handleSSEEvent)

  const { scrollRef, handleScroll } = useAutoScroll([messages])

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    mutation.mutate({ message: content, conversationId })
  }

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="flex justify-between items-center p-4 border-b bg-background">
        <h2 className="text-2xl font-bold">Shochan AI Chat</h2>
        {conversationId && <Badge variant="outline">Connected</Badge>}
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4">
        <div className="max-w-4xl mx-auto h-full">
          <MessageList messages={messages} className="pb-32" />
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

/**
 * Create a message from a tool call event.
 * Shows tool calls as system messages.
 */
function createToolCallMessage(event: ToolCallEvent): Message {
  const { data: toolCall, timestamp } = event

  return {
    id: `tool-call-${timestamp}`,
    type: 'system',
    content: `🔧 Tool call: ${toolCall.intent}`,
    timestamp,
  }
}

/**
 * Create a message from a tool response event.
 */
function createToolResponseMessage(event: ToolResponseEvent): Message {
  return {
    id: `tool-response-${event.timestamp}`,
    type: 'system',
    content: JSON.stringify(event.data, null, 2),
    timestamp: event.timestamp,
  }
}

/**
 * Create a message from a complete event.
 */
function createCompleteMessage(event: CompleteEvent): Message {
  return {
    id: `complete-${event.timestamp}`,
    type: 'system',
    content: '✅ Processing complete',
    timestamp: event.timestamp,
  }
}

/**
 * Create a message from an error event.
 */
function createErrorMessage(event: ErrorEvent): Message {
  return {
    id: `error-${event.timestamp}`,
    type: 'system',
    content: `❌ Error: ${event.data.error}`,
    timestamp: event.timestamp,
  }
}
