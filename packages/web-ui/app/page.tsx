import { ChatInterface } from '@/components/chat/chat-interface'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-center mb-8">
          Shochan AI Chat
        </h1>
        <ChatInterface />
      </div>
    </main>
  )
}
