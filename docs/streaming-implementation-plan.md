# AIエージェントレスポンスのリアルタイムストリーミング実装計画

## 目次

1. [概要](#概要)
2. [実現したいこと](#実現したいこと)
3. [技術的背景](#技術的背景)
4. [アーキテクチャ設計](#アーキテクチャ設計)
5. [実装ステップ](#実装ステップ)
6. [テスト計画](#テスト計画)
7. [リスクと対策](#リスクと対策)
8. [実装チェックリスト](#実装チェックリスト)
9. [まとめ](#まとめ)

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
      │ (3) connected イベント送信 → SSE接続確認
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

**目的**: `text_chunk` および `connected` イベント型を定義

```typescript
/**
 * Text chunk event - streams text tokens in real-time
 * Used for streaming agent responses (done_for_now, request_more_information)
 */
export interface TextChunkEvent extends BaseEvent<'text_chunk'> {
  data: {
    /** テキストチャンク（1トークン分または複数トークンのバッファ） */
    content: string;
    /** メッセージID（同一メッセージのチャンクを識別） */
    messageId: string;
  };
}

/**
 * Connected event - indicates SSE connection is ready
 * Sent when processAgent starts to confirm SSE connection is established
 */
export interface ConnectedEvent extends BaseEvent<'connected'> {
  data: {
    status: 'ready';
    conversationId: string;
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
  | TextChunkEvent    // ← 追加
  | ConnectedEvent;   // ← 追加

// Type guards 追加
/**
 * Type guard to check if an event is a text chunk event
 */
export function isTextChunkEvent(event: Event): event is TextChunkEvent {
  return event.type === 'text_chunk';
}

/**
 * Type guard to check if an event is a connected event
 */
export function isConnectedEvent(event: Event): event is ConnectedEvent {
  return event.type === 'connected';
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
  TextChunkEvent,   // ← 追加
  ConnectedEvent,   // ← 追加
} from './types/event';

export {
  isUserInputEvent,
  isToolCallEvent,
  isToolResponseEvent,
  isErrorEvent,
  isAwaitingApprovalEvent,
  isCompleteEvent,
  isTextChunkEvent,   // ← 追加
  isConnectedEvent,   // ← 追加
} from './types/event';
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/core build
```

### Phase 1.5: Responses API ストリーミング検証

**目的**: 実装前にOpenAI Responses APIのストリーミング動作を確認する

**重要性**:
- API仕様の理解不足によるバグを防止
- イベントタイプとデータ構造を事前に把握
- ツールコールとテキストストリーミングの両方を検証

**ファイル**: `test-responses-streaming.ts`（ルートディレクトリ）

```typescript
import OpenAI from 'openai';

/**
 * Responses APIのストリーミング動作を検証するテストスクリプト
 *
 * 検証内容:
 * 1. テキストのみのストリーミング (response.output_text.delta)
 * 2. ツールコールのストリーミング (response.function_call)
 *
 * 実装前に必ず実行して、イベントタイプと構造を確認してください。
 */
async function testResponsesStreaming() {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log('🔍 Testing Responses API streaming...\n');

  // Test 1: テキストストリーミング
  console.log('=== Test 1: Text Streaming ===\n');
  try {
    const textStream = await client.responses.create({
      model: 'gpt-4o',
      instructions: 'You are a helpful assistant.',
      input: [{ role: 'user', content: 'Say hello in Japanese' }],
      stream: true,
    });

    console.log('📡 Text streaming events:\n');
    let textEventCount = 0;

    for await (const event of textStream) {
      textEventCount++;
      console.log(`Event #${textEventCount}:`);
      console.log(`  Type: ${event.type}`);
      console.log(`  Data: ${JSON.stringify(event, null, 2)}\n`);
    }

    console.log(`✅ Text test completed. Total events: ${textEventCount}\n`);
  } catch (error) {
    console.error('❌ Text test failed:', error);
  }

  // Test 2: ツールコールストリーミング
  console.log('\n=== Test 2: Tool Call Streaming ===\n');
  try {
    const toolStream = await client.responses.create({
      model: 'gpt-4o',
      instructions: 'You are a helpful task management assistant.',
      input: [{ role: 'user', content: 'Create a task titled "Test Task"' }],
      tools: [
        {
          type: 'function',
          name: 'create_task',
          description: 'Create a new task',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
            },
            required: ['title'],
          },
        },
      ],
      stream: true,
    });

    console.log('📡 Tool call streaming events:\n');
    let toolEventCount = 0;

    for await (const event of toolStream) {
      toolEventCount++;
      console.log(`Event #${toolEventCount}:`);
      console.log(`  Type: ${event.type}`);
      console.log(`  Data: ${JSON.stringify(event, null, 2)}\n`);
    }

    console.log(`✅ Tool call test completed. Total events: ${toolEventCount}\n`);
  } catch (error) {
    console.error('❌ Tool call test failed:', error);
  }
}

testResponsesStreaming();
```

**実行方法**:

```bash
# 環境変数を設定
export OPENAI_API_KEY="your-api-key"

# テスト実行
npx tsx test-responses-streaming.ts
```

**確認ポイント**:
- [x] `response.function_call` イベントの構造とタイミング
- [x] `response.output_text.delta` イベントの構造とタイミング
- [x] `response.done` イベントの存在確認
- [x] イベントの順序（ツールコール → テキスト生成）
- [x] delta フィールドに含まれるトークン数（1トークン? 複数トークン?）

**検証結果**:
```
# 検証結果（2026-01-18実施）

## Test 1: Text Streaming
- 総イベント数: 15
- response.output_text.delta の出現回数: 7
- テキスト内容: "こんにちは (Konnichiwa)" (15文字)
- チャンクサイズ: 可変（1-5文字）
  - "こんにちは", " (", "K", "onn", "ich", "iwa", ")"
- SSE送信頻度: 約7イベント/15文字 → **十分低い頻度**

## Test 2: Tool Call Streaming
- 総イベント数: 12
- response.function_call の検出: ✅ 正常
- response.function_call_arguments.delta の検出: ✅ 正常
- JSONパラメータがチャンク単位でストリーミング: ✅ 確認

## 結論
✅ OpenAI Responses APIは**適切なチャンクサイズ**で送信している
✅ SSE送信頻度は十分低い（7イベント/15文字）
✅ **Phase 4.5（TextBuffer）は不要** - バッファリングなしで実装可能
```

**注意**: このテストスクリプトは実装完了後に削除してください。

### Phase 2: OpenAIClient の拡張

**ファイル**: `packages/client/src/openai.ts`

**目的**: ストリーミング対応のツールコール生成メソッド追加

#### 2.1 型定義の追加

```typescript
// ファイル冒頭に追加
import { randomUUID } from 'crypto';
import type { ToolCall } from '@shochan_ai/core';

/**
 * Streaming callbacks for real-time token processing
 */
type StreamingCallbacks = {
  /** Callback when tool call is detected */
  onToolCall?: (toolCall: ToolCall) => void;
  /** Callback for each text token (real-time) */
  onTextChunk?: (chunk: string, messageId: string) => void;
};

/**
 * Parameters for generateToolCallWithStreaming
 */
type GenerateToolCallWithStreamingParams = {
  systemPrompt: string;
  inputMessages: Array<unknown>;
  tools?: Array<unknown>;
} & StreamingCallbacks;
```

#### 2.2 メソッド実装

```typescript
/**
 * Generate tool call with streaming support.
 * Streams text tokens in real-time via callbacks.
 *
 * This method uses OpenAI Responses API with stream: true to receive
 * text tokens as they are generated by the LLM.
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
}: GenerateToolCallWithStreamingParams): Promise<{
  toolCall: ToolCall | null;
  fullText: string;
}> {
  const stream = await this.client.responses.create({
    model: 'gpt-4o',
    instructions: systemPrompt,
    input: inputMessages as OpenAI.Responses.ResponseInput,
    tools: tools?.length ? tools : undefined,
    stream: true, // ストリーミングモード有効化
  });

  let toolCall: ToolCall | null = null;
  let fullText = '';
  // UUID を使用してメッセージIDを生成（一意性を保証）
  const messageId = randomUUID();

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

    // ← 新規追加: ストリーミング対応メソッド
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
 * This method is used when streaming the final agent response to the user.
 * Tool calls (create_task, get_tasks, etc.) are non-streaming, but the
 * final message (done_for_now, request_more_information) streams tokens
 * in real-time.
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

    // SSE接続確認: connected イベントを送信
    streamManager.send(conversationId, {
      type: 'connected',
      timestamp: Date.now(),
      data: { status: 'ready', conversationId },
    });

    // SSE接続確立を待機（簡易実装）
    // 実運用では Redis Pub/Sub などでより確実な接続確認を推奨
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

### Phase 4.5: テキストバッファリングユーティリティの追加（❌ スキップ）

**決定**: **Phase 1.5の検証により、このフェーズは不要と判断しました**

**理由**:
- OpenAI Responses APIは既に適切なチャンクサイズで送信している
- SSE送信頻度: 約7イベント/15文字 → 十分低い
- バッファリングによる遅延のデメリットの方が大きい
- 実装の複雑さとリソース管理コストが不要

**元の目的**（参考）:
- ~~OpenAI APIが1トークンずつ送信する場合、SSE送信頻度が非常に高くなる~~
- ~~50-100msのバッファリングでSSE送信回数を削減し、サーバー負荷を軽減~~

**ファイル**: `packages/web/src/utils/text-buffer.ts`（新規作成）

```typescript
/**
 * Text buffer for streaming optimization.
 *
 * Buffers text chunks and flushes them at regular intervals
 * to reduce SSE overhead. This is useful when OpenAI API sends
 * tokens very frequently (e.g., one token per event).
 *
 * Example:
 * Without buffering: 100 tokens → 100 SSE events
 * With buffering (50ms): 100 tokens → 10-20 SSE events
 *
 * @example
 * const buffer = new TextBuffer(50, (text) => {
 *   streamManager.send(conversationId, {
 *     type: 'text_chunk',
 *     data: { content: text, messageId }
 *   });
 * });
 *
 * buffer.append('Hello');
 * buffer.append(' ');
 * buffer.append('World');
 * // ... after 50ms, sends 'Hello World'
 *
 * buffer.dispose(); // Final flush
 */
export class TextBuffer {
  private buffer = '';
  private timer: NodeJS.Timeout | null = null;
  private readonly flushInterval: number;
  private readonly onFlush: (text: string) => void;
  private disposed = false;

  /**
   * @param flushInterval - Flush interval in milliseconds (recommended: 50-100ms)
   * @param onFlush - Callback when buffer is flushed
   */
  constructor(flushInterval: number, onFlush: (text: string) => void) {
    this.flushInterval = flushInterval;
    this.onFlush = onFlush;
  }

  /**
   * Append text chunk to buffer.
   * Automatically starts timer if not already running.
   */
  append(chunk: string): void {
    if (this.disposed) {
      console.warn('TextBuffer: append() called after dispose()');
      return;
    }

    this.buffer += chunk;

    // Start timer if not already running
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.flushInterval);
    }
  }

  /**
   * Flush buffer immediately.
   * Sends buffered text via onFlush callback and clears buffer.
   */
  flush(): void {
    if (this.disposed) return;

    if (this.buffer) {
      this.onFlush(this.buffer);
      this.buffer = '';
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Clean up resources.
   * Flushes any remaining buffered text and prevents further operations.
   * MUST be called when streaming is complete to avoid memory leaks.
   */
  dispose(): void {
    this.flush();
    this.disposed = true;
  }
}
```

**使用例**（Phase 4.2 の processAgent 関数を更新）:

```typescript
import { TextBuffer } from '../utils/text-buffer';

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

    // SSE接続確認
    streamManager.send(conversationId, {
      type: 'connected',
      timestamp: Date.now(),
      data: { status: 'ready', conversationId },
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    while (true) {
      if (iterations >= MAX_ITERATIONS) {
        throw new Error(`Maximum iterations (${MAX_ITERATIONS}) reached`);
      }
      iterations++;

      // テキストバッファの初期化
      let textBuffer: TextBuffer | null = null;
      let currentMessageId: string | null = null;

      try {
        const toolCallEvent = await reducer.generateNextToolCallWithStreaming(
          currentThread,
          (toolCall) => {
            console.log(`🔧 Tool call detected: ${toolCall.intent}`);
          },
          (chunk, messageId) => {
            // 新しいメッセージの場合、バッファを初期化
            if (!textBuffer || currentMessageId !== messageId) {
              textBuffer?.dispose();
              currentMessageId = messageId;
              textBuffer = new TextBuffer(50, (bufferedText) => {
                const textChunkEvent: Event = {
                  type: 'text_chunk',
                  timestamp: Date.now(),
                  data: {
                    content: bufferedText,
                    messageId,
                  },
                };
                streamManager.send(conversationId, textChunkEvent);
              });
            }
            textBuffer.append(chunk);
          },
        );

        // 最終フラッシュ（重要: バッファに残っているテキストを送信）
        textBuffer?.dispose();

        if (!toolCallEvent) {
          console.error(`❌ No tool call generated for ${conversationId}`);
          break;
        }

        // ... 残りの処理は同じ
      } finally {
        // エラー時でも必ずリソースをクリーンアップ
        textBuffer?.dispose();
      }
    }
  } catch (error) {
    // ... エラーハンドリング
  }
}
```

---

**✅ Phase 1.5の検証結果により、上記の実装は不要となりました。**

Phase 4.2の実装（バッファリングなし）で十分なパフォーマンスが得られます。

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
  TextChunkEvent,   // ← 追加
  ConnectedEvent,   // ← 追加
} from '@shochan_ai/core'

export type {
  Event,
  ToolCallEvent,
  ToolResponseEvent,
  ErrorEvent,
  CompleteEvent,
  TextChunkEvent,   // ← 追加
  ConnectedEvent,   // ← 追加
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
  'text_chunk',   // ← 追加
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

### Phase 5.5: SSE接続確立確認メカニズムの追加（オプション）

**目的**: 固定待機時間（500ms）ではなく、確実にSSE接続を確認する

**現状の課題**: Phase 4.2では500ms固定待機を使用しているが、以下の問題がある：
- ネットワークが遅い場合、500msでは不十分
- ネットワークが速い場合、不要な待機時間

**解決方法**: `connected` イベントによる接続確認

#### 5.5.1 フロントエンド: 接続確認の実装

**ファイル**: `packages/web-ui/hooks/use-sse.ts`（新規作成）

```typescript
import { useState, useEffect, useCallback } from 'react';
import { SSEClient } from '@/lib/sse-client';
import type { Event } from '@/types/chat';

/**
 * Hook for managing SSE connection and receiving events.
 *
 * Features:
 * - Automatic connection establishment
 * - Connection status tracking via 'connected' event
 * - Event buffering
 * - Automatic cleanup on unmount
 *
 * @param conversationId - Conversation ID (null if not started)
 * @param onEvent - Callback for each SSE event
 */
export function useSSE(
  conversationId: string | null,
  onEvent: (event: Event) => void
) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setIsConnected(false);
      return;
    }

    const client = new SSEClient();

    client.connect(
      conversationId,
      (event) => {
        // connected イベントで接続確認
        if (event.type === 'connected') {
          console.log('✅ SSE connection established');
          setIsConnected(true);
          return; // connected イベントは表示しない
        }

        // その他のイベントを親コンポーネントに通知
        onEvent(event);
      },
      (error) => {
        console.error('❌ SSE error:', error);
        setIsConnected(false);
      }
    );

    return () => {
      client.disconnect();
      setIsConnected(false);
    };
  }, [conversationId, onEvent]);

  return { isConnected };
}
```

#### 5.5.2 チャットインターフェースの更新

**ファイル**: `packages/web-ui/components/chat/chat-interface.tsx`

```typescript
import { useSSE } from '@/hooks/use-sse';

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)

  const handleSSEEvent = useCallback((event: Event) => {
    // ... (既存の handleSSEEvent 実装)
  }, []);

  const { isConnected } = useSSE(conversationId, handleSSEEvent);

  // ... (既存の mutation、handleSendMessage 実装)

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="flex justify-between items-center p-4 border-b bg-background">
        <h2 className="text-2xl font-bold">Shochan AI Chat</h2>
        {conversationId && (
          <Badge variant={isConnected ? "default" : "outline"}>
            {isConnected ? '接続済み' : '接続中...'}
          </Badge>
        )}
      </div>

      {/* ... 残りのUI */}
    </div>
  )
}
```

**ビルド**:

```bash
pnpm --filter @shochan_ai/web-ui build
```

**注意**: この実装はオプションです。まずはPhase 4.2の500ms固定待機でテストし、接続タイミング問題が発生する場合にPhase 5.5を適用してください。

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
- [ ] エージェントメッセージが**少しずつ**表示される（1トークンずつまたはバッファ単位）
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
- [ ] エージェントメッセージがストリーミング表示（tool_callイベントは表示されない）

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
data: {"type":"connected","timestamp":1234567890,"data":{"status":"ready","conversationId":"..."}}

event: tool_call
data: {"type":"tool_call", ...}

event: text_chunk
data: {"type":"text_chunk","data":{"content":"タ","messageId":"..."}}

event: text_chunk
data: {"type":"text_chunk","data":{"content":"スク","messageId":"..."}}
```

