# Phase 5: Next.js フロントエンド実装（詳細版）

**改訂版: 段階的に動作確認できる構成**

**目的:** チャット UI を実装し、Web API と統合（小さく動かしながら進める）

**開始日:** 2025-12-31
**完了日:** 未定

**技術スタック:**
- Next.js 15+ (App Router)
- React 19+
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- ネイティブ EventSource API

**アーキテクチャ方針:**
- **プロジェクト構成**: `packages/web-ui` に Next.js プロジェクト配置（モノレポ内）
- **デプロイ**: Next.js (Vercel) + Express API (Railway)
- **API統合**: ハイブリッド方式（REST は API Routes 経由、SSE は直接接続）
- **状態管理**: React標準（useState）+ TanStack Query
- **UIライブラリ**: shadcn/ui を積極的に使用

---

## 🎯 実装戦略: "動くものを早く作る + テストも同時に書く"

各フェーズで **必ず動作確認** を行い、段階的に機能を追加していきます。
**Phase 5.2 以降は、コンポーネント実装と同時に Storybook とテストも作成します。**

```
Phase 5.1: Next.js 基盤セットアップ → ✅ 完了
Phase 5.2: shadcn/ui + Storybook + テスト環境セットアップ → ✅ 完了
Phase 5.3: 最小限のチャットUI → ✅ 入力・表示できる + Story + Test
Phase 5.4: モック API 統合 → ✅ モックレスポンス受信 + Test
Phase 5.5: Express API 統合（REST） → ✅ E2E 動作 + Test
Phase 5.6: SSE リアルタイム通信 → ✅ ストリーミング受信 + Test
Phase 5.7: 承認ダイアログ実装 → ✅ 承認フロー動作 + Story + Test
Phase 5.8: 最終テスト・品質チェック → ✅ カバレッジ 80%+、型エラーゼロ
```

---

## Phase 5.1: Next.js プロジェクトのセットアップ

**目的:** Next.js の基盤を作り、Hello World を表示

**タスク:**

1. **プロジェクト初期化**
   ```bash
   cd /Users/shomrkm/Repository/shochan_ai
   npx create-next-app@latest
   ```
   - プロジェクト名: `packages/web-ui`
   - TypeScript: Yes
   - ESLint: Yes
   - Tailwind CSS: Yes
   - `src/` directory: No（デフォルトの app/ ディレクトリ構成を使用）
   - App Router: Yes
   - Turbopack: No
   - カスタマイズ import alias: Yes（`@/*`）

2. **環境変数の設定**
   - `packages/web-ui/.env.local` 作成
   ```env
   # Express API URL (サーバーサイド専用)
   BACKEND_URL=http://localhost:3001

   # SSE接続用（クライアント露出OK）
   NEXT_PUBLIC_STREAM_URL=http://localhost:3001
   ```
   - `packages/web-ui/.env.example` 作成
   ```env
   BACKEND_URL=
   NEXT_PUBLIC_STREAM_URL=
   ```

