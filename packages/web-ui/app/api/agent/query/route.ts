import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Mock response
    return NextResponse.json({
      conversationId: `mock-${Date.now()}`,
      response: `You said: "${message}"\n\nThis is a mock response from the API.`,
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
