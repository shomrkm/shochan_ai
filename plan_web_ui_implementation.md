# Web UI Implementation Plan

## 目次
- [概要](#概要)
- [背景と目的](#背景と目的)
- [アーキテクチャ調査結果](#アーキテクチャ調査結果)
- [最終的なアーキテクチャ設計](#最終的なアーキテクチャ設計)
- [実装フェーズ](#実装フェーズ)
- [技術スタック](#技術スタック)
- [参考リソース](#参考リソース)

---

## 概要

現在CLIツールとして実装されている shochan_ai に Web UI を追加し、ブラウザからチャット形式でエージェントとやり取りできるようにする。

**主要な要件:**
- Next.js (App Router) でチャット UI を実装
- Vercel でホスティング
- 初期段階では認証機能不要（個人利用想定）
- リアルタイムでエージェントの処理状況をストリーミング表示
- 将来的に mcp-ui を使ってリッチな結果表示
- 既存のCLIツールは引き続き利用可能
- CLI と Web でコードを最大限共通化

---

## 背景と目的

### 現状
- CLI から OpenAI Responses API + Notion API を利用したタスク管理エージェント
- コマンドライン引数でメッセージを渡し、対話的に処理
- `Thread` クラスでイベント管理、`TaskAgent` クラスでビジネスロジック

### 課題
1. CLI のみでアクセス性が低い
2. 現在の実装はステートフルで、Web API化・スケーラビリティに課題
3. 長時間実行タスクへの対応が不十分
4. 型安全性が低い（`any` の使用、Discriminated Unions の不在）

### 目標
1. ブラウザからアクセス可能な Web UI の提供
2. スケーラブルなアーキテクチャへのリファクタ
3. リアルタイムストリーミングでの進捗表示
4. CLI と Web のコード共通化による保守性向上
5. 学習を兼ねた本格的な実装（モノレポ、Redis、SSE など）

---

## アーキテクチャ調査結果

### 調査対象
1. [12-factor-agents (HumanLayer)](https://github.com/humanlayer/12-factor-agents)
2. [Gemini CLI (Google)](https://github.com/google-gemini/gemini-cli)
3. [Vercel CLI](https://github.com/vercel/vercel)
4. その他のエージェントフレームワーク (Mastra, VoltAgent)

### 主要な学び

#### 1. Stateless Reducer Pattern (12-factor-agents)

**原則:**
- エージェントを純粋関数として設計: `(state, input) → (newState, outputs)`
- 状態は明示的にスナップショットとして渡され、内部状態に依存しない
- すべての状態変化が追跡可能で、再現性が高い

**実装イメージ:**
```typescript
interface AgentState {
  conversationId: string;
  context: Event[];
  status: 'running' | 'paused' | 'completed' | 'failed';
  metadata: Record<string, unknown>;
}

type AgentReducer = (
  state: AgentState,
  input: Event
) => Promise<{ newState: AgentState; toolCall: ToolCall | null }>;
```

**メリット:**
- 水平スケーラビリティ（任意のサーバーで状態を処理可能）
- デバッグ容易性（状態の変化を追跡しやすい）
- テストのしやすさ（純粋関数なので予測可能）
- Redis等への状態保存が容易

#### 2. Launch/Pause/Resume Pattern

**原則:**
- エージェントを起動(Launch)、一時停止(Pause)、再開(Resume)できる
- 長時間実行タスクや人間の承認待ちに対応
- 状態を永続化し、外部トリガーで再開可能

**実装イメージ:**
```typescript
class AgentOrchestrator {
  async launch(initialState: AgentState): Promise<string> {
    const conversationId = generateId();
    await stateStore.save(conversationId, initialState);
    return conversationId;
  }

  async pause(conversationId: string): Promise<void> {
    const state = await stateStore.get(conversationId);
    state.status = 'paused';
    await stateStore.save(conversationId, state);
  }

  async resume(conversationId: string, input?: Event): Promise<void> {
    const state = await stateStore.get(conversationId);
    if (input) state.context.push(input);
    state.status = 'running';
    await stateStore.save(conversationId, state);
    // エージェント実行を再開
  }
}
```

#### 3. 共有クライアントパターン (Vercel CLI)

**原則:**
- CLI と Web API で同じクライアントインスタンスを共有
- 認証、エラーハンドリング、リトライロジックを統一
- 各コマンド/エンドポイントはクライアントを受け取って処理

**実装イメージ:**
```typescript
// core/client.ts
export class APIClient {
  constructor(private config: ClientConfig) {}
  async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    // 認証、リトライ、エラーハンドリングを統一
  }
}

// CLI
const client = new APIClient(getCLIConfig());
await executeCommand(client, args);

// Web API
const client = new APIClient(getServerConfig());
await handleRequest(client, req);
```

#### 4. REST + SSE ハイブリッドアーキテクチャ

**原則:**
- WebSocket の複雑さを避けつつ、リアルタイムストリーミングを実現
- REST API でクエリを送信し、会話IDを即座に返却
- SSE (Server-Sent Events) で処理の進捗をストリーミング

**フロー:**
```
Client → POST /api/agent/query { message: "..." }
       ← { conversationId: "xxx" }

Client → GET /api/stream/:conversationId (SSE接続)
       ← data: {"type": "tool_call", ...}
       ← data: {"type": "tool_response", ...}
       ← data: {"type": "complete", ...}
```

**メリット:**
- Vercel の Function timeout (10秒/60秒) を回避
- ChatGPT のようなリアルタイムUXを実現
- HTTP標準で実装がシンプル

#### 5. Discriminated Unions による型安全性

**原則:**
- TypeScript の型システムを最大限活用
- ツールコールやイベントを Discriminated Union で表現
- コンパイル時に型エラーを検出

**実装イメージ:**
```typescript
type ToolCall =
  | { intent: 'create_task'; parameters: CreateTaskParams }
  | { intent: 'delete_task'; parameters: DeleteTaskParams }
  | { intent: 'update_task'; parameters: UpdateTaskParams };

// TypeScriptが自動的に型を絞り込み
function handleToolCall(toolCall: ToolCall) {
  switch (toolCall.intent) {
    case 'create_task':
      // toolCall.parameters は CreateTaskParams 型として推論
      createTask(toolCall.parameters);
      break;
    case 'delete_task':
      // toolCall.parameters は DeleteTaskParams 型として推論
      deleteTask(toolCall.parameters);
      break;
  }
}
```

---

## 最終的なアーキテクチャ設計

### ディレクトリ構成

```
shochan_ai/
├── packages/
│   ├── core/                    # ビジネスロジック（CLI & Web共通）
│   │   ├── src/
│   │   │   ├── agent/
│   │   │   │   ├── reducer.ts           # Stateless Reducer
│   │   │   │   └── orchestrator.ts      # Launch/Pause/Resume管理
│   │   │   ├── state/
│   │   │   │   ├── store.ts             # StateStoreインターフェース
│   │   │   │   └── memory-store.ts      # インメモリ実装
│   │   │   ├── tools/
│   │   │   │   ├── registry.ts          # ツール定義
│   │   │   │   └── executor.ts          # ツール実行
│   │   │   └── types/
│   │   │       └── index.ts             # 型定義（Discriminated Unions）
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── client/                  # API クライアント（共通）
│   │   ├── src/
│   │   │   ├── notion-client.ts
│   │   │   ├── openai-client.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                     # CLI専用
│   │   ├── src/
│   │   │   ├── index.ts                 # CLIエントリーポイント
│   │   │   ├── commands/
│   │   │   └── ui/
│   │   │       ├── prompt.ts            # readline処理
│   │   │       └── output.ts            # コンソール出力
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                     # Web API専用
│       ├── src/
│       │   ├── server.ts                # Expressサーバー
│       │   ├── routes/
│       │   │   ├── agent.ts             # エージェントAPI
│       │   │   └── stream.ts            # SSEストリーミング
│       │   ├── state/
│       │   │   └── redis-store.ts       # Redis実装
│       │   └── streaming/
│       │       └── manager.ts           # StreamManager
│       ├── package.json
│       └── tsconfig.json
│
├── app/                         # Next.js App Router（フロントエンド）
│   ├── api/                     # API Routes（Next.js経由でExpressを呼ぶ）
│   ├── page.tsx                 # チャット画面
│   └── layout.tsx
│
├── components/                  # React コンポーネント
│   ├── Chat/
│   │   ├── ChatInterface.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   └── TaskResultDisplay.tsx        # mcp-ui統合用
│   └── ui/                      # shadcn/ui等
│
├── package.json                 # ルートパッケージ
├── pnpm-workspace.yaml          # pnpm workspace設定
└── tsconfig.base.json           # 共通TypeScript設定
```

### コアコンポーネント

#### 1. AgentState（状態管理）

```typescript
// packages/core/src/types/index.ts

export interface AgentState {
  conversationId: string;
  context: Event[];
  status: 'running' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  lastUpdate: number;
  systemPrompt?: string;
  availableTools?: string[];
  metadata?: Record<string, unknown>;
}
```

#### 2. Event（イベント定義）

```typescript
export type EventType =
  | 'user_input'
  | 'tool_call'
  | 'tool_response'
  | 'error'
  | 'complete'
  | 'awaiting_approval';

interface BaseEvent<T extends EventType> {
  type: T;
  timestamp: number;
  conversationId: string;
}

export type Event =
  | (BaseEvent<'user_input'> & { data: string })
  | (BaseEvent<'tool_call'> & { data: ToolCall })
  | (BaseEvent<'tool_response'> & { data: unknown })
  | (BaseEvent<'error'> & { data: { error: string; code?: string } })
  | (BaseEvent<'complete'> & { data: AgentState })
  | (BaseEvent<'awaiting_approval'> & { data: ToolCall });
```

#### 3. ToolCall（ツール呼び出し）

```typescript
export type ToolIntent =
  | 'create_task'
  | 'create_project'
  | 'update_task'
  | 'delete_task'
  | 'get_tasks'
  | 'get_task_details'
  | 'done_for_now'
  | 'request_more_information';

export type ToolCall =
  | { intent: 'create_task'; parameters: CreateTaskParams }
  | { intent: 'create_project'; parameters: CreateProjectParams }
  | { intent: 'update_task'; parameters: UpdateTaskParams }
  | { intent: 'delete_task'; parameters: DeleteTaskParams }
  | { intent: 'get_tasks'; parameters: GetTasksParams }
  | { intent: 'get_task_details'; parameters: GetTaskDetailsParams }
  | { intent: 'done_for_now'; parameters: DoneParams }
  | { intent: 'request_more_information'; parameters: RequestInfoParams };
```

#### 4. AgentReducer（Stateless Reducer）

```typescript
// packages/core/src/agent/reducer.ts

export interface AgentReducer {
  reduce(state: AgentState, input: Event): Promise<{
    newState: AgentState;
    toolCall: ToolCall | null;
  }>;
}

export class TaskAgentReducer implements AgentReducer {
  constructor(private llmClient: LLMClient) {}

  async reduce(state: AgentState, input: Event): Promise<{
    newState: AgentState;
    toolCall: ToolCall | null;
  }> {
    // コンテキストを構築
    const context = [...state.context, input];

    // LLMで次のステップを決定
    const toolCall = await this.llmClient.generateToolCall({
      systemPrompt: state.systemPrompt,
      context: this.serializeContext(context),
      tools: state.availableTools,
    });

    // 新しい状態を返す（元の状態は変更しない）
    return {
      newState: {
        ...state,
        context,
        lastUpdate: Date.now(),
      },
      toolCall,
    };
  }
}
```

#### 5. AgentOrchestrator（Launch/Pause/Resume）

```typescript
// packages/core/src/agent/orchestrator.ts

export class AgentOrchestrator {
  constructor(
    private reducer: AgentReducer,
    private executor: ToolExecutor,
    private stateStore: StateStore<AgentState>
  ) {}

  async launch(initialContext: Event[]): Promise<string> {
    const conversationId = this.generateId();
    const initialState: AgentState = {
      conversationId,
      context: initialContext,
      status: 'running',
      createdAt: Date.now(),
      lastUpdate: Date.now(),
    };
    await this.stateStore.set(conversationId, initialState);
    return conversationId;
  }

  async *execute(conversationId: string): AsyncGenerator<Event> {
    let state = await this.stateStore.get(conversationId);
    if (!state) throw new Error('Conversation not found');

    while (state.status === 'running') {
      // Reducerで次のステップを決定
      const { newState, toolCall } = await this.reducer.reduce(
        state,
        state.context[state.context.length - 1]
      );

      state = newState;
      await this.stateStore.set(conversationId, state);

      if (!toolCall) {
        state.status = 'completed';
        await this.stateStore.set(conversationId, state);
        yield {
          type: 'complete',
          data: state,
          timestamp: Date.now(),
          conversationId
        };
        break;
      }

      // Tool callイベントをストリーミング
      yield {
        type: 'tool_call',
        data: toolCall,
        timestamp: Date.now(),
        conversationId,
      };

      // 承認が必要な場合は一時停止
      if (this.requiresApproval(toolCall)) {
        state.status = 'paused';
        await this.stateStore.set(conversationId, state);
        yield {
          type: 'awaiting_approval',
          data: toolCall,
          timestamp: Date.now(),
          conversationId
        };
        break;
      }

      // ツールを実行
      const result = await this.executor.execute(toolCall);
      const responseEvent: Event = {
        type: 'tool_response',
        data: result,
        timestamp: Date.now(),
        conversationId,
      };

      state.context.push(responseEvent);
      await this.stateStore.set(conversationId, state);
      yield responseEvent;
    }
  }

  async resume(conversationId: string, approvalEvent: Event): Promise<void> {
    const state = await this.stateStore.get(conversationId);
    if (!state) throw new Error('Conversation not found');

    state.context.push(approvalEvent);
    state.status = 'running';
    await this.stateStore.set(conversationId, state);
  }

  private requiresApproval(toolCall: ToolCall): boolean {
    return toolCall.intent === 'delete_task';
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 6. StateStore（状態永続化）

```typescript
// packages/core/src/state/store.ts

export interface StateStore<T> {
  get(id: string): Promise<T | null>;
  set(id: string, state: T): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<Array<{ id: string; state: T }>>;
}

// メモリ実装（CLI用）
export class InMemoryStateStore<T> implements StateStore<T> {
  private store = new Map<string, T>();

  async get(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async set(id: string, state: T): Promise<void> {
    this.store.set(id, state);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async list(): Promise<Array<{ id: string; state: T }>> {
    return Array.from(this.store.entries()).map(([id, state]) => ({ id, state }));
  }
}

// Redis実装（Web用）
// packages/web/src/state/redis-store.ts

import { createClient } from 'redis';
import type { StateStore, AgentState } from '@shochan_ai/core';

export class RedisStateStore implements StateStore<AgentState> {
  private client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  constructor() {
    this.client.connect();
  }

  async get(id: string): Promise<AgentState | null> {
    const data = await this.client.get(`agent:${id}`);
    return data ? JSON.parse(data) : null;
  }

  async set(id: string, state: AgentState): Promise<void> {
    await this.client.set(
      `agent:${id}`,
      JSON.stringify(state),
      { EX: 3600 } // 1時間でexpire
    );
  }

  async delete(id: string): Promise<void> {
    await this.client.del(`agent:${id}`);
  }

  async list(): Promise<Array<{ id: string; state: AgentState }>> {
    const keys = await this.client.keys('agent:*');
    const states = await Promise.all(
      keys.map(async (key) => {
        const data = await this.client.get(key);
        return {
          id: key.replace('agent:', ''),
          state: JSON.parse(data!) as AgentState,
        };
      })
    );
    return states;
  }
}
```

#### 7. StreamManager（SSEストリーミング）

```typescript
// packages/web/src/streaming/manager.ts

import type { Session } from 'better-sse';
import type { Event } from '@shochan_ai/core';

export class StreamManager {
  private sessions = new Map<string, Session>();

  register(conversationId: string, session: Session): void {
    this.sessions.set(conversationId, session);
  }

  send(conversationId: string, event: Event): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;
    session.push(event, event.type);
  }

  unregister(conversationId: string): void {
    this.sessions.delete(conversationId);
  }
}
```

### API設計

#### REST API

**1. クエリ送信**
```
POST /api/agent/query
Request: { message: string }
Response: { conversationId: string }
```

**2. SSEストリーミング**
```
GET /api/stream/:conversationId
Response: text/event-stream
  data: {"type": "tool_call", "data": {...}, ...}
  data: {"type": "tool_response", "data": {...}, ...}
  data: {"type": "complete", "data": {...}, ...}
```

**3. 承認**
```
POST /api/agent/approve/:conversationId
Request: { approved: boolean }
Response: { success: boolean }
```

#### Web API実装例

```typescript
// packages/web/src/routes/agent.ts

import { Router } from 'express';
import { AgentOrchestrator } from '@shochan_ai/core';
import { getStreamManager } from './stream';

const router = Router();
const orchestrator = new AgentOrchestrator(/* ... */);

// クエリ送信
router.post('/query', async (req, res) => {
  const { message } = req.body;
  const conversationId = await orchestrator.launch([
    {
      type: 'user_input',
      data: message,
      timestamp: Date.now(),
      conversationId: ''
    }
  ]);

  // 非同期でエージェント実行
  processAgent(conversationId).catch(console.error);

  res.json({ conversationId });
});

// 承認
router.post('/approve/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const { approved } = req.body;

  await orchestrator.resume(conversationId, {
    type: 'user_input',
    data: approved ? 'approved' : 'denied',
    timestamp: Date.now(),
    conversationId,
  });

  processAgent(conversationId).catch(console.error);
  res.json({ success: true });
});

async function processAgent(conversationId: string) {
  const streamManager = getStreamManager();
  try {
    for await (const event of orchestrator.execute(conversationId)) {
      streamManager.send(conversationId, event);
    }
  } catch (error) {
    streamManager.send(conversationId, {
      type: 'error',
      data: { error: error.message },
      timestamp: Date.now(),
      conversationId,
    });
  }
}

export { router as agentRouter };
```

```typescript
// packages/web/src/routes/stream.ts

import { Router } from 'express';
import { createSession } from 'better-sse';
import { StreamManager } from '../streaming/manager';

const router = Router();
const streamManager = new StreamManager();

router.get('/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const session = await createSession(req, res);

  streamManager.register(conversationId, session);
  session.push({ type: 'connected', conversationId }, 'connected');

  req.on('close', () => {
    streamManager.unregister(conversationId);
  });
});

export { router as streamRouter };
export function getStreamManager(): StreamManager {
  return streamManager;
}
```

---

## 実装フェーズ

### フェーズ1: 基盤整備

**目的:** モノレポ構造への移行と型システムの強化

**タスク:**

1. **モノレポ構造のセットアップ**
   - `pnpm-workspace.yaml` 作成
   - `packages/core`, `packages/client`, `packages/cli`, `packages/web` ディレクトリ作成
   - 各パッケージに `package.json`, `tsconfig.json` を配置
   - ルートの `package.json` に workspace 設定

2. **既存コードの移行**
   - `src/agent/`, `src/thread/`, `src/types/` → `packages/core/src/`
   - `src/clients/` → `packages/client/src/`
   - `src/cli.ts` → `packages/cli/src/`
   - import パスを `@shochan_ai/core` 等に修正

3. **型定義の強化**
   - `packages/core/src/types/index.ts` で Discriminated Unions 定義
   - `ToolCall`, `Event`, `AgentState` の型を厳密に定義
   - 既存の `any` を排除

4. **StateStore インターフェースの定義**
   - `packages/core/src/state/store.ts` にインターフェース定義
   - `InMemoryStateStore` 実装（CLI用）

**完了条件:**
- `pnpm install` が成功する
- 既存のテストが全てパスする
- 型エラーがゼロ

**所要時間:** 1-2日

---

### フェーズ2: Stateless Reducerパターンの実装

**目的:** 既存の `Thread` と `TaskAgent` を Stateless Reducer パターンにリファクタ

**タスク:**

1. **AgentReducer の実装**
   - `packages/core/src/agent/reducer.ts` 作成
   - `TaskAgentReducer` クラス実装
   - LLM呼び出しロジックを既存コードから移植
   - コンテキストのシリアライズ処理

2. **ToolExecutor の実装**
   - `packages/core/src/tools/executor.ts` 作成
   - 既存の Notion操作ロジックを移植
   - 型安全なツール実行

3. **AgentOrchestrator の実装**
   - `packages/core/src/agent/orchestrator.ts` 作成
   - `launch`, `execute`, `resume` メソッド実装
   - AsyncGenerator を使ったストリーミング対応

4. **既存 Thread クラスの段階的廃止**
   - `Thread` クラスを Orchestrator + StateStore に置き換え
   - 既存のイベント処理ロジックを Orchestrator に移行

**完了条件:**
- 新しいアーキテクチャで全機能が動作
- 既存のテストを新アーキテクチャに合わせて修正し、全てパス
- `Thread` クラスが削除されている

**所要時間:** 3-5日

---

### フェーズ3: CLI のリファクタ

**目的:** 新しいアーキテクチャでCLIを書き換え、既存機能の動作確認

**タスク:**

1. **CLI のリファクタ**
   - `packages/cli/src/index.ts` を新アーキテクチャで実装
   - `AgentOrchestrator` を使ったエージェントループ
   - `InMemoryStateStore` を使用
   - readline による対話処理

2. **承認フローの実装**
   - `delete_task` 等の危険な操作で承認プロンプト
   - `orchestrator.resume()` による再開

3. **エラーハンドリング**
   - 各イベントタイプに応じた適切な出力
   - エラー時のグレースフルな終了

4. **動作確認**
   - 既存のCLI機能を全て手動テスト
   - タスク作成、更新、削除、取得
   - 承認フロー
   - エラーハンドリング

**完了条件:**
- `pnpm cli "今週のタスクを表示"` が正常に動作
- 既存のCLI機能が全て動作することを確認
- 承認フローが正しく機能

**所要時間:** 2-3日

---

### フェーズ4: Web API の実装

**目的:** Express + SSE で Web API を実装し、Vercel KV でセッション管理

**タスク:**

1. **Express サーバーのセットアップ**
   - `packages/web/src/server.ts` 作成
   - ルーティング設定
   - CORS, JSON middleware

2. **エージェント API の実装**
   - `packages/web/src/routes/agent.ts` 作成
   - `POST /api/agent/query` エンドポイント
   - `POST /api/agent/approve/:conversationId` エンドポイント

3. **SSE ストリーミングの実装**
   - `better-sse` ライブラリ導入
   - `packages/web/src/routes/stream.ts` 作成
   - `GET /api/stream/:conversationId` エンドポイント
   - `StreamManager` 実装

4. **Redis State Store の実装**
   - Vercel KV (Redis) のセットアップ
   - `packages/web/src/state/redis-store.ts` 作成
   - `StateStore` インターフェースの実装
   - 有効期限設定（1時間）

5. **環境変数の設定**
   - `.env` に `REDIS_URL` 追加
   - `NOTION_API_KEY`, `OPENAI_API_KEY` の確認

6. **ローカルでの動作確認**
   - `pnpm web:dev` でサーバー起動
   - curl で API テスト
   - SSE 接続確認

**完了条件:**
- Express サーバーが起動
- REST API が正常に動作
- SSE でリアルタイムイベントを受信できる
- Redis に状態が保存される

**所要時間:** 3-4日

---

### フェーズ5: Next.js フロントエンドの実装

**目的:** チャット UI を実装し、Web API と統合

**タスク:**

1. **Next.js プロジェクトのセットアップ**
   - `app/`, `components/` ディレクトリ作成
   - `app/layout.tsx`, `app/page.tsx` 実装
   - Tailwind CSS セットアップ

2. **チャットコンポーネントの実装**
   - `components/Chat/ChatInterface.tsx` - メインインターフェース
   - `components/Chat/MessageList.tsx` - メッセージ一覧
   - `components/Chat/MessageInput.tsx` - 入力欄
   - `components/Chat/ApprovalDialog.tsx` - 承認ダイアログ

3. **SSE クライアントの実装**
   - EventSource を使った SSE 接続
   - リアルタイムでメッセージを受信・表示
   - エラーハンドリング

4. **API 統合**
   - `POST /api/agent/query` でメッセージ送信
   - `GET /api/stream/:conversationId` で SSE 接続
   - `POST /api/agent/approve/:conversationId` で承認

5. **UI/UX の実装**
   - ローディング表示
   - エラー表示
   - タイピングインジケーター
   - レスポンシブデザイン

**完了条件:**
- チャット画面が表示される
- メッセージを送信できる
- リアルタイムで応答が表示される
- 承認フローが UI で完結する

**所要時間:** 4-5日

---

### フェーズ6: Vercel デプロイと最適化

**目的:** Vercel にデプロイし、本番環境で動作確認

**タスク:**

1. **Vercel プロジェクトのセットアップ**
   - Vercel CLI インストール
   - プロジェクト作成
   - Environment Variables 設定
     - `NOTION_API_KEY`
     - `OPENAI_API_KEY`
     - `REDIS_URL` (Vercel KV)

2. **Vercel KV のセットアップ**
   - Vercel ダッシュボードで KV 作成
   - `REDIS_URL` を環境変数に設定

3. **ビルド設定**
   - `vercel.json` 作成
   - ビルドコマンド設定
   - 出力ディレクトリ設定

4. **デプロイ**
   - `vercel deploy` 実行
   - 本番環境で動作確認

5. **パフォーマンス最適化**
   - SSE 接続の安定化
   - エラーログの確認
   - レスポンスタイムの計測

**完了条件:**
- Vercel にデプロイ成功
- 本番環境で全機能が動作
- SSE が安定して動作
- パフォーマンスが許容範囲

**所要時間:** 2-3日

---

### フェーズ7: mcp-ui 統合（オプション）

**目的:** タスク一覧などをリッチに表示

**タスク:**

1. **mcp-ui ライブラリの導入**
   - `@modelcontextprotocol/ui` インストール
   - 必要なコンポーネントの確認

2. **TaskResultDisplay の実装**
   - `components/Chat/TaskResultDisplay.tsx` 作成
   - `get_tasks` の結果をテーブル表示
   - `create_task` の結果をカード表示

3. **データ変換ロジック**
   - `packages/core/src/utils/result-parser.ts` 作成
   - LLM応答を構造化データに変換
   - mcp-ui に渡す形式に整形

4. **動作確認**
   - 各種ツールの結果が適切に表示される
   - レイアウトが崩れない

**完了条件:**
- タスク一覧がテーブル形式で表示
- プロジェクト一覧が見やすく表示
- レスポンシブデザインが保たれる

**所要時間:** 2-3日

---

## 技術スタック

### バックエンド
- **Node.js** + **TypeScript**
- **Express** - Web API サーバー
- **better-sse** - Server-Sent Events
- **Vercel KV (Redis)** - セッション管理
- **OpenAI SDK** - LLM 統合
- **Notion SDK** - タスク管理

### フロントエンド
- **Next.js 14+** (App Router)
- **React 18+**
- **Tailwind CSS** - スタイリング
- **EventSource API** - SSE クライアント
- **@modelcontextprotocol/ui** (オプション) - リッチな結果表示

### 開発ツール
- **pnpm** - パッケージマネージャー（workspace 機能）
- **TypeScript 5+** - 型システム
- **Vitest** - テスティング
- **Biome** - Linter/Formatter
- **tsx** - TypeScript 実行環境

### インフラ
- **Vercel** - ホスティング
- **Vercel KV** - Redis（無料枠: 月3万コマンド）
- **GitHub** - ソース管理

---

## 実装時の注意事項

### 1. 既存 CLI の保守

- フィーチャーブランチで作業し、main ブランチの CLI は常に動作する状態を保つ
- フェーズ2完了までは CLI が一時的に動かない期間が発生する
- 必要に応じて、旧実装を `src-legacy/` に退避

### 2. 型安全性の徹底

- `any` の使用を禁止
- Discriminated Unions を活用
- 型ガードを適切に実装
- `tsconfig.json` で `strict: true` を維持

### 3. テスト

- 各フェーズで既存テストを修正・追加
- 新しいコンポーネントには必ずテストを追加
- 統合テストで全体の動作を確認

### 4. エラーハンドリング

- すべての非同期処理で try-catch
- ユーザーにわかりやすいエラーメッセージ
- ログを適切に記録（本番環境での調査用）

### 5. セキュリティ

- 環境変数の適切な管理（`.env` を `.gitignore` に追加）
- Vercel Environment Variables で本番の秘密情報を管理
- CORS 設定（フロントエンドのドメインのみ許可）
- レート制限（将来的に）

### 6. パフォーマンス

- Redis の有効期限を適切に設定
- SSE 接続のタイムアウト処理
- 大量のイベントが発生する場合のバッファリング

---

## 参考リソース

### ドキュメント
- [12-factor-agents](https://github.com/humanlayer/12-factor-agents)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [Vercel CLI](https://github.com/vercel/vercel)
- [OpenAI Responses API](https://platform.openai.com/docs/guides/responses)
- [Notion API](https://developers.notion.com/)
- [Server-Sent Events Guide](https://tigerabrodi.blog/server-sent-events-a-practical-guide-for-the-real-world)
- [better-sse npm](https://www.npmjs.com/package/better-sse)

### TypeScript
- [Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)

### Next.js
- [App Router](https://nextjs.org/docs/app)
- [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Streaming](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#streaming)

### Vercel
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Function Limits](https://vercel.com/docs/functions/limitations)

---

## 次のステップ

1. このドキュメントをレビューし、不明点や追加要件を確認
2. フィーチャーブランチ `feature/web-ui-implementation` を作成
3. フェーズ1から順次実装を開始
4. 各フェーズ完了後に動作確認とレビュー
5. 最終的に main ブランチにマージ

---

**作成日:** 2025-01-23
**最終更新:** 2025-01-23
**ステータス:** 計画確定