3. **TypeScript パスエイリアス設定**
   - `packages/web-ui/tsconfig.json` で確認（create-next-app で既に設定済み）
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
   ```
   ※ `src/` ディレクトリを使用しないため、`@/*` は `./*` にマッピングされる

4. **シンプルなホームページ作成**
   - `packages/web-ui/app/page.tsx` を編集
   ```typescript
   export default function Home() {
     return (
       <main className="flex min-h-screen flex-col items-center justify-center p-4">
         <div className="w-full max-w-4xl">
           <h1 className="text-4xl font-bold text-center mb-8">
             Shochan AI Chat
           </h1>
           <p className="text-center text-muted-foreground">
             チャットUIを構築中...
           </p>
         </div>
       </main>
     )
   }
   ```

**動作確認:**
```bash
cd packages/web-ui
npm run dev
# ブラウザで http://localhost:3000（または表示されたポート）を開く
# "Shochan AI Chat" が表示されることを確認
```

**完了条件:**
- ✅ `npm run dev` で Next.js が起動する
- ✅ ブラウザで "Shochan AI Chat" が表示される
- ✅ TypeScript エラーがゼロ
- ✅ ESLint エラーがゼロ

---

## Phase 5.2: shadcn/ui + Storybook + テスト環境のセットアップ

**目的:** UI コンポーネントライブラリ、Storybook、テスト環境を導入し、ボタンコンポーネントの Story とテストを作成

**タスク:**

### 1. shadcn/ui セットアップ

```bash
npx shadcn@latest init
```
- スタイル: Default
- ベースカラー: Slate
- CSS変数: Yes

**基本コンポーネントをインストール**
```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add card
```

### 2. Storybook セットアップ

```bash
npx storybook@latest init
```

**Storybook の設定調整**
- `.storybook/main.ts` で TypeScript パスエイリアス対応
- Tailwind CSS がStorybookでも動作するように設定

### 3. Vitest + Testing Library セットアップ

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react jsdom
```

**`vitest.config.ts` 作成**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**`vitest.setup.ts` 作成**
```typescript
import '@testing-library/jest-dom'
```

**`package.json` にスクリプト追加**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

### 4. サンプル実装：Button の Story

**`components/ui/button.stories.tsx` 作成**
```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: {
    children: 'Button',
  },
}

export const Primary: Story = {
  args: {
    children: 'Primary Button',
    variant: 'default',
  },
}

export const Outline: Story = {
  args: {
    children: 'Outline Button',
    variant: 'outline',
  },
}
```

**Note:** 基本的なUIコンポーネント（Button等）のユニットテストは不要です。Storybookによるvisual testingで十分対応可能です。

**追加コンポーネントのStorybook作成**

Phase 5.3以降で使用するコンポーネントのStorybookも作成しておきます：

- `components/ui/input.stories.tsx` - Input コンポーネント（7つのストーリー）
- `components/ui/textarea.stories.tsx` - Textarea コンポーネント（6つのストーリー）
- `components/ui/card.stories.tsx` - Card コンポーネント（5つのストーリー）

### 5. ホームページにボタンを追加

**`app/page.tsx` を更新**
```typescript
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-4xl p-8">
        <h1 className="text-4xl font-bold text-center mb-8">
          Shochan AI Chat
        </h1>
        <div className="flex justify-center gap-4">
          <Button>デフォルトボタン</Button>
          <Button variant="outline">アウトラインボタン</Button>
        </div>
      </Card>
    </main>
  )
}
```

**動作確認:**
```bash
# 開発サーバー起動
npm run dev
# → http://localhost:3000 でボタンが表示されることを確認

# Storybook 起動
npm run storybook
# → http://localhost:6006 で Button のストーリーが表示されることを確認
```

**完了条件:**
- ✅ shadcn/ui がインストールされ、ボタンが表示される
- ✅ Storybook が起動し、Button, Input, Textarea, Card のストーリーが表示される
- ✅ Vitest でテスト環境が構築されている（基本コンポーネントのテストは不要）
- ✅ TypeScript エラーがゼロ
- ✅ 全コンポーネントのStorybookが整備されている

**実装完了日:** 2025-12-31

---

## Phase 5.3: 最小限のチャットUI（モック版）

**目的:** ローカル状態のみで、メッセージ入力・表示を実装

**タスク:**

1. **型定義を作成**
   - `types/chat.ts` 作成
   ```typescript
   export interface Message {
     id: string
     type: 'user' | 'agent' | 'system'
     content: string
     timestamp: number
   }
   ```

2. **MessageInput コンポーネント作成**
   - `components/chat/message-input.tsx`
   ```typescript
   'use client'

   import { useState } from 'react'
   import { Button } from '@/components/ui/button'
   import { Textarea } from '@/components/ui/textarea'

   interface MessageInputProps {
     onSend: (message: string) => void
     disabled?: boolean
   }

   export function MessageInput({ onSend, disabled }: MessageInputProps) {
     const [input, setInput] = useState('')

     const handleSend = () => {
       if (!input.trim()) return
       onSend(input)
       setInput('')
     }

     const handleKeyDown = (e: React.KeyboardEvent) => {
       if (e.key === 'Enter' && !e.shiftKey) {
         e.preventDefault()
         handleSend()
       }
     }

     return (
       <div className="flex gap-2">
         <Textarea
           value={input}
           onChange={(e) => setInput(e.target.value)}
           onKeyDown={handleKeyDown}
           placeholder="メッセージを入力..."
           disabled={disabled}
           className="min-h-[60px]"
         />
         <Button onClick={handleSend} disabled={disabled || !input.trim()}>
           送信
         </Button>
       </div>
     )
   }
   ```

3. **MessageList コンポーネント作成**
   - `components/chat/message-list.tsx`
   ```typescript
   import type { Message } from '@/types/chat'
   import { Card } from '@/components/ui/card'

   interface MessageListProps {
     messages: Message[]
   }

   export function MessageList({ messages }: MessageListProps) {
     if (messages.length === 0) {
       return (
         <div className="text-center text-muted-foreground p-8">
           メッセージがありません
         </div>
       )
     }

     return (
       <div className="space-y-4">
         {messages.map((message) => (
           <Card key={message.id} className="p-4">
             <div className="flex justify-between items-start mb-2">
               <span className="font-semibold">
                 {message.type === 'user' ? 'あなた' : 'エージェント'}
               </span>
               <span className="text-xs text-muted-foreground">
                 {new Date(message.timestamp).toLocaleTimeString()}
               </span>
             </div>
             <p className="whitespace-pre-wrap">{message.content}</p>
           </Card>
         ))}
       </div>
     )
   }
   ```

4. **ChatInterface コンポーネント作成**
   - `components/chat/chat-interface.tsx`
   ```typescript
   'use client'

   import { useState } from 'react'
   import { Card } from '@/components/ui/card'
   import { MessageList } from './message-list'
   import { MessageInput } from './message-input'
   import type { Message } from '@/types/chat'

   export function ChatInterface() {
     const [messages, setMessages] = useState<Message[]>([])

     const handleSend = (content: string) => {
       // ユーザーメッセージを追加
       const userMessage: Message = {
         id: `user-${Date.now()}`,
         type: 'user',
         content,
         timestamp: Date.now(),
       }
       setMessages((prev) => [...prev, userMessage])

       // モックの応答（1秒後）
       setTimeout(() => {
         const agentMessage: Message = {
           id: `agent-${Date.now()}`,
           type: 'agent',
           content: `受信しました: "${content}"`,
           timestamp: Date.now(),
         }
         setMessages((prev) => [...prev, agentMessage])
       }, 1000)
     }

     return (
       <Card className="w-full h-full flex flex-col p-4">
         <h2 className="text-2xl font-bold mb-4">チャット</h2>
         <div className="flex-1 overflow-y-auto mb-4">
           <MessageList messages={messages} />
         </div>
         <MessageInput onSend={handleSend} />
       </Card>
     )
   }
   ```

5. **ホームページを更新**
   - `app/page.tsx`
   ```typescript
   import { ChatInterface } from '@/components/chat/chat-interface'

   export default function Home() {
     return (
       <main className="flex min-h-screen flex-col items-center justify-center p-4">
         <div className="w-full max-w-4xl h-[80vh]">
           <ChatInterface />
         </div>
       </main>
     )
   }
   ```

6. **Storybook の追加**

   **`components/chat/message-input.stories.tsx` 作成**
   ```typescript
   import type { Meta, StoryObj } from '@storybook/react'
   import { MessageInput } from './message-input'

   const meta: Meta<typeof MessageInput> = {
     title: 'Chat/MessageInput',
     component: MessageInput,
     tags: ['autodocs'],
   }

   export default meta
   type Story = StoryObj<typeof MessageInput>

   export const Default: Story = {
     args: {
       onSend: (message) => console.log('Send:', message),
     },
   }

   export const Disabled: Story = {
     args: {
       onSend: (message) => console.log('Send:', message),
       disabled: true,
     },
   }
   ```

   **`components/chat/message-list.stories.tsx` 作成**
   ```typescript
   import type { Meta, StoryObj } from '@storybook/react'
   import { MessageList } from './message-list'

   const meta: Meta<typeof MessageList> = {
     title: 'Chat/MessageList',
     component: MessageList,
     tags: ['autodocs'],
   }

   export default meta
   type Story = StoryObj<typeof MessageList>

   export const Empty: Story = {
     args: {
       messages: [],
     },
   }

   export const WithMessages: Story = {
     args: {
       messages: [
         {
           id: '1',
           type: 'user',
           content: 'こんにちは',
           timestamp: Date.now() - 60000,
         },
         {
           id: '2',
           type: 'agent',
           content: 'こんにちは！何かお手伝いできることはありますか？',
           timestamp: Date.now() - 30000,
         },
       ],
     },
   }
   ```

7. **テストの追加**

   **`components/chat/message-input.test.tsx` 作成**
   ```typescript
   import { describe, it, expect, vi } from 'vitest'
   import { render, screen } from '@testing-library/react'
   import userEvent from '@testing-library/user-event'
   import { MessageInput } from './message-input'

   describe('MessageInput', () => {
     it('renders textarea and send button', () => {
       render(<MessageInput onSend={vi.fn()} />)
       expect(screen.getByPlaceholderText('メッセージを入力...')).toBeInTheDocument()
       expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
     })

     it('calls onSend with input value when send button is clicked', async () => {
       const handleSend = vi.fn()
       render(<MessageInput onSend={handleSend} />)

       await userEvent.type(screen.getByRole('textbox'), 'Hello')
       await userEvent.click(screen.getByRole('button', { name: '送信' }))

       expect(handleSend).toHaveBeenCalledWith('Hello')
     })

     it('clears input after sending', async () => {
       render(<MessageInput onSend={vi.fn()} />)

       const textarea = screen.getByRole('textbox')
       await userEvent.type(textarea, 'Hello')
       await userEvent.click(screen.getByRole('button', { name: '送信' }))

       expect(textarea).toHaveValue('')
     })

     it('disables send button when input is empty', () => {
       render(<MessageInput onSend={vi.fn()} />)
       expect(screen.getByRole('button', { name: '送信' })).toBeDisabled()
     })
   })
   ```

   **`components/chat/message-list.test.tsx` 作成**
   ```typescript
   import { describe, it, expect } from 'vitest'
   import { render, screen } from '@testing-library/react'
   import { MessageList } from './message-list'

   describe('MessageList', () => {
     it('shows empty state when no messages', () => {
       render(<MessageList messages={[]} />)
       expect(screen.getByText('メッセージがありません')).toBeInTheDocument()
     })

     it('renders messages correctly', () => {
       const messages = [
         { id: '1', type: 'user' as const, content: 'Hello', timestamp: Date.now() },
         { id: '2', type: 'agent' as const, content: 'Hi!', timestamp: Date.now() },
       ]
       render(<MessageList messages={messages} />)

       expect(screen.getByText('Hello')).toBeInTheDocument()
       expect(screen.getByText('Hi!')).toBeInTheDocument()
     })
   })
   ```

**動作確認:**
```bash
# 開発サーバー起動
npm run dev
# → メッセージを入力して送信
# → ユーザーメッセージが表示される
# → 1秒後にモックの応答が表示される

# Storybook 起動
npm run storybook
# → MessageInput と MessageList のストーリーが表示されることを確認

# テスト実行
npm test
# → 全てのテストがパスすることを確認
```

**完了条件:**
- ✅ メッセージを入力できる
- ✅ 送信ボタンで送信できる
- ✅ Enter キーで送信できる（Shift+Enter で改行）
- ✅ メッセージが一覧表示される
- ✅ モックの応答が1秒後に表示される
- ✅ Storybook で MessageInput と MessageList が表示される
- ✅ テストが全てパスする

---

## Phase 5.4: TanStack Query とモック API 統合

**目的:** データフェッチライブラリを導入し、モック API と統合

**タスク:**

1. **TanStack Query インストール**
   ```bash
   npm install @tanstack/react-query
   npm install -D @tanstack/react-query-devtools
   ```

2. **Providers セットアップ**
   - `app/providers.tsx` 作成
   ```typescript
   'use client'

   import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
   import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
   import { useState } from 'react'

   export function Providers({ children }: { children: React.ReactNode }) {
     const [queryClient] = useState(
       () =>
         new QueryClient({
           defaultOptions: {
             queries: {
               staleTime: 60 * 1000,
               refetchOnWindowFocus: false,
             },
           },
         })
     )

     return (
       <QueryClientProvider client={queryClient}>
         {children}
         <ReactQueryDevtools initialIsOpen={false} />
       </QueryClientProvider>
     )
   }
   ```

   - `app/layout.tsx` に Provider を追加
   ```typescript
   import { Providers } from './providers'

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <html lang="ja">
         <body>
           <Providers>{children}</Providers>
         </body>
       </html>
     )
   }
   ```

3. **モック API Route 作成**
   - `app/api/agent/query/route.ts`
   ```typescript
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

       // モックレスポンス
       await new Promise((resolve) => setTimeout(resolve, 500))

       return NextResponse.json({
         conversationId: `mock-${Date.now()}`,
       })
     } catch (error) {
       return NextResponse.json(
         { error: 'Internal server error' },
         { status: 500 }
       )
     }
   }
   ```

4. **API クライアント作成**
   - `lib/api-client.ts`
   ```typescript
   export async function sendMessage(message: string) {
     const response = await fetch('/api/agent/query', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ message }),
     })
     if (!response.ok) throw new Error('Failed to send message')
     return response.json()
   }
   ```

5. **ChatInterface を更新（TanStack Query 使用）**
   - `components/chat/chat-interface.tsx`
   ```typescript
   'use client'

   import { useState } from 'react'
   import { useMutation } from '@tanstack/react-query'
   import { Card } from '@/components/ui/card'
   import { MessageList } from './message-list'
   import { MessageInput } from './message-input'
   import { sendMessage } from '@/lib/api-client'
   import type { Message } from '@/types/chat'

   export function ChatInterface() {
     const [messages, setMessages] = useState<Message[]>([])
     const [conversationId, setConversationId] = useState<string | null>(null)

     const sendMutation = useMutation({
       mutationFn: sendMessage,
       onMutate: (message) => {
         // 楽観的更新
         const userMessage: Message = {
           id: `user-${Date.now()}`,
           type: 'user',
           content: message,
           timestamp: Date.now(),
         }
         setMessages((prev) => [...prev, userMessage])
       },
       onSuccess: (data) => {
         setConversationId(data.conversationId)
         console.log('Conversation ID:', data.conversationId)
       },
     })

     return (
       <Card className="w-full h-full flex flex-col p-4">
         <div className="flex justify-between items-center mb-4">
           <h2 className="text-2xl font-bold">チャット</h2>
           {conversationId && (
             <span className="text-xs text-muted-foreground">
               ID: {conversationId}
             </span>
           )}
         </div>
         <div className="flex-1 overflow-y-auto mb-4">
           <MessageList messages={messages} />
         </div>
         <MessageInput
           onSend={(msg) => sendMutation.mutate(msg)}
           disabled={sendMutation.isPending}
         />
       </Card>
     )
   }
   ```

**動作確認:**
```bash
npm run dev
# メッセージを送信
# conversationId が表示されることを確認
# React Query DevTools を開いて mutation を確認
```

**完了条件:**
- ✅ TanStack Query が動作する
- ✅ DevTools が表示される
- ✅ モック API からレスポンスを受信できる
- ✅ conversationId が画面に表示される

---

## Phase 5.5: Express API との統合

**目的:** 実際の Express API に接続し、E2E で動作確認

**タスク:**

1. **API Route を Express に接続**
   - `app/api/agent/query/route.ts` を更新
   ```typescript
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

       // Express API に接続
       const response = await fetch(
         `${process.env.BACKEND_URL}/api/agent/query`,
         {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ message }),
         }
       )

       if (!response.ok) {
         throw new Error('Backend API error')
       }

       const data = await response.json()
       return NextResponse.json(data)
     } catch (error) {
       console.error('Error:', error)
       return NextResponse.json(
         { error: 'Internal server error' },
         { status: 500 }
       )
     }
   }
   ```

2. **Express API と Redis を起動**
   ```bash
   # Terminal 1: Redis
   docker compose up -d

   # Terminal 2: Express API
   pnpm dev:web

   # Terminal 3: Next.js
   npm run dev
   ```

**動作確認:**
```bash
# Express API が起動していることを確認
curl http://localhost:3001/health

# Next.js からメッセージを送信
# 実際の conversationId が返されることを確認
```

**完了条件:**
- ✅ Express API に接続できる
- ✅ 実際の conversationId が返される
- ✅ Redis にデータが保存される

---

## Phase 5.6: SSE でリアルタイム通信

**目的:** SSE を実装し、リアルタイムでイベントを受信

**タスク:**

1. **型定義を追加**
   - `types/chat.ts` に追加
   ```typescript
   import type { Event, ToolCall } from '@shochan_ai/core'

   export type { Event, ToolCall }

   // 既存の Message 型を拡張
   export interface Message {
     id: string
     type: 'user' | 'agent' | 'system' | 'tool_call' | 'tool_response'
     content: string
     timestamp: number
     toolCall?: ToolCall
   }
   ```

2. **SSE クライアント実装**
   - `lib/sse-client.ts` 作成
   ```typescript
   import type { Event } from '@/types/chat'

   export class SSEClient {
     private eventSource: EventSource | null = null

     connect(
       conversationId: string,
       onEvent: (event: Event) => void,
       onError?: (error: Error) => void
     ) {
       const url = `${process.env.NEXT_PUBLIC_STREAM_URL}/api/stream/${conversationId}`
       this.eventSource = new EventSource(url)

       this.eventSource.onopen = () => {
         console.log('✅ SSE connected')
       }

       this.eventSource.onmessage = (event) => {
         try {
           const data = JSON.parse(event.data) as Event
           console.log('📨 SSE Event:', data.type)
           onEvent(data)
         } catch (error) {
           console.error('Failed to parse SSE event:', error)
           onError?.(error as Error)
         }
       }

       this.eventSource.onerror = () => {
         console.error('❌ SSE error')
         this.disconnect()
         onError?.(new Error('SSE connection error'))
       }
     }

     disconnect() {
       if (this.eventSource) {
         this.eventSource.close()
         this.eventSource = null
         console.log('🔌 SSE disconnected')
       }
     }
   }
   ```

3. **useSSE フック作成**
   - `hooks/use-sse.ts`
   ```typescript
   import { useEffect, useRef } from 'react'
   import { SSEClient } from '@/lib/sse-client'
   import type { Event } from '@/types/chat'

   export function useSSE(
     conversationId: string | null,
     onEvent: (event: Event) => void
   ) {
     const clientRef = useRef<SSEClient | null>(null)

     useEffect(() => {
       if (!conversationId) return

       clientRef.current = new SSEClient()
       clientRef.current.connect(conversationId, onEvent)

       return () => {
         clientRef.current?.disconnect()
       }
     }, [conversationId, onEvent])
   }
   ```

4. **ChatInterface を更新（SSE対応）**
   - `components/chat/chat-interface.tsx`
   ```typescript
   'use client'

   import { useState, useCallback } from 'react'
   import { useMutation } from '@tanstack/react-query'
   import { Card } from '@/components/ui/card'
   import { Badge } from '@/components/ui/badge'
   import { MessageList } from './message-list'
   import { MessageInput } from './message-input'
   import { sendMessage } from '@/lib/api-client'
   import { useSSE } from '@/hooks/use-sse'
   import type { Message, Event } from '@/types/chat'

   export function ChatInterface() {
     const [messages, setMessages] = useState<Message[]>([])
     const [conversationId, setConversationId] = useState<string | null>(null)

     const sendMutation = useMutation({
       mutationFn: sendMessage,
       onMutate: (message) => {
         const userMessage: Message = {
           id: `user-${Date.now()}`,
           type: 'user',
           content: message,
           timestamp: Date.now(),
         }
         setMessages((prev) => [...prev, userMessage])
       },
       onSuccess: (data) => {
         setConversationId(data.conversationId)
       },
     })

     const handleSSEEvent = useCallback((event: Event) => {
       switch (event.type) {
         case 'tool_call':
           setMessages((prev) => [
             ...prev,
             {
               id: `tool-call-${event.timestamp}`,
               type: 'tool_call',
               content: `🔧 ツール呼び出し: ${event.data.intent}`,
               timestamp: event.timestamp,
               toolCall: event.data,
             },
           ])
           break

         case 'tool_response':
           setMessages((prev) => [
             ...prev,
             {
               id: `tool-response-${event.timestamp}`,
               type: 'tool_response',
               content: JSON.stringify(event.data, null, 2),
               timestamp: event.timestamp,
             },
           ])
           break

         case 'complete':
           setMessages((prev) => [
             ...prev,
             {
               id: `complete-${event.timestamp}`,
               type: 'system',
               content: '✅ 処理が完了しました',
               timestamp: event.timestamp,
             },
           ])
           break

         case 'error':
           setMessages((prev) => [
             ...prev,
             {
               id: `error-${event.timestamp}`,
               type: 'system',
               content: `❌ エラー: ${event.data.error}`,
               timestamp: event.timestamp,
             },
           ])
           break
       }
     }, [])

     useSSE(conversationId, handleSSEEvent)

     return (
       <Card className="w-full h-full flex flex-col p-4">
         <div className="flex justify-between items-center mb-4">
           <h2 className="text-2xl font-bold">チャット</h2>
           {conversationId && (
             <Badge variant="outline">接続中</Badge>
           )}
         </div>
         <div className="flex-1 overflow-y-auto mb-4">
           <MessageList messages={messages} />
         </div>
         <MessageInput
           onSend={(msg) => sendMutation.mutate(msg)}
           disabled={sendMutation.isPending}
         />
       </Card>
     )
   }
   ```

**動作確認:**
```bash
# Express API, Redis, Next.js を起動
# メッセージを送信
# SSE でリアルタイムにイベントが表示されることを確認
# DevTools Console で SSE ログを確認
```

**完了条件:**
- ✅ SSE 接続が確立される
- ✅ tool_call イベントが表示される
- ✅ tool_response イベントが表示される
- ✅ complete イベントが表示される
- ✅ Console でSSEログが確認できる

---

## Phase 5.7: 承認ダイアログ実装

**目的:** delete_task の承認フローを UI で完結させる

**タスク:**

1. **shadcn/ui コンポーネント追加**
   ```bash
   npx shadcn@latest add alert-dialog
   npx shadcn@latest add toast
   ```

2. **承認 API クライアント追加**
   - `lib/api-client.ts` に追加
   ```typescript
   export async function approveToolCall(
     conversationId: string,
     approved: boolean
   ) {
     const response = await fetch(`/api/agent/approve/${conversationId}`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ approved }),
     })
     if (!response.ok) throw new Error('Failed to approve')
     return response.json()
   }
   ```

3. **承認 API Route 作成**
   - `app/api/agent/approve/[conversationId]/route.ts`
   ```typescript
   import { NextRequest, NextResponse } from 'next/server'

   export async function POST(
     request: NextRequest,
     { params }: { params: { conversationId: string } }
   ) {
     try {
       const { conversationId } = params
       const body = await request.json()
       const { approved } = body

       const response = await fetch(
         `${process.env.BACKEND_URL}/api/agent/approve/${conversationId}`,
         {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ approved }),
         }
       )

       if (!response.ok) throw new Error('Backend API error')

       const data = await response.json()
       return NextResponse.json(data)
     } catch (error) {
       console.error('Error:', error)
       return NextResponse.json(
         { error: 'Internal server error' },
         { status: 500 }
       )
     }
   }
   ```

4. **ApprovalDialog コンポーネント作成**
   - `components/chat/approval-dialog.tsx`
   ```typescript
   import {
     AlertDialog,
     AlertDialogAction,
     AlertDialogCancel,
     AlertDialogContent,
     AlertDialogDescription,
     AlertDialogFooter,
     AlertDialogHeader,
     AlertDialogTitle,
   } from '@/components/ui/alert-dialog'
   import type { ToolCall } from '@/types/chat'

   interface ApprovalDialogProps {
     toolCall: ToolCall | null
     onApprove: () => void
     onReject: () => void
   }

   export function ApprovalDialog({
     toolCall,
     onApprove,
     onReject,
   }: ApprovalDialogProps) {
     if (!toolCall) return null

     return (
       <AlertDialog open={!!toolCall}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>承認が必要です</AlertDialogTitle>
             <AlertDialogDescription>
               以下の操作を実行してもよろしいですか？
             </AlertDialogDescription>
           </AlertDialogHeader>
           <div className="my-4 p-4 bg-muted rounded-md">
             <p className="font-semibold mb-2">ツール: {toolCall.intent}</p>
             <pre className="text-sm">
               {JSON.stringify(toolCall.parameters, null, 2)}
             </pre>
           </div>
           <AlertDialogFooter>
             <AlertDialogCancel onClick={onReject}>
               キャンセル
             </AlertDialogCancel>
             <AlertDialogAction onClick={onApprove}>
               承認
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     )
   }
   ```

5. **ChatInterface に承認フローを追加**
   - `components/chat/chat-interface.tsx` を更新
   ```typescript
   // ... 既存のimport
   import { ApprovalDialog } from './approval-dialog'
   import { useToast } from '@/components/ui/use-toast'
   import { approveToolCall } from '@/lib/api-client'

   export function ChatInterface() {
     // ... 既存の state
     const [awaitingApproval, setAwaitingApproval] = useState<ToolCall | null>(null)
     const { toast } = useToast()

     // ... 既存の mutation

     const approveMutation = useMutation({
       mutationFn: ({ conversationId, approved }: { conversationId: string; approved: boolean }) =>
         approveToolCall(conversationId, approved),
       onSuccess: () => {
         setAwaitingApproval(null)
         toast({
           title: '承認しました',
           description: '処理を再開します',
         })
       },
       onError: () => {
         toast({
           variant: 'destructive',
           title: 'エラー',
           description: '承認処理に失敗しました',
         })
       },
     })

     const handleSSEEvent = useCallback((event: Event) => {
       switch (event.type) {
         // ... 既存のcase

         case 'awaiting_approval':
           setAwaitingApproval(event.data)
           break
       }
     }, [])

     const handleApprove = () => {
       if (conversationId) {
         approveMutation.mutate({ conversationId, approved: true })
       }
     }

     const handleReject = () => {
       if (conversationId) {
         approveMutation.mutate({ conversationId, approved: false })
       }
     }

     // ... 既存のSSE

     return (
       <>
         <Card className="w-full h-full flex flex-col p-4">
           {/* ... 既存のUI */}
         </Card>
         <ApprovalDialog
           toolCall={awaitingApproval}
           onApprove={handleApprove}
           onReject={handleReject}
         />
       </>
     )
   }
   ```

6. **Toast Provider を追加**
   - `app/layout.tsx` に追加
   ```typescript
   import { Toaster } from '@/components/ui/toaster'

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <html lang="ja">
         <body>
           <Providers>
             {children}
             <Toaster />
           </Providers>
         </body>
       </html>
     )
   }
   ```

7. **Storybook の追加**

   **`components/chat/approval-dialog.stories.tsx` 作成**
   ```typescript
   import type { Meta, StoryObj } from '@storybook/react'
   import { ApprovalDialog } from './approval-dialog'

   const meta: Meta<typeof ApprovalDialog> = {
     title: 'Chat/ApprovalDialog',
     component: ApprovalDialog,
     tags: ['autodocs'],
   }

   export default meta
   type Story = StoryObj<typeof ApprovalDialog>

   export const DeleteTask: Story = {
     args: {
       toolCall: {
         intent: 'delete_task',
         parameters: {
           taskId: 'task-123',
           taskName: 'テストタスク',
         },
       },
       onApprove: () => console.log('Approved'),
       onReject: () => console.log('Rejected'),
     },
   }

   export const CreateProject: Story = {
     args: {
       toolCall: {
         intent: 'create_project',
         parameters: {
           name: '新規プロジェクト',
           description: 'プロジェクトの説明',
         },
       },
       onApprove: () => console.log('Approved'),
       onReject: () => console.log('Rejected'),
     },
   }

   export const NoToolCall: Story = {
     args: {
       toolCall: null,
       onApprove: () => console.log('Approved'),
       onReject: () => console.log('Rejected'),
     },
   }
   ```

8. **テストの追加**

   **`components/chat/approval-dialog.test.tsx` 作成**
   ```typescript
   import { describe, it, expect, vi } from 'vitest'
   import { render, screen } from '@testing-library/react'
   import userEvent from '@testing-library/user-event'
   import { ApprovalDialog } from './approval-dialog'

   describe('ApprovalDialog', () => {
     const mockToolCall = {
       intent: 'delete_task',
       parameters: {
         taskId: 'task-123',
         taskName: 'テストタスク',
       },
     }

     it('does not render when toolCall is null', () => {
       const { container } = render(
         <ApprovalDialog
           toolCall={null}
           onApprove={vi.fn()}
           onReject={vi.fn()}
         />
       )
       expect(container).toBeEmptyDOMElement()
     })

     it('renders dialog when toolCall is provided', () => {
       render(
         <ApprovalDialog
           toolCall={mockToolCall}
           onApprove={vi.fn()}
           onReject={vi.fn()}
         />
       )

       expect(screen.getByText('承認が必要です')).toBeInTheDocument()
       expect(screen.getByText(/delete_task/)).toBeInTheDocument()
     })

     it('calls onApprove when approve button is clicked', async () => {
       const handleApprove = vi.fn()
       render(
         <ApprovalDialog
           toolCall={mockToolCall}
           onApprove={handleApprove}
           onReject={vi.fn()}
         />
       )

       await userEvent.click(screen.getByRole('button', { name: '承認' }))
       expect(handleApprove).toHaveBeenCalledOnce()
     })

     it('calls onReject when cancel button is clicked', async () => {
       const handleReject = vi.fn()
       render(
         <ApprovalDialog
           toolCall={mockToolCall}
           onApprove={vi.fn()}
           onReject={handleReject}
         />
       )

       await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
       expect(handleReject).toHaveBeenCalledOnce()
     })
   })
   ```

**動作確認:**
```bash
# 開発サーバー起動
npm run dev
# → "タスクを削除して" などのメッセージを送信
# → 承認ダイアログが表示されることを確認
# → 承認/拒否ボタンが動作することを確認