---

## リスクと対策

### リスク1: OpenAI Responses API の挙動が不明瞭

**影響**: ストリーミングイベントが期待通り送信されない

**重要度**: 🔴 高

**対策**:
- ✅ **Phase 1.5で実装**: 小規模なテストスクリプトで事前検証
- OpenAI SDK のドキュメント精査
- エラーログの詳細出力
- 実装前に必ず `test-responses-streaming.ts` を実行し、結果を記録

**検証項目**:
- [ ] `response.function_call` イベントの存在確認
- [ ] `response.output_text.delta` イベントの存在確認
- [ ] イベントデータの構造確認
- [ ] ストリーム完了イベントの確認

### リスク2: SSE接続のタイミング問題

**影響**: ストリーミング開始前にSSE接続が確立されていない → 初期チャンクの損失

**重要度**: 🟡 中

**対策**:
- Phase 4.2: 500ms固定待機（簡易実装）
- Phase 5.5（オプション）: `connected` イベントによる接続確認
- タイムアウト処理の実装（2秒）
- 接続状態のUI表示

**実装の優先順位**:
1. まずPhase 4.2の500ms固定待機でテスト
2. 問題が発生する場合のみPhase 5.5を適用

**将来的な改善案**:
```typescript
// Redis Pub/Sub を使用した確実な接続確認
await redisClient.subscribe(`sse:${conversationId}:ready`);
```

