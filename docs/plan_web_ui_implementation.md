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

### フェーズ1: 基盤整備 ✅ 完了

**目的:** モノレポ構造への移行と型システムの強化

**ステータス:** 2025-01-23 開始 → 2025-01-24 完了

**タスク:**

1. **モノレポ構造のセットアップ** ✅ 完了
   - ✅ `pnpm-workspace.yaml` 作成
   - ✅ `packages/core`, `packages/client`, `packages/cli` ディレクトリ作成（`packages/web` は Phase 4 で作成）
   - ✅ 各パッケージに `package.json`, `tsconfig.json` を配置
   - ✅ ルートの `package.json` に workspace 設定
   - ✅ `tsconfig.base.json` で共通 TypeScript 設定を定義

2. **既存コードの移行** ✅ 完了
   - ✅ `src/agent/`, `src/thread/`, `src/types/`, `src/prompts/`, `src/utils/` → `packages/core/src/`
   - ✅ `src/clients/` → `packages/client/src/`
   - ✅ `src/cli.ts` → `packages/cli/src/index.ts`（bin 対応のため index.ts にリネーム）
   - ✅ import パスを `@shochan_ai/core`, `@shochan_ai/client` 等に修正
   - ✅ `packages/core/src/index.ts` と `packages/client/src/index.ts` でエクスポート定義
   - ✅ CLI に shebang `#!/usr/bin/env node` を追加
   - ✅ 古い `src/` ディレクトリを削除

3. **依存関係の整理と循環依存の解決** ✅ 完了
   - ✅ TaskAgent を `packages/cli` に移動（循環依存を解消）
   - ✅ packages/core: 依存ゼロ（Thread, types のみ）
   - ✅ packages/client: core に依存
   - ✅ packages/cli: core と client に依存
   - ✅ `pnpm install` 実行成功

4. **ビルドと型チェック** ✅ 完了
   - ✅ `pnpm -r build` で全パッケージがエラーなしでビルド
   - ✅ TypeScript の型エラーゼロ
   - ✅ 型定義ファイル (.d.ts) が正しく生成
   - ✅ CLI の動作確認（`node packages/cli/dist/index.js`）

5. **テスト環境の整備** ✅ 完了
   - ✅ `vitest.config.ts` 作成
   - ✅ packages 配下のテストのみを実行するように設定
   - ✅ 全テスト (130 tests) がパス
   - ✅ node_modules 内の重複テスト実行を防止

6. **型定義の強化** 🔜 Phase 2 に延期
   - Discriminated Unions の導入
   - `any` の排除
   - より厳密な型定義

7. **StateStore インターフェースの定義** 🔜 Phase 2 に延期
   - Stateless Reducer パターンの実装と同時に対応

**完了条件達成状況:**
- ✅ `pnpm install` が成功する
- ✅ 循環依存を解決する
- ✅ 既存のテストが全てパスする (130/130)
- ✅ 型エラーがゼロ

**最終的なパッケージ構成:**
```
packages/
├── core/           # Thread, types, prompts, utils（依存ゼロ）
├── client/         # OpenAI/Notion クライアント（core に依存）
└── cli/            # CLI + TaskAgent（core, client に依存）
```

**判明した課題と対応:**
- ✅ TaskAgent の配置による循環依存 → packages/cli に移動して解決
- 🔜 Phase 2 で Stateless Reducer パターンに移行時に、正しいアーキテクチャに再設計

**所要時間:** 1-2日（予定）→ 実際: 1日で完了

---

### フェーズ2: Stateless Reducerパターンの実装 ✅ 完了

**完了日:** 2025-01-24

**目的:** 既存の `Thread` と `TaskAgent` を Stateless Reducer パターンにリファクタ

**実装済みタスク:**

1. ✅ **型定義の強化（Phase 1 から延期）**
   - Discriminated Unions の導入完了
   - `any` の排除と厳密な型定義完了
   - より型安全な Event, ToolCall の再定義完了
   - 実装: Phase 2.1

2. ✅ **StateStore インターフェースの定義（Phase 1 から延期）**
   - `packages/core/src/state/state-store.ts` 作成
   - `StateStore<T>` インターフェース定義
   - `InMemoryStateStore` 実装（CLI用）
   - テスト完備 (`in-memory-state-store.test.ts`)
   - 実装: Phase 2.2

