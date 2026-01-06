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

  const data: SendMessageResponse = await response.json()
  return data
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