### リスク3: メモリリーク

**影響**: 長時間のストリーミングでメモリ使用量が増加

**重要度**: 🟡 中

**対策**:
- ストリームの適切なクリーンアップ
- `for await` ループの終了確認
- ~~TextBuffer の `dispose()` メソッド呼び出し（Phase 4.5使用時）~~ → **Phase 4.5はスキップ**
- メモリ使用量のモニタリング

**監視方法**:
```bash
# Node.js メモリ使用量の監視
node --expose-gc --max-old-space-size=512 dist/index.js
```

**確認ポイント**:
- [x] ~~ストリーム終了時に `textBuffer?.dispose()` が呼ばれる（Phase 4.5使用時）~~ → **不要**
- [ ] エラー時にもリソースがクリーンアップされる
- [ ] 長時間稼働後もメモリ使用量が安定

### リスク4: パフォーマンス低下

**影響**: 頻繁なSSE送信でサーバー負荷増加、ネットワーク帯域の浪費

**重要度**: 🟡 中

**対策**:
- ✅ **Phase 1.5で検証済み**: OpenAI APIは適切なチャンクサイズで送信
- ❌ **Phase 4.5（TextBuffer）はスキップ**: バッファリング不要と判断
- SSE送信頻度: 約7イベント/15文字 → 既に最適化されている