3. ✅ **AgentReducer の実装**
   - `packages/core/src/agent/agent-reducer.ts` インターフェース定義
   - `packages/core/src/agent/thread-reducer.ts` 実装
   - `ThreadReducer` クラスで純粋な状態遷移を実装
   - テスト完備 (`thread-reducer.test.ts`)
   - 実装: Phase 2.4

4. ✅ **ToolExecutor の実装**
   - `packages/core/src/agent/tool-executor.ts` インターフェース定義
   - `packages/core/src/agent/notion-tool-executor.ts` 実装
   - 既存の Notion操作ロジックを移植
   - 型安全なツール実行
   - エラーハンドリング実装
   - テスト完備（Test Doubles使用、`notion-tool-executor.test.ts`）
   - 実装: Phase 2.3

5. ✅ **AgentOrchestrator の実装**
   - `packages/core/src/agent/agent-orchestrator.ts` 作成
   - `processEvent`, `executeToolCall`, `getState` メソッド実装
   - Reducer, Executor, StateStore の統合
   - テスト完備（vi.fn()使用、`agent-orchestrator.test.ts`）
   - 実装: Phase 2.5

6. ✅ **既存 Thread クラスの段階的廃止**
   - `Thread` クラスをデータ構造として保持（削除せず）
   - ビジネスロジックは Orchestrator に移行
   - 既存のイベント処理ロジックを Orchestrator に移行
   - 実装: Phase 2.6

7. ✅ **テストと型チェック**
   - 全テスト修正・追加完了
   - 型エラー修正完了
   - 実装: Phase 2.7

**実装結果:**
- ✅ 新しいアーキテクチャで全機能が動作
- ✅ 既存のテストを新アーキテクチャに合わせて修正し、全てパス（156/156 tests passing）
- ⚠️ `Thread` クラスは削除せず、データ構造として保持（ビジネスロジックは Orchestrator に移行）
- ✅ 型定義が Discriminated Unions で強化されている
- ✅ StateStore インターフェースが実装されている
- ✅ 全パッケージでビルド成功
- ✅ TypeScript型エラー0件

**アーキテクチャ詳細:**
- **AgentReducer**: 純粋関数による状態遷移 `(state, event) → newState`
- **ToolExecutor**: 副作用（API呼び出し、I/O）の実行
- **AgentOrchestrator**: Reducer、Executor、StateStore の調整役
- **StateStore**: 状態の永続化（InMemoryStateStore実装）
- **Thread**: イベント履歴を保持するデータ構造（不変性維持）

**実装上の技術的決定:**
- インターフェースと実装を別ファイルに分離（Single Responsibility Principle）
- 古典派テストアプローチ（Test Doublesを使用、実際のビジネスロジックをテスト）
- Zero-dependency core パッケージ（外部依存なし）
- vi.fn() によるモック検証（executor呼び出しの検証）

**所要時間:** 実際 3日

---

### フェーズ3: CLI のリファクタ ✅ 完了

**完了日:** 2025-01-24

**目的:** 新しいアーキテクチャでCLIを書き換え、既存機能の動作確認

**実装済みタスク:**

1. ✅ **CLI のリファクタ**
   - `packages/cli/src/index.ts` を新アーキテクチャで実装完了
   - `LLMAgentReducer` でLLM呼び出しを統合
   - `AgentOrchestrator` を使ったエージェントループ実装
   - `InMemoryStateStore` を使用
   - readline による対話処理実装

2. ✅ **承認フローの実装**
   - `delete_task` で承認プロンプト実装
   - ツールコールの `intent` から直接判定（`awaitingHumanApproval()` メソッドは削除）
   - 承認拒否時のグレースフルな終了

3. ✅ **エラーハンドリング**
   - 各イベントタイプに応じた適切な出力
   - エラー時のグレースフルな終了
   - ツールコールのログ出力

4. ✅ **不要なコードの削除**
   - `Thread.awaitingHumanResponse()` メソッド削除
   - `Thread.awaitingHumanApproval()` メソッド削除
   - `isAwaitingHumanResponseTool()` 関数削除
   - 関連テスト（7 tests）削除
   - `index.old.ts` 削除

**完了条件達成状況:**
- ✅ 型チェック成功（TypeScript エラー 0件）
- ✅ ビルド成功（全パッケージ）
- ✅ テスト成功（156/156 tests passing）
- ✅ 動作確認完了（Phase 3.6）

