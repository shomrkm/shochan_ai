# AIエージェントレスポンスのリアルタイムストリーミング実装計画

## 目次

1. [概要](#概要)
2. [実現したいこと](#実現したいこと)
3. [技術的背景](#技術的背景)
4. [アーキテクチャ設計](#アーキテクチャ設計)
5. [実装ステップ](#実装ステップ)
6. [テスト計画](#テスト計画)
7. [リスクと対策](#リスクと対策)

---

## 概要

### 実現したい機能

**ChatGPTやClaudeのように、AIエージェントのレスポンスがリアルタイムで1文字ずつ表示される機能を実装します。**

現在、Shochan AIエージェントはツールコール（タスク作成、取得など）を実行した後、最終的なユーザー向けメッセージを返します。この最終メッセージを、LLMがトークンを生成すると同時にブラウザに表示することで、応答性の高いUXを実現します。

### なぜ必要か

| 現在の動作 | 望ましい動作 |
|-----------|------------|
| ユーザーが待機 → LLM生成完了 → 一度に全文表示 | ユーザーが待機 → LLM生成開始 → **即座に**1トークンずつ表示 |
| **Time to First Token (TTFT)**: 遅い | **TTFT**: 数百ミリ秒 |
| ユーザー体験: 「固まっている？」 | ユーザー体験: 「処理中だとわかる」 |

---

## 実現したいこと

### ユーザー視点での動作

```
[ユーザー] タスクを作成して
    ↓
[システム] 🔧 Tool call: create_task
[システム] ✅ Tool executed: create_task
    ↓
[エージェント] タ... (即座に表示開始)
[エージェント] タスク...
[エージェント] タスクを作...
[エージェント] タスクを作成しま...
[エージェント] タスクを作成しました。 (完成)
```

**ポイント**: エージェントの最終メッセージが**リアルタイムで**少しずつ表示される

### 技術的目標

1. **リアルタイムストリーミング**
   - LLMのトークン生成と同時にフロントエンドへ送信
   - Server-Sent Events (SSE) を使用

2. **Time to First Token (TTFT) の最小化**
   - 最初のトークンが数百ミリ秒以内に表示開始
   - ユーザーは即座に「処理中」を認識

3. **効率的なAPI使用**
   - 1回のLLM呼び出しで完結
   - ツールコールとテキスト生成を統合処理

4. **既存機能との統合**
   - ツールコール（create_task, get_tasksなど）は非ストリーミング
   - 最終メッセージ（done_for_now, request_more_information）のみストリーミング

---

## 技術的背景

### Shochan AI のアーキテクチャ

```
┌─────────────┐
│   Web UI    │ (React + Next.js, port 3002)
│ (Frontend)  │
└──────┬──────┘
       │ HTTP POST /api/agent/query
       │ SSE GET /api/stream/:id
       ↓
┌──────────────┐
│  Express API │ (Node.js + TypeScript, port 3001)
│  (Backend)   │
└──────┬───────┘
       │
       ├─→ Redis (会話状態の永続化)
       │
       └─→ OpenAI Responses API (LLM呼び出し)
```

### 使用技術

- **OpenAI Responses API**: Function Calling + ストリーミング対応
- **Server-Sent Events (SSE)**: サーバーからクライアントへのリアルタイム通信
- **better-sse**: Express用のSSEライブラリ
- **Redis**: 会話状態の永続化

### OpenAI Responses API のストリーミングモード

OpenAI Responses APIは`stream: true`オプションで以下のイベントを送信します：

| イベントタイプ | 説明 | Shochan AI での用途 |
|--------------|------|-------------------|
| `response.function_call` | Function Call (ツールコール) 検出 | ツール実行判定 |
| `response.output_text.delta` | テキストトークン（1トークンずつ） | UIへリアルタイム表示 |
| `response.done` | ストリーム完了 | 処理終了判定 |
| `error` | エラー | エラーハンドリング |

---

## アーキテクチャ設計

### 全体フロー

```
┌──────────┐
│  ユーザー  │ 「タスクを作成して」
└─────┬────┘
      │ (1) POST /api/agent/query
      ↓
┌─────────────────┐
│  Express API    │ conversationId を即座に返却
└─────┬───────────┘
      │ (2) バックグラウンド処理開始
      ↓
┌─────────────────┐
│  processAgent   │
└─────┬───────────┘
      │ (3) SSE接続待機 (500ms)
      ↓
┌─────────────────────────────────┐
│ OpenAI Responses API            │
│ (stream: true)                  │
└─────┬───────────────────────────┘
      │
      ├─→ event: response.function_call
      │   → tool_call: create_task (ツールコールイベント送信)
      │
      │   [ツール実行: NotionToolExecutor]
      │   → tool_response イベント送信
      │
      ├─→ event: response.function_call
      │   → tool_call: done_for_now
      │
      └─→ event: response.output_text.delta (x N回)
          → text_chunk イベント送信 (リアルタイム)
          「タ」「スク」「を」「作成」「しま」「した」「。」
            ↓ SSE
      ┌─────────────┐
      │   Web UI    │ リアルタイム表示更新
      └─────────────┘
```

### イベントフロー詳細

#### 1. ユーザー入力からSSE接続まで

```typescript
// 1. フロントエンド: メッセージ送信
POST /api/agent/query
Body: { message: "タスクを作成して" }

// 2. Express API: 即座にレスポンス
Response: { conversationId: "uuid-xxx" }

// 3. フロントエンド: SSE接続確立
GET /api/stream/uuid-xxx
Accept: text/event-stream

// 4. Express API: バックグラウンドで processAgent 開始
processAgent(conversationId)
```

#### 2. LLMストリーミング処理

```typescript
// OpenAI Responses API にストリーミングリクエスト
const stream = await openai.responses.create({
  model: 'gpt-4o',
  instructions: systemPrompt,
  input: inputMessages,
  tools: [create_task, get_tasks, ...],
  stream: true, // ストリーミングモード
});

// イベントループでリアルタイム処理
for await (const event of stream) {
  if (event.type === 'response.function_call') {
    // ツールコール検出
    // → tool_call イベントを SSE 送信
  }

  if (event.type === 'response.output_text.delta') {
    // テキストトークン受信
    // → text_chunk イベントを SSE 送信（リアルタイム）
  }
}
```

#### 3. SSE イベント送信

```typescript
// tool_call イベント
streamManager.send(conversationId, {
  type: 'tool_call',
  data: { intent: 'create_task', parameters: {...} }
});

// text_chunk イベント（リアルタイム）
streamManager.send(conversationId, {
  type: 'text_chunk',
  data: { content: 'タ', messageId: 'msg-123' }
});
streamManager.send(conversationId, {
  type: 'text_chunk',
  data: { content: 'スク', messageId: 'msg-123' }
});
// ... 続く
```

#### 4. フロントエンド表示更新

```typescript
// SSE イベント受信
handleSSEEvent(event) {
  if (event.type === 'text_chunk') {
    // メッセージを累積更新
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage.id === event.data.messageId) {
        // 既存メッセージに追記
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: lastMessage.content + event.data.content }
        ];
      }
      // 新規メッセージ作成
      return [...prev, { id: event.data.messageId, content: event.data.content }];
    });
  }
}
```

### イベントタイプマッピング

| OpenAI Responses API | Shochan AI Event | データ構造 |
|---------------------|------------------|----------|
| `response.function_call` | `tool_call` | `{ type: 'tool_call', data: ToolCall }` |
| `response.output_text.delta` | `text_chunk` | `{ type: 'text_chunk', data: { content: string, messageId: string } }` |
| `error` | `error` | `{ type: 'error', data: { error: string, code: string } }` |

---

## 実装ステップ

### Phase 0: 事前準備

**現在のコード状態を確認**

```bash
git status
# すべてのファイルがクリーンな状態であることを確認
```

### Phase 1: Core 型定義の追加

**ファイル**: `packages/core/src/types/event.ts`

**目的**: `text_chunk` イベント型を定義

```typescript
/**
 * Text chunk event - streams text tokens in real-time
 * Used for streaming agent responses (done_for_now, request_more_information)
 */
export interface TextChunkEvent extends BaseEvent<'text_chunk'> {
  data: {
    /** テキストチャンク（1トークン分） */
    content: string;
    /** メッセージID（同一メッセージのチャンクを識別） */
    messageId: string;
  };
}

// Event union に追加
export type Event =
  | UserInputEvent
  | ToolCallEvent
  | ToolResponseEvent
  | ErrorEvent
  | AwaitingApprovalEvent
  | CompleteEvent
  | TextChunkEvent; // ← 追加

// Type guard 追加
/**
 * Type guard to check if an event is a text chunk event
 */
export function isTextChunkEvent(event: Event): event is TextChunkEvent {
  return event.type === 'text_chunk';
}
```

**ファイル**: `packages/core/src/index.ts`

**目的**: 型をエクスポート

```typescript
export type {
  Event,
  UserInputEvent,
  ToolCallEvent,
  ToolResponseEvent,
  ErrorEvent,
  AwaitingApprovalEvent,
  CompleteEvent,
  TextChunkEvent, // ← 追加
} from './types/event';

export {
  isUserInputEvent,
  isToolCallEvent,
  isToolResponseEvent,
  isErrorEvent,
  isAwaitingApprovalEvent,
  isCompleteEvent,
  isTextChunkEvent, // ← 追加
} from './types/event';
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/core build
```

### Phase 2: OpenAIClient の拡張

**ファイル**: `packages/client/src/openai.ts`

**目的**: ストリーミング対応のツールコール生成メソッド追加

```typescript
/**
 * Generate tool call with streaming support.
 * Streams text tokens in real-time via callbacks.
 *
 * @param systemPrompt - System instructions
 * @param inputMessages - Input messages
 * @param tools - Available tools
 * @param onToolCall - Callback when tool call is detected
 * @param onTextChunk - Callback for each text token (real-time)
 * @returns Tool call result and full text
 */
async generateToolCallWithStreaming({
  systemPrompt,
  inputMessages,
  tools,
  onToolCall,
  onTextChunk,
}: {
  systemPrompt: string;
  inputMessages: Array<unknown>;
  tools?: Array<unknown>;
  onToolCall?: (toolCall: ToolCall) => void;
  onTextChunk?: (chunk: string, messageId: string) => void;
}): Promise<{
  toolCall: ToolCall | null;
  fullText: string;
}> {
  const stream = await this.client.responses.create({
    model: 'gpt-4o',
    instructions: systemPrompt,
    input: inputMessages as OpenAI.Responses.ResponseInput,
    tools: tools?.length ? tools : undefined,
    stream: true, // ストリーミングモード
  });

  let toolCall: ToolCall | null = null;
  let fullText = '';
  const messageId = `msg-${Date.now()}`;

  for await (const event of stream) {
    switch (event.type) {
      case 'response.function_call':
        // ツールコール検出
        toolCall = this.parseToolCall(event);
        onToolCall?.(toolCall);
        break;

      case 'response.output_text.delta':
        // テキストチャンク受信（リアルタイム）
        const chunk = event.delta || '';
        fullText += chunk;
        onTextChunk?.(chunk, messageId);
        break;

      case 'error':
        throw new Error(`OpenAI streaming error: ${JSON.stringify(event)}`);
    }
  }

  return { toolCall, fullText };
}
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/client build
```

### Phase 3: LLMAgentReducer の更新

**ファイル**: `packages/core/src/agent/llm-agent-reducer.ts`

**目的**: ストリーミング対応メソッドの追加

#### 3.1 型制約の更新

```typescript
export class LLMAgentReducer<
  TLLMClient extends {
    generateToolCall(params: {
      systemPrompt: string;
      inputMessages: Array<unknown>;
      tools?: Array<unknown>;
    }): Promise<{ toolCall: ToolCall | null }>;

    // ← 新規追加
    generateToolCallWithStreaming(params: {
      systemPrompt: string;
      inputMessages: Array<unknown>;
      tools?: Array<unknown>;
      onToolCall?: (toolCall: ToolCall) => void;
      onTextChunk?: (chunk: string, messageId: string) => void;
    }): Promise<{ toolCall: ToolCall | null; fullText: string }>;
  },
  TTools extends Array<unknown>,
> implements AgentReducer<Thread, Event>
```

#### 3.2 メソッド追加

```typescript
/**
 * Generate next tool call with streaming support.
 * Emits text chunks in real-time for done_for_now/request_more_information.
 *
 * @param state - Current thread state
 * @param onToolCall - Callback when tool call is detected
 * @param onTextChunk - Callback for each text token
 * @returns Tool call event or null
 */
async generateNextToolCallWithStreaming(
  state: Thread,
  onToolCall?: (toolCall: ToolCall) => void,
  onTextChunk?: (chunk: string, messageId: string) => void,
): Promise<ToolCallEvent | null> {
  const threadContext = state.serializeForLLM();
  const systemPrompt = this.systemPromptBuilder(threadContext);

  const { toolCall } = await this.llmClient.generateToolCallWithStreaming({
    systemPrompt,
    inputMessages: [{ role: 'user', content: systemPrompt }],
    tools: this.tools,
    onToolCall,
    onTextChunk,
  });

  if (!toolCall) {
    return null;
  }

  return {
    type: 'tool_call',
    timestamp: Date.now(),
    data: toolCall,
  };
}
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/core build
```

### Phase 4: Express API の更新

**ファイル**: `packages/web/src/routes/agent.ts`

**目的**: processAgent 関数でストリーミングメソッドを使用

#### 4.1 インポート追加

```typescript
import {
  Thread,
  LLMAgentReducer,
  NotionToolExecutor,
  isAwaitingApprovalEvent,
  isDoneForNowTool,
  isRequestMoreInformationTool,
  type Event,
  taskAgentTools,
} from '@shochan_ai/core';
```

#### 4.2 processAgent 関数の更新

```typescript
async function processAgent(
  conversationId: string,
  deps: AgentDependencies,
): Promise<void> {
  const { redisStore, streamManager, reducer, executor } = deps;
  let iterations = 0;

  try {
    let currentThread = await redisStore.get(conversationId);
    if (!currentThread) {
      throw new Error('Conversation not found');
    }

    console.log(`🤖 Starting agent processing for: ${conversationId}`);

    // SSE接続確立を待機
    await new Promise(resolve => setTimeout(resolve, 500));

    while (true) {
      if (iterations >= MAX_ITERATIONS) {
        throw new Error(`Maximum iterations (${MAX_ITERATIONS}) reached`);
      }
      iterations++;

      // ★ ストリーミング対応メソッドに変更
      const toolCallEvent = await reducer.generateNextToolCallWithStreaming(
        currentThread,
        // onToolCall: ツールコール検出時のコールバック
        (toolCall) => {
          console.log(`🔧 Tool call detected: ${toolCall.intent}`);
        },
        // onTextChunk: テキストチャンク受信時のコールバック（リアルタイム）
        (chunk, messageId) => {
          const textChunkEvent: Event = {
            type: 'text_chunk',
            timestamp: Date.now(),
            data: {
              content: chunk,
              messageId,
            },
          };
          streamManager.send(conversationId, textChunkEvent);
        },
      );

      if (!toolCallEvent) {
        console.error(`❌ No tool call generated for ${conversationId}`);
        break;
      }

      // ツールコールイベント送信
      streamManager.send(conversationId, toolCallEvent);
      currentThread = reducer.reduce(currentThread, toolCallEvent);
      await redisStore.set(conversationId, currentThread);

      const toolCall = toolCallEvent.data;

      // done_for_now / request_more_information の場合は終了
      if (isDoneForNowTool(toolCall) || isRequestMoreInformationTool(toolCall)) {
        console.log(`✅ Final response completed: ${toolCall.intent}`);
        break;
      }

      // delete_task の承認待ち
      if (toolCall.intent === 'delete_task') {
        const awaitingApprovalEvent: Event = {
          type: 'awaiting_approval',
          timestamp: Date.now(),
          data: toolCall,
        };
        streamManager.send(conversationId, awaitingApprovalEvent);
        currentThread = reducer.reduce(currentThread, awaitingApprovalEvent);
        await redisStore.set(conversationId, currentThread);
        break;
      }

      // その他のツールを実行
      console.log(`⚙️  Executing tool: ${toolCall.intent}`);
      const result = await executor.execute(toolCall);

      streamManager.send(conversationId, result.event);
      currentThread = reducer.reduce(currentThread, result.event);
      await redisStore.set(conversationId, currentThread);

      console.log(`✅ Tool executed: ${toolCall.intent}`);
    }
  } catch (error) {
    console.error(`❌ processAgent error for ${conversationId}:`, error);
    streamManager.send(conversationId, {
      type: 'error',
      timestamp: Date.now(),
      data: {
        error: error instanceof Error ? error.message : String(error),
        code: 'AGENT_PROCESSING_FAILED',
      },
    });
  }
}
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/web build
```

### Phase 5: Web UI の更新

#### 5.1 型定義の追加

**ファイル**: `packages/web-ui/types/chat.ts`

```typescript
import type {
  Event,
  ToolCallEvent,
  ToolResponseEvent,
  ErrorEvent,
  CompleteEvent,
  TextChunkEvent, // ← 追加
} from '@shochan_ai/core'

export type {
  Event,
  ToolCallEvent,
  ToolResponseEvent,
  ErrorEvent,
  CompleteEvent,
  TextChunkEvent, // ← 追加
}
```

#### 5.2 SSE イベントタイプの追加

**ファイル**: `packages/web-ui/lib/sse-client.ts`

```typescript
const SSE_EVENT_TYPES: ReadonlyArray<Event['type'] | 'connected'> = [
  'user_input',
  'tool_call',
  'tool_response',
  'error',
  'awaiting_approval',
  'complete',
  'text_chunk', // ← 追加
  'connected',
] as const
```

#### 5.3 text_chunk イベントのハンドリング

**ファイル**: `packages/web-ui/components/chat/chat-interface.tsx`

```typescript
const handleSSEEvent = useCallback((event: Event) => {
  let message: Message | null = null

  switch (event.type) {
    case 'text_chunk':
      // ★ リアルタイムテキストチャンクの処理
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        const { messageId, content } = event.data

        // 既存メッセージに追記
        if (lastMessage && lastMessage.id === messageId) {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: lastMessage.content + content },
          ]
        }

        // 新規メッセージ作成
        return [
          ...prev,
          {
            id: messageId,
            type: 'agent' as const,
            content,
            timestamp: event.timestamp,
          },
        ]
      })
      return

    case 'tool_call':
      // done_for_now/request_more_information はストリーミングで表示されるため
      // ツールコールメッセージは表示しない
      if (event.data.intent === 'done_for_now' ||
          event.data.intent === 'request_more_information') {
        return
      }
      message = createToolCallMessage(event)
      break

    case 'tool_response':
      message = createToolResponseMessage(event)
      break

    case 'complete':
      message = createCompleteMessage(event)
      break

    case 'error':
      message = createErrorMessage(event)
      break
  }

  if (message) {
    setMessages((prev) => [...prev, message])
  }
}, [])
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/web-ui build
```

### Phase 6: 統合ビルドとテスト

```bash
# 全パッケージビルド
pnpm -r build

# サーバー起動
pnpm --filter @shochan_ai/web dev  # port 3001

# UI起動（別ターミナル）
pnpm --filter @shochan_ai/web-ui dev  # port 3002
```

---

## テスト計画

### テスト環境

- Redis: `redis://localhost:6379`
- Express API: `http://localhost:3001`
- Web UI: `http://localhost:3002`

### テストケース

#### 1. 基本的なストリーミング動作

**手順**:
1. ブラウザで `http://localhost:3002` を開く
2. 「今日のタスクを教えて」と入力
3. メッセージ送信

**期待される動作**:
- [ ] `🔧 Tool call: get_tasks` が即座に表示
- [ ] エージェントメッセージが**1トークンずつ**表示される
- [ ] メッセージが完成するまで数秒かかる
- [ ] 最終的に完全なメッセージが表示される

**確認ポイント**:
- Time to First Token (TTFT) が1秒以内
- テキストが滑らかに追加される
- エラーが発生しない

#### 2. ツールコール連鎖

**手順**:
1. 「明日の予定でタスクを作成して」と入力

**期待される動作**:
- [ ] `🔧 Tool call: create_task`
- [ ] `✅ Tool executed`
- [ ] `🔧 Tool call: done_for_now`
- [ ] エージェントメッセージがストリーミング表示

#### 3. エラーハンドリング

**手順**:
1. OpenAI APIキーを無効化
2. メッセージ送信

**期待される動作**:
- [ ] `❌ Error: ...` が表示される
- [ ] アプリケーションがクラッシュしない

#### 4. SSE接続の確認

**開発者ツール確認**:
```
Network タブ → stream → Event Stream
```

**期待されるイベント**:
```
event: tool_call
data: {"type":"tool_call", ...}

event: text_chunk
data: {"type":"text_chunk","data":{"content":"タ",...}}

event: text_chunk
data: {"type":"text_chunk","data":{"content":"スク",...}}
```

---

## リスクと対策

### リスク1: OpenAI Responses API の挙動が不明瞭

**影響**: ストリーミングイベントが期待通り送信されない

**対策**:
- 小規模なテストスクリプトで事前検証
- OpenAI SDK のドキュメント精査
- エラーログの詳細出力

### リスク2: SSE接続のタイミング問題

**影響**: ストリーミング開始前にSSE接続が確立されていない

**対策**:
- `processAgent` 内で500msの待機時間を維持
- SSE接続確立のログ確認
- 必要に応じて待機時間を調整

### リスク3: メモリリーク

**影響**: 長時間のストリーミングでメモリ使用量が増加

**対策**:
- ストリームの適切なクリーンアップ
- `for await` ループの終了確認
- メモリ使用量のモニタリング

### リスク4: パフォーマンス低下

**影響**: 頻繁なSSE送信でサーバー負荷増加

**対策**:
- チャンクのバッファリング検討（複数トークンをまとめて送信）
- SSE送信頻度の調整
- パフォーマンステストの実施

---

## 参考資料

- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [better-sse](https://github.com/MatthewWid/better-sse)
- [EventSource API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

---

## まとめ

この実装により、以下を達成します：

✅ **リアルタイムストリーミング**: LLMのトークン生成と同時にブラウザへ表示
✅ **TTFT最小化**: 数百ミリ秒で最初のトークンを表示
✅ **効率的なAPI使用**: 1回のLLM呼び出しで完結
✅ **既存機能との統合**: ツールコールは従来通り、最終メッセージのみストリーミング
✅ **ベストプラクティス準拠**: ChatGPT/Claude と同等のUX

実装後、Shochan AIは主要AIエージェントと同等の応答性を持つようになります。