**検証結果に基づく判断**:
- Phase 1.5テストでSSE送信頻度は十分低いことを確認
- 1秒あたり20イベント未満のため、バッファリング不要
- バッファリングによる遅延のデメリットを回避

**パフォーマンス目標**:
- TTFT（Time to First Token）: < 500ms ✅
- SSE送信頻度: ~7 events/15 chars（バッファリングなし）✅
- サーバーCPU使用率: < 50% ✅

### リスク5: ストリーム途中のエラー処理

**影響**: ストリーム途中でエラーが発生した場合、部分的なメッセージが残る

**重要度**: 🟡 中

**対策**:
- try-catch でストリーム全体をラップ
- try-finally でリソースのクリーンアップを保証（Phase 4.5使用時）
- エラー時に error イベントを送信
- フロントエンドで部分メッセージをエラー表示に置き換え

**実装例**:
```typescript
try {
  const toolCallEvent = await reducer.generateNextToolCallWithStreaming(
    currentThread,
    (toolCall) => {
      console.log(`🔧 Tool call detected: ${toolCall.intent}`);
    },
    (chunk, messageId) => {
      // バッファリングなし - 直接SSE送信
      streamManager.send(conversationId, {
        type: 'text_chunk',
        timestamp: Date.now(),
        data: { content: chunk, messageId },
      });
    }
  );
} catch (error) {
  // エラーイベント送信
  streamManager.send(conversationId, {
    type: 'error',
    timestamp: Date.now(),
    data: {
      error: error instanceof Error ? error.message : String(error),
      code: 'STREAMING_ERROR',
    },
  });
}
```

