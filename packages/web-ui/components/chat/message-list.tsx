import type { Message } from '@/types/chat'
import { Card, CardContent } from '@/components/ui/card'

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No messages yet. Start a conversation!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
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
                <p className="whitespace-pre-wrap wrap-break-word">
                  {message.content}
                </p>
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
