'use client'

import { useState } from 'react'
import type { Message } from '@/types/chat'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MarkdownContent } from './markdown-content'

interface MessageListProps {
  messages: Message[]
  className?: string
}

interface CollapsibleToolResponseProps {
  content: string
}

function CollapsibleToolResponse({ content }: CollapsibleToolResponseProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{isExpanded ? '▼' : '▶'}</span>
        <span>📊 ツール実行結果 {isExpanded ? '(折りたたむ)' : '(展開する)'}</span>
      </button>
      {isExpanded && (
        <pre className="mt-2 text-xs bg-background rounded p-2 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap wrap-break-word">
          {content}
        </pre>
      )}
    </div>
  )
}

export function MessageList({ messages, className }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No messages yet. Start a conversation!</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2 p-4', className)}>
      {messages.map((message) => {
        if (message.type === 'system') {
          return (
            <div key={message.id} className="flex justify-start px-1">
              <div className="text-xs text-muted-foreground">
                {message.subtype === 'tool_response' ? (
                  <CollapsibleToolResponse content={message.content} />
                ) : (
                  <span>{message.content}</span>
                )}
              </div>
            </div>
          )
        }

        return (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card
              className={`max-w-[80%] ${
                message.type === 'user' ? 'bg-primary text-primary-foreground' : ''
              }`}
            >
              <CardContent className="py-3">
                <div className="flex flex-col gap-1">
                  <p className="text-xs opacity-70">
                    {message.type === 'user' ? 'You' : 'Agent'}
                  </p>
                  {message.type === 'agent' ? (
                    <MarkdownContent content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
                  )}
                  <p className="text-xs opacity-50 text-right">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
