import type { Message } from '@/types/chat'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MarkdownContent } from './markdown-content'

interface MessageListProps {
  messages: Message[]
  className?: string
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
    <div className={cn("flex flex-col gap-4 p-4", className)}>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.type === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <Card
            className={`max-w-[80%] ${
              message.type === 'user'
                ? 'bg-primary text-primary-foreground'
                : message.type === 'system'
                  ? 'bg-muted'
                  : ''
            }`}
          >
            <CardContent className="py-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs opacity-70">
                  {message.type === 'user'
                    ? 'You'
                    : message.type === 'agent'
                      ? 'Agent'
                      : 'System'}
                </p>
                {message.type === 'agent' ? (
                  <MarkdownContent content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap wrap-break-word">
                    {message.content}
                  </p>
                )}
                <p className="text-xs opacity-50 text-right">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}
