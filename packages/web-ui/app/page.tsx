import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-center mb-8">
          Shochan AI Chat
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          チャットUIを構築中...
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="default">Default Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="destructive">Destructive Button</Button>
          <Button variant="ghost">Ghost Button</Button>
        </div>
      </div>
    </main>
  )
}