**動作確認結果（Phase 3.6）:**
- ✅ タスク取得: `pnpm cli "今週のタスクを表示"` → 正常動作
  - `get_tasks` ツール実行成功
  - Notionからタスク取得
  - `done_for_now` で適切に整形して表示
- ✅ 追加情報要求: `pnpm cli "存在しないタスクを削除して"` → 正常動作
  - 不明確な入力に対して `request_more_information` で質問
  - ユーザー入力待ち状態で正しく停止
- ✅ エージェントループ: AgentOrchestrator → LLMAgentReducer → NotionToolExecutor のフロー確認
- ✅ エラーハンドリング、ログ出力も正常

**実装結果:**
- ✅ Stateless Reducer パターンに完全準拠
- ✅ CLI固有のロジックは `packages/cli` に集約
- ✅ `LLMAgentReducer` でLLM呼び出しを抽象化
- ✅ 承認フロー、エラーハンドリング、ログ出力が完備

**アーキテクチャ改善:**
- **ステートレス**: すべての状態変更は Reducer/Orchestrator 経由
- **関心の分離**: ビジネスロジック（Orchestrator/Reducer）と副作用（Executor）を分離
- **型安全性**: Discriminated Unions で型エラーを防止
- **拡張性**: Web UI 実装時にコア部分を再利用可能

**所要時間:** 実際 1日

---

### フェーズ4: Web API の実装 ✅ 完了

**開始日:** 2025-12-20
**完了日:** 2025-12-30

**目的:** Express + SSE で Web API を実装し、Redis でセッション管理

**実装方針:**
- ローカル開発時も Redis を使用（Docker Compose でローカルRedis環境）
- 最初から Redis 対応で実装
- 認証機能は後回し（個人利用想定）

**タスク:**

#### Phase 4.1: Docker Compose でローカルRedis環境をセットアップ ✅

- ✅ `docker-compose.yml` 作成
- ✅ Redis コンテナ設定（ポート6379）
- ✅ 起動確認

#### Phase 4.2: packages/web パッケージの基本構成を作成 ✅

- ✅ ディレクトリ構造作成
  ```
  packages/web/
  ├── src/
  │   ├── server.ts
  │   ├── routes/
  │   ├── state/
  │   └── streaming/
  ├── package.json
  └── tsconfig.json
  ```
- ✅ `package.json` 設定
- ✅ `tsconfig.json` 設定
- ✅ 依存パッケージインストール
  - ✅ express
  - ✅ better-sse
  - ✅ redis
  - ✅ cors
  - ✅ supertest (テスト用)
  - ✅ 型定義パッケージ

#### Phase 4.3: RedisStateStore を実装 ✅

- ✅ `packages/web/src/state/redis-store.ts` 作成
- ✅ Thread の保存/取得/削除/一覧機能実装
- ✅ Redis接続管理 (connect/disconnect/isConnected)
- ✅ 有効期限設定（1時間 TTL）
- ✅ エラーハンドリング
- ✅ テスト作成 (`redis-store.test.ts`)

#### Phase 4.4: StreamManager を実装（better-sse） ✅

- ✅ `packages/web/src/streaming/manager.ts` 作成
- ✅ セッション管理 (register/unregister)
- ✅ イベント送信 (send)
- ✅ 接続/切断処理 (closeAll)
- ✅ ヘルパーメソッド (hasSession, getActiveSessionCount, getActiveConversationIds)
- ✅ テスト作成 (`manager.test.ts`)

#### Phase 4.5: Express サーバーとルーティングを実装 ✅ 完了

- ✅ `packages/web/src/server.ts` 作成
- ✅ `packages/web/src/app.ts` 作成（Express アプリ作成を分離）
- ✅ `packages/web/src/middleware/fallback-handlers.ts` 作成（404/エラーハンドラ分離）
- ✅ Express アプリケーション設定
- ✅ CORS middleware
- ✅ JSON parser middleware
- ✅ エラーハンドリング middleware
- ✅ ヘルスチェックエンドポイント (`/health`)
- ✅ routes の接続
  - ✅ `app.use('/api/agent', agentRouter);`
  - ✅ `app.use('/api/stream', streamRouter);`
- ✅ `initializeAgent()` の呼び出し
- ✅ テスト作成 (`server.test.ts`)