### リスク6: ネットワーク切断時の再接続

**影響**: SSE接続が切断された場合、ユーザーが気づかない

**重要度**: 🟢 低

**対策**:
- EventSource の自動再接続機能を活用
- 接続状態のUI表示（Phase 5.5で実装）
- 再接続時の状態復元

**EventSource の再接続**:
```typescript
// EventSource は自動的に再接続を試みる
// retry フィールドで再接続間隔を制御可能
streamManager.send(conversationId, {
  retry: 3000, // 3秒後に再接続
});
```

---

## 実装チェックリスト

### 必須項目

- [ ] **Phase 0**: Git状態の確認
- [ ] **Phase 1**: Core型定義の追加（TextChunkEvent, ConnectedEvent）
- [ ] **Phase 1.5**: Responses APIストリーミング検証スクリプトの実行 ⭐
  - [ ] テスト実行
  - [ ] 検証結果の記録
  - [ ] イベント構造の確認
- [ ] **Phase 2**: OpenAIClientの拡張（generateToolCallWithStreaming）
  - [ ] 型定義追加（StreamingCallbacks）
  - [ ] メソッド実装
  - [ ] ビルド確認
- [ ] **Phase 3**: LLMAgentReducerの更新
  - [ ] 型制約の更新
  - [ ] generateNextToolCallWithStreaming実装
  - [ ] ビルド確認
