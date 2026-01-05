import { useMutation } from '@tanstack/react-query'
import type { SendMessageResponse } from '@/types/chat'

async function sendMessage(message: string): Promise<SendMessageResponse> {
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

  const data: SendMessageResponse = await response.json()
  return data
}

type UseSendMessageOptions = Omit<
  Parameters<typeof useMutation<SendMessageResponse, Error, string>>[0],
  'mutationFn'
>

export function useSendMessage(options?: UseSendMessageOptions) {
  return useMutation({
    mutationFn: sendMessage,
    ...options,
    onError: (error, variables, context, mutation) => {
      console.error('Failed to send message:', error)
      options?.onError?.(error, variables, context, mutation)
    },
  })
}