#### Phase 4.6: エージェントAPIルート実装（query, approve） ✅ 完了

- ✅ `packages/web/src/routes/agent.ts` 作成
- ✅ `initializeAgent()` 関数実装（RedisStore/StreamManager/Reducer/Executor初期化）
- ✅ `POST /api/agent/query` エンドポイント
  - ✅ リクエスト検証
  - ✅ conversationId 生成 (UUID)
  - ✅ Thread 初期化と Redis 保存
  - ✅ バックグラウンドでエージェント実行 (`processAgent`)
- ✅ `POST /api/agent/approve/:conversationId` エンドポイント
  - ✅ 承認/拒否の処理
  - ✅ 承認時は tool_call を直接実行（無限ループ防止）
  - ✅ Thread 更新と Redis 保存
  - ✅ エージェント再開
- ✅ `processAgent()` 関数実装
  - ✅ LLM による tool call 生成
  - ✅ 承認が必要なツールの一時停止 (delete_task)
  - ✅ ツール実行と結果のストリーミング
  - ✅ 終了条件の判定 (done_for_now, request_more_information)
- ✅ エラーハンドリング
- ✅ テスト作成 (`agent.test.ts`)

#### Phase 4.7: SSEストリーミングルート実装 ✅ 完了

- ✅ `packages/web/src/routes/stream.ts` 作成
- ✅ `GET /api/stream/:conversationId` エンドポイント
- ✅ SSE セッション作成 (better-sse createSession)
- ✅ StreamManager との統合
- ✅ 接続/切断イベント処理
- ✅ テスト作成 (`stream.test.ts`)

#### Phase 4.8: 統合テストと動作確認 ✅ 完了

- ✅ 環境変数の設定（`.env`）
  - ✅ `REDIS_URL=redis://localhost:6379`
  - ✅ `NOTION_API_KEY`
  - ✅ `OPENAI_API_KEY`
  - ✅ `NOTION_TASKS_DATABASE_ID`
  - ✅ `NOTION_PROJECTS_DATABASE_ID`
- ✅ Docker Compose でRedis起動確認
- ✅ Express サーバー起動確認（`pnpm start`）
- ✅ curl で API テスト
  - ✅ POST /api/agent/query
  - ✅ GET /api/stream/:conversationId
  - ✅ POST /api/agent/approve/:conversationId
- ✅ Redis データ確認
- ✅ エラーケースの確認
- ✅ vitest.config.ts の設定確認と修正
- ✅ 全テスト通過（188 tests）

**完了条件:**
- ✅ Docker Compose でローカルRedisが起動
- ✅ Express サーバーが起動
- ✅ REST API が正常に動作
- ✅ SSE でリアルタイムイベントを受信できる
- ✅ Redis に状態が保存される
- ✅ 全テストがパス（188 tests）
- ✅ 型エラーがゼロ

---

### フェーズ5: Next.js フロントエンドの実装

**目的:** チャット UI を実装し、Web API と統合（段階的に動作確認しながら進める）

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
- **プロジェクト構成**: ルート直下に Next.js プロジェクト配置（モノレポ外）
- **デプロイ**: Next.js (Vercel) + Express API (Railway)
- **API統合**: ハイブリッド方式（REST は API Routes 経由、SSE は直接接続）
- **状態管理**: React標準（useState）+ TanStack Query
- **UIライブラリ**: shadcn/ui を積極的に使用

**実装戦略:**
各フェーズで **必ず動作確認** を行い、段階的に機能を追加していきます。

```
Phase 5.1: 基盤セットアップ → ✅ Hello World 表示
Phase 5.2: shadcn/ui セットアップ → ✅ ボタン表示
Phase 5.3: 最小限のチャットUI → ✅ 入力・表示できる
Phase 5.4: モック API 統合 → ✅ モックレスポンス受信
Phase 5.5: Express API 統合 → ✅ E2E 動作
Phase 5.6: SSE リアルタイム通信 → ✅ ストリーミング受信
Phase 5.7: 承認ダイアログ実装 → ✅ 承認フロー動作
Phase 5.8: Storybook & テスト → ✅ 品質担保
```

---

## 📖 詳細な実装手順

Phase 5 の詳細な実装手順は、別ドキュメントにまとめています:

**👉 [Phase 5 詳細実装計画](./phase5_detailed_plan.md)**