# Storybook 起動
npm run storybook
# → ApprovalDialog のストーリーが表示されることを確認

# テスト実行
npm test
# → ApprovalDialog のテストがパスすることを確認
```

**完了条件:**
- ✅ awaiting_approval イベントでダイアログが表示される
- ✅ 承認ボタンで処理が再開される
- ✅ キャンセルボタンで処理が中断される
- ✅ Toast 通知が表示される
- ✅ Storybook で ApprovalDialog が表示される
- ✅ テストが全てパスする

---

## Phase 5.8: 最終テスト・品質チェック

**目的:** 全体の品質を確認し、本番デプロイの準備を整える

**タスク:**

1. **テストカバレッジの確認**
   ```bash
   npm run test:coverage
   ```
   - 目標: カバレッジ 80% 以上
   - カバレッジが低い箇所があれば追加テストを作成

2. **型チェック**
   ```bash
   npx tsc --noEmit
   ```
   - TypeScript エラーがゼロであることを確認

3. **ESLint チェック**
   ```bash
   npm run lint
   ```
   - ESLint エラー・警告がゼロであることを確認

4. **E2E シナリオテスト（手動）**
   - ✅ メッセージ送信 → レスポンス受信
   - ✅ SSE ストリーミング動作
   - ✅ ツール承認フロー（承認・拒否）
   - ✅ エラーハンドリング（ネットワークエラー、API エラー）
   - ✅ レスポンシブデザイン確認

5. **Storybook ビルドテスト**
   ```bash
   npm run build-storybook
   ```
   - Storybook がビルドエラーなく完成することを確認

6. **本番ビルドテスト**
   ```bash
   npm run build
   npm run start
   ```
   - 本番ビルドが成功することを確認
   - 起動して動作確認

7. **パフォーマンスチェック**
   - Chrome DevTools の Lighthouse で計測
   - Performance スコア 80+ を目標
   - アクセシビリティスコア 90+ を目標

8. **ドキュメント整備**
   - README に開発・テスト・デプロイ手順を記載
   - 環境変数の説明を `.env.example` に記載

**完了条件:**
- ✅ テストカバレッジ 80% 以上
- ✅ TypeScript エラーゼロ
- ✅ ESLint エラー・警告ゼロ
- ✅ 全ての E2E シナリオが動作
- ✅ Storybook ビルド成功
- ✅ 本番ビルド成功
- ✅ Lighthouse スコア目標達成
- ✅ ドキュメント整備完了

---

**Phase 5 全体の所要時間:** 7-10日（予定）
