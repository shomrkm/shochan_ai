# AIエージェントレスポンスのリアルタイムストリーミング実装計画（改訂版）

## 目次

1. [概要](#概要)
2. [実現したいこと](#実現したいこと)
3. [技術的背景と調査結果](#技術的背景と調査結果)
4. [アーキテクチャ設計](#アーキテクチャ設計)
5. [実装ステップ](#実装ステップ)
6. [テスト計画](#テスト計画)
7. [リスクと対策](#リスクと対策)

---

## 概要

### 実現したい機能

**ChatGPTやClaudeのように、AIエージェントのレスポンスがリアルタイムで1文字ずつ表示される機能を実装します。**

現在、Shochan AIエージェントはツールコール（タスク作成、取得など）を実行した後、最終的なユーザー向けメッセージを一度に表示します。この最終メッセージを、LLMがトークンを生成すると同時にブラウザに表示することで、応答性の高いUXを実現します。

### なぜ必要か

| 現在の動作 | 望ましい動作 |
|-----------|------------|
| ユーザーが待機 → LLM生成完了 → 一度に全文表示 | ユーザーが待機 → LLM生成開始 → **即座に**1トークンずつ表示 |
| **Time to First Token (TTFT)**: 遅い | **TTFT**: 数百ミリ秒 |
| ユーザー体験: 「固まっている?」 | ユーザー体験: 「処理中だとわかる」 |

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

3. **主要AIエージェントとの一致**
   - ChatGPT/Claudeと同じ実装パターンを採用
   - Multi-turn conversation方式

---

## 技術的背景と調査結果

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

### 調査結果：OpenAI Responses APIの仕様

#### 重要な発見

**OpenAI Responses APIでは、Function Call後に自動的にテキスト出力は生成されない**

実際のAPI動作：
```
Turn 1: Function Call
- LLM: create_task({ title: "..." }) を呼び出し
- response.function_call_arguments.delta: JSON断片
  - "{"
  - "title"
  - ":"
  - "Buy"
  - ...
- response.function_call_arguments.done: 完全なJSON

Turn 2: Text Output (別のAPI呼び出しが必要)
- LLM: テキスト生成
- response.output_text.delta: テキストトークン
  - "タ"
  - "ス"
  - "ク"
  - ...
```

#### 主要AIエージェントの実装パターン

| パターン | 説明 | 採用例 |
|---------|------|--------|
| **Multi-turn Conversation** | ツール実行後、結果を含めて再度LLMを呼び出し、テキスト生成をストリーミング | ChatGPT, Claude, OpenAI Agents SDK |
| Single-turn with Message Parameter | Function Callのパラメータにメッセージを含める（JSON断片のパース必要） | ❌ 非推奨（実装が複雑で不安定） |

#### ベストプラクティス（OpenAI公式ドキュメントより）

1. **ツール実行とテキスト生成を分離**
   - ツール実行: 非ストリーミング
   - テキスト生成: ストリーミング

2. **Multi-turn方式の採用**
   - Turn 1: ツールコール検出・実行
   - Turn 2: 結果を含めてテキスト生成（ストリーミング）

3. **`response.output_text.delta`の使用**
   - `response.function_call_arguments.delta`はJSON断片（使用不可）
   - `response.output_text.delta`が真のテキストストリーミング

---

## アーキテクチャ設計

### 全体フロー（Multi-turn方式）

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
      │ (3) SSE接続確認
      ↓
┌─────────────────────────────────┐
│ Turn 1: ツールコール検出・実行      │
│ OpenAI Responses API            │
│ (stream: false)                 │
└─────┬───────────────────────────┘
      │
      ├─→ response: function_call (create_task)
      │   → ツール実行: NotionToolExecutor
      │   → tool_response イベント送信
      │
      ↓
┌─────────────────────────────────┐
│ Turn 2: テキスト生成（ストリーミング）│
│ OpenAI Responses API            │
│ (stream: true, tools なし)       │
└─────┬───────────────────────────┘
      │
      └─→ response.output_text.delta (x N回)
          → text_chunk イベント送信 (リアルタイム)
          「タ」「ス」「ク」「を」「作成」「しま」「した」「。」
            ↓ SSE
      ┌─────────────┐
      │   Web UI    │ リアルタイム表示更新
      └─────────────┘
```

### イベントフロー詳細

#### Turn 1: ツールコール検出・実行

```typescript
// 1. ツールコール生成（非ストリーミング）
const response = await openai.responses.create({
  model: 'gpt-4o',
  instructions: systemPrompt,
  input: inputMessages,
  tools: [create_task, get_tasks, ...],
  stream: false, // 非ストリーミング
});

// 2. Function Callを検出
const functionCall = response.output.find(item => item.type === 'function_call');

// 3. ツール実行
const result = await executor.execute(functionCall);

// 4. SSEでイベント送信
streamManager.send(conversationId, {
  type: 'tool_call',
  data: functionCall,
});

streamManager.send(conversationId, {
  type: 'tool_response',
  data: result,
});
```

#### Turn 2: テキスト生成（ストリーミング）

```typescript
// 1. ツール結果を含めてテキスト生成（ストリーミング）
const stream = await openai.responses.create({
  model: 'gpt-4o',
  instructions: 'Explain what you did based on the tool results',
  input: [
    ...previousMessages,
    { type: 'function_call_output', call_id: '...', output: toolResult }
  ],
  stream: true, // ストリーミング有効
  // tools: undefined (ツールなし = テキスト生成のみ)
});

// 2. リアルタイムでテキストトークンを受信
for await (const event of stream) {
  if (event.type === 'response.output_text.delta') {
    // 3. SSEでフロントエンドに送信
    streamManager.send(conversationId, {
      type: 'text_chunk',
      timestamp: Date.now(),
      data: {
        content: event.delta, // ← 真のテキストトークン
        messageId: randomUUID(),
      },
    });
  }
}
```

### イベントタイプマッピング

| OpenAI Responses API | Shochan AI Event | データ構造 | 用途 |
|---------------------|------------------|----------|------|
| `response.output_text.delta` | `text_chunk` | `{ type: 'text_chunk', data: { content: string, messageId: string } }` | リアルタイムテキスト表示 |
| `response.completed` | `complete` | `{ type: 'complete', data: { message: string } }` | ストリーミング完了通知 |
| `error` | `error` | `{ type: 'error', data: { error: string, code: string } }` | エラー通知 |

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
 * Used for streaming agent responses after tool execution
 */
export interface TextChunkEvent extends BaseEvent<'text_chunk'> {
  data: {
    /** テキストチャンク（1トークン分または複数トークン） */
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
export function isTextChunkEvent(event: Event): event is TextChunkEvent {
  return event.type === 'text_chunk';
}
```

**ファイル**: `packages/core/src/index.ts`

```typescript
export type {
  // ... existing exports
  TextChunkEvent, // ← 追加
} from './types/event';

export {
  // ... existing exports
  isTextChunkEvent, // ← 追加
} from './types/event';
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/core build
```

### Phase 2: OpenAIClient の拡張

**ファイル**: `packages/client/src/openai.ts`

**目的**: テキスト生成専用のストリーミングメソッド追加

```typescript
/**
 * Generate text response with streaming support.
 * Used for explaining tool results to the user.
 * 
 * This method does NOT use tools - it only generates text output.
 * Use this after tool execution to provide a natural language explanation.
 *
 * @param systemPrompt - System instructions
 * @param inputMessages - Input messages including tool results
 * @param onTextChunk - Callback for each text token (real-time)
 * @returns Full generated text
 */
async generateTextWithStreaming({
  systemPrompt,
  inputMessages,
  onTextChunk,
}: {
  systemPrompt: string;
  inputMessages: Array<unknown>;
  onTextChunk?: (chunk: string, messageId: string) => void;
}): Promise<string> {
  const stream = await this.client.responses.create({
    model: 'gpt-4o',
    instructions: systemPrompt,
    input: inputMessages as OpenAI.Responses.ResponseInput,
    stream: true, // ストリーミング有効
    // tools: undefined (ツールなし = テキスト生成のみ)
  });

  let fullText = '';
  const messageId = randomUUID();

  for await (const rawEvent of stream) {
    const event = rawEvent as unknown;

    // Handle text delta events - THIS IS WHERE REAL-TIME STREAMING HAPPENS
    if (typeof event === 'object' && event !== null && 'type' in event) {
      const eventType = (event as { type: string }).type;
      
      if (eventType === 'response.output_text.delta') {
        const delta = (event as { delta?: string }).delta || '';
        fullText += delta;
        onTextChunk?.(delta, messageId);
      }
      else if (eventType === 'error') {
        throw new Error(`OpenAI streaming error: ${JSON.stringify(event)}`);
      }
    }
  }

  return fullText;
}
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/client build
```

### Phase 3: LLMAgentReducer の更新

**ファイル**: `packages/core/src/agent/llm-agent-reducer.ts`

**目的**: テキスト生成メソッドの追加

#### 3.1 型制約の更新

```typescript
export class LLMAgentReducer<
  TLLMClient extends {
    generateToolCall(params: {
      systemPrompt: string;
      inputMessages: Array<unknown>;
      tools?: Array<unknown>;
    }): Promise<{ toolCall: ToolCall | null }>;

    // ← 新規追加: テキスト生成専用メソッド
    generateTextWithStreaming?(params: {
      systemPrompt: string;
      inputMessages: Array<unknown>;
      onTextChunk?: (chunk: string, messageId: string) => void;
    }): Promise<string>;
  },
  TTools extends Array<unknown>,
> implements AgentReducer<Thread, Event>
```

#### 3.2 メソッド追加

```typescript
/**
 * Generate explanation text with streaming support.
 * Used after tool execution to explain results to the user.
 *
 * @param state - Current thread state
 * @param onTextChunk - Callback for each text token
 * @returns Generated text
 */
async generateExplanationWithStreaming(
  state: Thread,
  onTextChunk?: (chunk: string, messageId: string) => void,
): Promise<string> {
  if (!this.llmClient.generateTextWithStreaming) {
    throw new Error('LLM client does not support text streaming');
  }

  const threadContext = state.serializeForLLM();
  const systemPrompt = `Based on the conversation history and tool results below, provide a natural language explanation to the user.

${threadContext}

Explain what you did and provide a helpful response. Be conversational and respond in the same language the user used.`;

  return await this.llmClient.generateTextWithStreaming({
    systemPrompt,
    inputMessages: [{ role: 'user', content: systemPrompt }],
    onTextChunk,
  });
}
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/core build
```

### Phase 4: Express API の更新

**ファイル**: `packages/web/src/routes/agent.ts`

**目的**: Multi-turn方式の実装

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

    // Send connected event
    streamManager.send(conversationId, {
      type: 'connected',
      timestamp: Date.now(),
      data: { status: 'ready', conversationId },
    });

    // Wait for SSE connection
    await new Promise((resolve) => setTimeout(resolve, 500));

    while (true) {
      if (iterations >= MAX_ITERATIONS) {
        throw new Error(`Maximum iterations (${MAX_ITERATIONS}) reached`);
      }
      iterations++;

      // ========================================
      // Turn 1: ツールコール検出・実行
      // ========================================
      const toolCallEvent = await reducer.generateNextToolCall(currentThread);

      if (!toolCallEvent) {
        console.error(`❌ No tool call generated for ${conversationId}`);
        break;
      }

      console.log(`🔧 Tool call generated: ${toolCallEvent.data.intent}`);
      streamManager.send(conversationId, toolCallEvent);
      currentThread = reducer.reduce(currentThread, toolCallEvent);
      await redisStore.set(conversationId, currentThread);

      const toolCall = toolCallEvent.data;

      // delete_task の承認待ち
      if (toolCall.intent === 'delete_task') {
        console.log(`⚠️  Approval required for: ${conversationId}`);
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

      // ツール実行
      console.log(`⚙️  Executing tool: ${toolCall.intent}`);
      const result = await executor.execute(toolCall);

      streamManager.send(conversationId, result.event);
      currentThread = reducer.reduce(currentThread, result.event);
      await redisStore.set(conversationId, currentThread);

      console.log(`✅ Tool executed successfully: ${toolCall.intent}`);

      // ========================================
      // Turn 2: テキスト生成（ストリーミング）
      // ========================================
      console.log(`📝 Generating explanation with streaming...`);

      await reducer.generateExplanationWithStreaming(
        currentThread,
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

      console.log(`✅ Explanation generated for ${conversationId}`);
      break; // 1サイクルで完了
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
- [ ] エージェントメッセージが**少しずつ**表示される
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
event: connected
data: {"type":"connected","timestamp":...}

event: tool_call
data: {"type":"tool_call", ...}

event: tool_response
data: {"type":"tool_response", ...}

event: text_chunk
data: {"type":"text_chunk","data":{"content":"タ",...}}

event: text_chunk
data: {"type":"text_chunk","data":{"content":"ス",...}}
```

---

## リスクと対策

### リスク1: API呼び出し回数の増加

**影響**: Multi-turn方式により、1リクエストあたり2回のAPI呼び出しが必要

**重要度**: 🟡 中

**対策**:
- コスト監視の実装
- 必要に応じてキャッシュ戦略の検討
- トークン使用量の最適化

**コスト試算**:
```
従来: 1リクエスト = 1 API呼び出し
新方式: 1リクエスト = 2 API呼び出し（ツール検出 + テキスト生成）
増加率: 約2倍

ただし、ストリーミングによるUX向上のメリットは大きい
```

### リスク2: SSE接続のタイミング問題

**影響**: ストリーミング開始前にSSE接続が確立されていない → 初期チャンクの損失

**重要度**: 🟡 中

**対策**:
- `connected` イベントによる接続確認
- タイムアウト処理の実装（500ms待機）
- 接続状態のUI表示

### リスク3: メモリリーク

**影響**: 長時間のストリーミングでメモリ使用量が増加

**重要度**: 🟢 低

**対策**:
- ストリームの適切なクリーンアップ
- `for await` ループの終了確認
- メモリ使用量のモニタリング

### リスク4: ネットワーク切断時の再接続

**影響**: SSE接続が切断された場合、ユーザーが気づかない

**重要度**: 🟢 低

**対策**:
- EventSource の自動再接続機能を活用
- 接続状態のUI表示
- 再接続時の状態復元

---

## 実装チェックリスト

### 必須項目

- [ ] **Phase 0**: Git状態の確認
- [ ] **Phase 1**: Core型定義の追加（TextChunkEvent）
- [ ] **Phase 2**: OpenAIClientの拡張（generateTextWithStreaming）
- [ ] **Phase 3**: LLMAgentReducerの更新（generateExplanationWithStreaming）
- [ ] **Phase 4**: Express APIの更新（Multi-turn実装）
- [ ] **Phase 5**: Web UIの更新（text_chunkハンドリング）
- [ ] **Phase 6**: 統合ビルドとテスト

### テスト項目

- [ ] 基本的なストリーミング動作（TTFT < 1秒）
- [ ] ツールコール連鎖
- [ ] エラーハンドリング
- [ ] SSE接続の確認（開発者ツール）
- [ ] 長時間稼働でのメモリリークチェック（オプション）

---

## 参考資料

- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [OpenAI Streaming Guide](https://platform.openai.com/docs/guides/streaming)
- [OpenAI Agents SDK - Streaming](https://openai.github.io/openai-agents-python/streaming/)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [better-sse](https://github.com/MatthewWid/better-sse)

---

## まとめ

この実装により、以下を達成します：

✅ **リアルタイムストリーミング**: LLMのトークン生成と同時にブラウザへ表示
✅ **TTFT最小化**: 数百ミリ秒で最初のトークンを表示
✅ **主要AIエージェントとの一致**: ChatGPT/Claudeと同じMulti-turn方式
✅ **安定性**: 標準的なAPI使用パターンで実装が安定
✅ **型安全性**: TypeScriptの型システムを活用

### 実装方式の選択理由

**Multi-turn Conversation方式を採用**

| 項目 | 評価 | 説明 |
|------|------|------|
| **リアルタイム性** | ✅ 完全 | LLM生成と同時に表示 |
| **実装の複雑さ** | ✅ シンプル | 標準的なAPI使用 |
| **安定性** | ✅ 高い | JSONパース不要 |
| **主要AIとの一致** | ✅ 完全一致 | ChatGPT/Claudeと同じ |
| **コスト** | ⚠️ 2倍 | API呼び出しが2回 |

**結論**: コストは増加するが、UX向上とコードの安定性のメリットが大きいため、Multi-turn方式を採用します。

実装後、Shochan AIは主要AIエージェント（ChatGPT/Claude）と同等の応答性と信頼性を持つようになります。