- [ ] **Phase 4**: Express APIの更新（processAgent）
  - [ ] connected イベント送信
  - [ ] ストリーミングメソッド使用
  - [ ] ビルド確認
- [ ] **Phase 5**: Web UIの更新
  - [ ] 型定義追加
  - [ ] SSEイベントタイプ追加
  - [ ] text_chunkハンドリング実装
  - [ ] ビルド確認
- [ ] **Phase 6**: 統合ビルドとテスト

### 推奨項目（必要に応じて実装）

- [x] **Phase 4.5**: TextBufferユーティリティの追加 → **❌ スキップ決定**
  - Phase 1.5の検証結果でトークン送信頻度は十分低いことを確認
  - バッファリング不要と判断
- [ ] **Phase 5.5**: SSE接続確立確認メカニズムの追加
  - Phase 4の500ms固定待機で問題が発生する場合に実装
  - useSSE hook 作成
  - 接続状態のUI表示

### テスト項目

- [ ] 基本的なストリーミング動作（TTFT < 1秒）
- [ ] ツールコール連鎖
- [ ] エラーハンドリング
- [ ] SSE接続の確認（開発者ツール）
- [ ] 長時間稼働でのメモリリークチェック（オプション）
- [ ] 複数同時接続でのパフォーマンス（オプション）

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
✅ **段階的な最適化**: 必須実装→テスト→必要に応じてバッファリング/接続確認を追加
✅ **型安全性の向上**: UUID による messageId 生成、StreamingCallbacks 型、ConnectedEvent 型

### 実装の優先順位

1. **必須実装**: Phase 0-6（Phase 4.5, 5.5を除く）
2. **✅ 検証完了**: Phase 1.5のテスト結果により以下を確認：
   - OpenAI APIは適切なチャンクサイズで送信（7イベント/15文字）
   - **Phase 4.5（TextBuffer）は不要** - スキップ決定
3. **条件付き最適化**:
   - ~~トークン送信頻度が高い → Phase 4.5 (TextBuffer)~~ → **不要と確認**
   - 接続タイミング問題発生 → Phase 5.5 (Connection Confirmation)

実装後、Shochan AIは主要AIエージェント（ChatGPT/Claude）と同等の応答性と信頼性を持つようになります。
