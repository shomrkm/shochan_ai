import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
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
  UseMutationOptions<SendMessageResponse, Error, string>,
  'mutationFn'
>

export function useSendMessage(options?: UseSendMessageOptions) {
  return useMutation({
    mutationFn: sendMessage,
    ...options,
  })
}