各サブフェーズごとに:
- 具体的なタスク
- コード例
- 動作確認手順
- 完了条件

が記載されています。

---

## Phase 5 概要

**👉 Phase 5 の詳細な実装手順は [Phase 5 詳細実装計画](./phase5_detailed_plan.md) を参照してください。**

**実装戦略: "動くものを早く作る + テストも同時に書く"**

各フェーズで必ず動作確認を行い、段階的に機能を追加します。Phase 5.2 でテスト環境を整備し、以降のフェーズではコンポーネント実装と同時に Storybook とテストも作成します。

以下は各フェーズの概要です：

#### Phase 5.1: Next.js プロジェクトのセットアップ
- Next.js 15 + React 19 + TypeScript の基盤構築
- ✅ 検証: Hello World 表示

#### Phase 5.2: shadcn/ui + Storybook + テスト環境セットアップ
- UI コンポーネントライブラリ、Storybook、Vitest の導入
- Button コンポーネントの Story とテストを作成
- ✅ 検証: ボタン表示 + Storybook 起動 + テストパス

#### Phase 5.3: 最小限のチャット UI
- メッセージ入力・表示の基本機能実装
- MessageInput、MessageList の Story とテストを作成
- ✅ 検証: ローカル状態でチャット動作 + Story + Test

#### Phase 5.4: モック API 統合
- TanStack Query 導入、API クライアントの基礎実装
- API クライアントのテストを作成
- ✅ 検証: モックレスポンス受信 + Test

#### Phase 5.5: Express API 統合（REST）
- 実際の Express API との接続
- 統合テストを作成
- ✅ 検証: E2E でメッセージ送受信 + Test

#### Phase 5.6: SSE リアルタイム通信
- Server-Sent Events によるストリーミング実装
- SSE 接続のテストを作成
- ✅ 検証: リアルタイムメッセージ表示 + Test

#### Phase 5.7: 承認ダイアログ実装
- ツール使用承認フローの完成
- ApprovalDialog の Story とテストを作成
- ✅ 検証: 承認・拒否フロー動作 + Story + Test

#### Phase 5.8: 最終テスト・品質チェック
- テストカバレッジ確認、型チェック、ESLint チェック
- E2E シナリオテスト、パフォーマンスチェック
- ✅ 検証: カバレッジ 80%+、型エラーゼロ、ESLint エラーゼロ

---

### フェーズ6: デプロイと最適化

**目的:** Next.js（Vercel）と Express API（Railway）をデプロイし、本番環境で動作確認

**デプロイ戦略:**
- **Next.js**: Vercel にデプロイ
- **Express API**: Railway にデプロイ
- **Redis**: Railway の Redis アドオン

---

#### Phase 6.1: Railway で Express API をデプロイ

**目的:** Express API を本番環境にデプロイ

**タスク:**

1. **Railway プロジェクトのセットアップ**
   - Railway アカウント作成
   - GitHub リポジトリと連携
   - 新規プロジェクト作成

2. **Redis アドオンの追加**
   - Railway ダッシュボードで Redis を追加
   - `REDIS_URL` が自動的に環境変数に設定される

3. **環境変数の設定**
   - Railway ダッシュボードで設定
   ```
   REDIS_URL=redis://... (自動設定)
   NOTION_API_KEY=...
   OPENAI_API_KEY=...
   NOTION_TASKS_DATABASE_ID=...
   NOTION_PROJECTS_DATABASE_ID=...
   PORT=3001
   ```

4. **ビルド設定**
   - `railway.json` または `nixpacks.toml` で設定（必要に応じて）
   - ビルドコマンド: `pnpm install && pnpm --filter @shochan_ai/web build`
   - 起動コマンド: `pnpm --filter @shochan_ai/web start`

5. **デプロイとヘルスチェック**
   - デプロイ実行
   - `/health` エンドポイントで動作確認
   - ログを確認

**完了条件:**
- Railway で Express API が起動する
- Redis 接続が確立される
- `/health` エンドポイントが 200 を返す
- API エンドポイントが正常に動作する

---

#### Phase 6.2: Vercel で Next.js をデプロイ

**目的:** Next.js を Vercel にデプロイ

**タスク:**

1. **Vercel プロジェクトのセットアップ**
   - Vercel アカウント作成
   - GitHub リポジトリと連携
   - 新規プロジェクト作成

