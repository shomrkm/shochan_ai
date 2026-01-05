import { useMutation } from '@tanstack/react-query'
import type { SendMessageResponse } from '@/types/chat'

async function sendMessage(message: string): Promise<SendMessageResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const endpoint = `${apiUrl}/api/agent/query`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })

  // TODO: Remove this after the API is implemented
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  if (!response.ok) {
    throw new Error('Failed to send message')
  }

  // TODO: Remove this mock and use the actual response from the API
  // const data: SendMessageResponse = await response.json()
  return {
    conversationId: `mock-${Date.now()}`,
    response: `You said: "${message}"\n\nThis is a mock response from the API.`,
  }
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