2. **環境変数の設定**
   - Vercel ダッシュボードで設定
   ```
   BACKEND_URL=https://your-app.railway.app (Railway の URL)
   NEXT_PUBLIC_STREAM_URL=https://your-app.railway.app
   ```

3. **ビルド設定**
   - Framework Preset: Next.js
   - Root Directory: `.`（ルート）
   - Build Command: `npm run build`（デフォルト）
   - Output Directory: `.next`（デフォルト）

4. **CORS 設定の確認**
   - Express API の CORS 設定で Vercel のドメインを許可
   - `packages/web/src/app.ts` を更新
   ```typescript
   const allowedOrigins = [
     'http://localhost:3000',
     'https://your-app.vercel.app',
   ]
   app.use(cors({ origin: allowedOrigins }))
   ```

5. **デプロイ**
   - Vercel にプッシュして自動デプロイ
   - プレビューデプロイで動作確認
   - 本番デプロイ

**完了条件:**
- Vercel で Next.js が起動する
- チャット画面が表示される
- Express API との通信が成功する
- SSE 接続が確立される

---

#### Phase 6.3: 本番環境での動作確認

**目的:** 本番環境で全機能が動作することを確認

**タスク:**

1. **機能テスト**
   - ✅ メッセージ送信
   - ✅ SSE リアルタイム通信
   - ✅ ツールコール実行
   - ✅ 承認フロー
   - ✅ エラーハンドリング

2. **パフォーマンス計測**
   - Lighthouse スコア確認
     - Performance: 90+
     - Accessibility: 90+
     - Best Practices: 90+
     - SEO: 90+
   - ページロード時間
   - SSE 接続確立時間
   - API レスポンスタイム

3. **エラーログの確認**
   - Railway のログ確認
   - Vercel のログ確認
   - エラーが発生していないか確認

4. **セキュリティチェック**
   - 環境変数が適切に隠蔽されているか
   - CORS 設定が適切か
   - HTTPS 通信が強制されているか

**完了条件:**
- ✅ 全機能が本番環境で動作する
- ✅ パフォーマンスが許容範囲
- ✅ エラーログにクリティカルなエラーがない
- ✅ セキュリティチェックに合格

---

#### Phase 6.4: 最適化とモニタリング設定

**目的:** パフォーマンス最適化とモニタリング設定

**タスク:**

1. **Next.js の最適化**
   - 画像最適化（Next.js Image コンポーネント）
   - フォント最適化（next/font）
   - バンドルサイズの確認と最適化
   - キャッシュ戦略の設定

2. **Express API の最適化**
   - Redis 接続プールの設定
   - SSE 接続のタイムアウト処理
   - レート制限の追加（将来的に）

3. **モニタリング設定（オプション）**
   - Vercel Analytics 有効化
   - Railway メトリクス確認
   - エラートラッキング（Sentry など）

4. **ドキュメント更新**
   - デプロイ手順を README に追加
   - 環境変数の説明を追加
   - トラブルシューティングガイド作成

**完了条件:**
- パフォーマンスが最適化される
- モニタリングが設定される
- ドキュメントが整備される

---

**所要時間:** 2-3日（予定）

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
- **Redis** - セッション管理（Railway アドオン）
- **OpenAI SDK** - LLM 統合
- **Notion SDK** - タスク管理

### フロントエンド
- **Next.js 15+** (App Router)
- **React 18+**
- **TypeScript**
- **Tailwind CSS** - スタイリング
- **shadcn/ui** - UI コンポーネントライブラリ
- **TanStack Query** - データフェッチング
- **EventSource API** - SSE クライアント（ネイティブ）
- **@modelcontextprotocol/ui** (Phase 7, オプション) - リッチな結果表示

### 開発ツール
- **pnpm** - パッケージマネージャー（workspace 機能）
- **TypeScript 5+** - 型システム
- **Vitest** - テスティングフレームワーク
- **Testing Library** - React コンポーネントテスト
- **Storybook** - コンポーネントカタログ
- **Biome** - Linter/Formatter
- **tsx** - TypeScript 実行環境

### インフラ
- **Vercel** - Next.js ホスティング
- **Railway** - Express API + Redis ホスティング
- **GitHub** - ソース管理・CI/CD

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
**最終更新:** 2025-12-31
**ステータス:** Phase 4 完了（Phase 1-4 完了、Phase 5 詳細計画完成）
