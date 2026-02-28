# Notion MCP Integration Research

> **関連Issue**: [#36 NotionDB Refactoring with MCP](https://github.com/shomrkm/shochan_ai/issues/36)
> **調査日**: 2026-02-23
> **目的**: Notion Official MCPを使ったカスタムAPIラッパーの置き換え可能性のPOC（概念実証）

---

## サマリー

| 項目 | 結果 |
|------|------|
| notion-mcp-serverの起動 | ✅ HTTPモード（Streamable HTTP）で動作確認 |
| NOTION_API_KEYによる認証 | ✅ `NOTION_TOKEN`として同一トークンが使用可能 |
| OpenAI SDK (v6.8.1) MCP型サポート | ✅ `Tool.Mcp`型が存在、型アサーション不要 |
| OpenAIからlocalhost MCPへの接続 | ❌ 外部公開URL必須（OpenAIのサーバーから接続するため） |
| MCPツールとカスタムfunctionの混在 | ✅ 型定義上は同一`tools`配列に混在可能 |
| Notion Remote MCP (OAuth) | ❌ インテグレーショントークンでは不可（OAuth 2.1必須） |

---

## 1. notion-mcp-server 動作確認

### 起動方法

```bash
# HTTPモードで起動（Streamable HTTP Transport）
NOTION_TOKEN=<integration_token> AUTH_TOKEN=<bearer_token_for_mcp> \
  npx @notionhq/notion-mcp-server --transport http --port 3002
```

**出力例:**
```
MCP Server listening on port 3002
Endpoint: http://0.0.0.0:3002/mcp
Health check: http://0.0.0.0:3002/health
Authentication: Bearer token required
```

### 認証仕様

| 環境変数 | 用途 |
|---------|------|
| `NOTION_TOKEN` | Notionインテグレーションのアクセストークン（`NOTION_API_KEY`と同じ値を使用可） |
| `AUTH_TOKEN` | MCPサーバーへのアクセス制御用Bearer token（任意） |

### MCPセッション確立手順

Streamable HTTP Transportはステートフルなセッションを使う：

```bash
# 1. セッション確立（initializeリクエスト）
curl -X POST http://localhost:3002/mcp \
  -H "Authorization: Bearer <AUTH_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"client","version":"1.0"}},"id":1}'
# レスポンスヘッダーに mcp-session-id が含まれる

# 2. tools/listで利用可能ツール確認
curl -X POST http://localhost:3002/mcp \
  -H "mcp-session-id: <session_id>" \
  -H "Authorization: Bearer <AUTH_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
```

---

## 2. notion-mcp-server が提供するツール一覧

`tools/list`の実行結果（合計22ツール）：

| ツール名 | 機能 |
|---------|------|
| `API-get-user` | ユーザー情報の取得 |
| `API-get-users` | ユーザー一覧の取得 |
| `API-get-self` | 自分のユーザー情報取得 |
| `API-post-search` | ページ/データベースの検索 |
| `API-get-block-children` | ブロックの子要素取得 |
| `API-patch-block-children` | ブロックの子要素追加 |
| `API-retrieve-a-block` | 特定ブロックの取得 |
| `API-update-a-block` | ブロックの更新 |
| `API-delete-a-block` | ブロックの削除 |
| `API-retrieve-a-page` | ページの取得 |
| `API-patch-page` | ページの更新 |
| `API-post-page` | ページの作成 |
| `API-retrieve-a-page-property` | ページプロパティの取得 |
| `API-retrieve-a-comment` | コメントの取得 |
| `API-create-a-comment` | コメントの作成 |
| `API-query-data-source` | データベース（データソース）のクエリ |
| `API-retrieve-a-data-source` | データベースの取得 |
| `API-update-a-data-source` | データベースの更新 |
| `API-create-a-data-source` | データベースの作成 |
| `API-list-data-source-templates` | データソーステンプレート一覧 |
| `API-retrieve-a-database` | データベース（レガシー互換）の取得 |
| `API-move-page` | ページの移動 |

### 現行ツールとのマッピング

| 現行カスタムツール | 対応するMCPツール |
|---------|------|
| `get_tasks` | `API-query-data-source` |
| `get_task_details` | `API-retrieve-a-page` + `API-get-block-children` |
| `create_task` | `API-post-page` |
| `update_task` | `API-patch-page` |
| `delete_task` | `API-patch-page`（is_archived=trueに相当する操作） |
| `create_project` | `API-post-page` または `API-create-a-data-source` |

**注意**: MCPのツールはNotionのREST APIをほぼ直接マッピングしており、現行の高レベルな抽象（`get_tasks`でフィルタリングなど）は、LLMがMCPツールをどう組み合わせるかに依存する。

---

## 3. OpenAI SDK (openai@6.8.1) の MCP型サポート

### 結論: 完全サポート済み・型アサーション不要

```typescript
import OpenAI from 'openai';

// ✅ Tool.Mcp型が存在し、型安全に使用可能
const mcpTool: OpenAI.Responses.Tool.Mcp = {
  type: 'mcp',
  server_label: 'notion',
  server_url: 'https://your-mcp-server.example.com/mcp',
  headers: { Authorization: 'Bearer your_token' },
  require_approval: 'never',
};

// ✅ Tool型のunionにTool.Mcpが含まれる
const tool: OpenAI.Responses.Tool = mcpTool; // 型アサーション不要
```

### 型定義詳細

```typescript
// openai@6.8.1 の型定義（responses.d.ts より）
export type Tool =
  | FunctionTool
  | FileSearchTool
  | ComputerTool
  | WebSearchTool
  | Tool.Mcp          // ✅ MCPツール
  | Tool.CodeInterpreter
  | Tool.ImageGeneration
  | Tool.LocalShell
  | FunctionShellTool
  | CustomTool
  | WebSearchPreviewTool
  | ApplyPatchTool;

declare namespace Tool {
  interface Mcp {
    server_label: string;         // MCPサーバーの識別ラベル
    type: 'mcp';                  // 常に 'mcp'
    allowed_tools?: Array<string> | Mcp.McpToolFilter | null;
    authorization?: string;       // OAuth Bearer token
    connector_id?: '...';         // ChatGPTサービスコネクタ
    headers?: { [key: string]: string } | null; // カスタムHTTPヘッダー
    require_approval?: Mcp.McpToolApprovalFilter | 'always' | 'never' | null;
    server_description?: string;
    server_url?: string;          // server_url または connector_id が必須
  }
}
```

### レスポンス型

```typescript
// MCP実行結果のoutput items
type McpCall = {
  type: 'mcp_call';
  server_label: string;
  name: string;            // 実行されたツール名
  arguments: string;       // JSON文字列（引数）
  output?: string | null;  // ツールの実行結果
  error?: string | null;   // エラーメッセージ
  status?: 'in_progress' | 'completed' | 'incomplete' | 'calling' | 'failed';
};

type McpListTools = {
  type: 'mcp_list_tools';
  server_label: string;
  tools: Array<{ name: string; description?: string; inputSchema: object }>;
};
```

---

## 4. OpenAIからのMCPサーバー接続要件

### 重要な制約：外部公開URLが必須

OpenAI Responses APIがMCPツールを実行する際、**OpenAIのサーバーがMCPサーバーへHTTP接続する**。
そのため、`localhost:3002`のようなローカルアドレスでは**接続不可**。

**POC実行時のエラー:**
```
424 Error retrieving tool list from MCP server: 'notion'. Http status code: 424 (Failed Dependency)
```

### 解決策

| 方法 | 特徴 | 本番利用 |
|------|------|---------|
| **ngrok / Cloudflare Tunnel** | ローカルサーバーを一時的に外部公開 | 開発/テスト向け |
| **クラウドデプロイ** | VPS/コンテナへデプロイ | 本番向け |
| **Notion Remote MCP** | `https://mcp.notion.com/mcp`（OAuth 2.1必須） | ユーザー対話型のみ |

### Notion Remote MCP（公式ホスト版）の制約

```
URL: https://mcp.notion.com/mcp
認証: OAuth 2.1 のみ
  → NOTION_API_KEY（インテグレーショントークン）では接続不可
  → ユーザーがブラウザでOAuth認証フローを完了する必要がある
  → 自動化・サーバーサイドのCI/CDには不向き
```

---

## 5. MCPツールとカスタムfunctionの混在

### 型定義上は完全に可能

```typescript
const response = await client.responses.create({
  model: 'gpt-4o',
  instructions: 'タスク管理アシスタントです。',
  input: 'タスク一覧を見せて',
  tools: [
    // MCPツール（Notionアクセス用）
    {
      type: 'mcp',
      server_label: 'notion',
      server_url: 'https://your-mcp-server.example.com/mcp',
      headers: { Authorization: 'Bearer your_token' },
      require_approval: 'never',
    } satisfies OpenAI.Responses.Tool.Mcp,

    // カスタムfunctionツール（制御フロー用）
    {
      type: 'function',
      name: 'done_for_now',
      description: 'タスクが完了したときに呼び出す',
      parameters: { type: 'object', properties: {}, required: [] },
    } satisfies OpenAI.Responses.FunctionTool,
  ],
});
```

### 実行フロー（期待される動作）

```
1. tools/list: MCPサーバーからツール一覧を取得
   → output: { type: 'mcp_list_tools', tools: [...] }

2. mcp_call: LLMがMCPツールを選択・実行
   → output: { type: 'mcp_call', name: 'API-query-data-source', output: '...' }

3. function_call: LLMがカスタムfunctionを選択
   → output: { type: 'function_call', name: 'done_for_now', arguments: '...' }
```

---

## 6. delete_task と人間承認フロー

### 現行の実装

`delete_task`は`API-patch-page`に相当する操作（Notionではページをアーカイブ/削除）。
MCPツールでは`API-patch-page`または`API-delete-a-block`が対応。

### 承認フロー設計

```typescript
// require_approvalで特定ツールのみ承認必須にできる
const mcpTool: OpenAI.Responses.Tool.Mcp = {
  type: 'mcp',
  server_label: 'notion',
  server_url: 'https://...',
  require_approval: {
    always: {
      tool_names: ['API-patch-page', 'API-delete-a-block', 'API-post-page'],
    },
  },
};
```

`require_approval: 'never'`にすると承認不要、`'always'`または特定ツール名を指定して承認フローを制御可能。

---

## 7. tool_response SSEイベントの扱い（MCP実行時）

### 現行のSSEイベント構造

```
tool_response → { type: 'tool_response', content: string, toolCall: {...} }
```

### MCP統合後の変更点

MCP実行はOpenAI側で完結するため、**アプリケーション側からNotion APIへのリクエストが不要**になる。
SSEイベントの観点では：

- `tool_response`イベントの送出ロジックが変わる（NotionToolExecutorが不要）
- `mcp_call`の結果はOpenAIレスポンスの`output`配列に含まれる
- 制御フロー（`done_for_now`等）のみが`function_call`として返る

```typescript
// After MCP integration: function_callのみ処理すればよい
const functionCallItem = response.output.find(
  (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
    item.type === 'function_call'
);
// mcp_call の処理はOpenAIが担当
```

---

## 8. 削除可能なコードの一覧

MCP統合が完成した場合に削除できるファイル・コード：

### 削除候補ファイル

| ファイル | 削除理由 |
|---------|---------|
| `packages/client/src/notion.ts` | NotionClientをOpenAIが代替 |
| `packages/client/src/notionUtils.ts` | Notionデータ変換が不要に |
| `packages/core/src/types/notion.ts` | Notion固有の型定義が不要に |
| `packages/core/src/agent/notion-tool-executor.ts` | Notion操作部分が不要に（制御フロー部分のみ残す） |

### 縮小候補ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/core/src/types/tools.ts` | Notion固有スキーマ（`createTaskSchema`〜`getTaskDetailsSchema`）を削除、`doneForNowSchema`と`requestMoreInformationSchema`のみ残す |
| `packages/core/src/agent/notion-tool-executor.ts` | Notion操作をすべて削除、`done_for_now`と`request_more_information`の処理のみに縮小 |
| `packages/client/src/openai.ts` | `tools`パラメータ型を`FunctionTool[]`から`Tool[]`に変更してMCPツールをサポート |

### 変更候補ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/core/src/agent/agent-orchestrator.ts` | MCPツール定義を追加、NotionToolExecutorの依存を除去 |
| `packages/web/src/routes/agent.ts` | NotionClientの初期化・依存を除去 |

---

## 9. 本実装に向けた推奨実装方針

### Phase 1: インフラ準備（前提条件）

1. **notion-mcp-serverのデプロイ先確保**
   - Option A: Dockerコンテナ化してクラウド（Railway, Fly.io等）にデプロイ
   - Option B: 開発時はngrokで外部公開（`ngrok http 3002`）
   - 環境変数: `NOTION_MCP_SERVER_URL`, `NOTION_MCP_AUTH_TOKEN`を追加

2. **環境変数の整理**
   ```env
   # 追加
   NOTION_MCP_SERVER_URL=https://your-mcp-server.example.com/mcp
   NOTION_MCP_AUTH_TOKEN=your_secure_bearer_token

   # 削除予定（MCP移行後）
   # NOTION_API_KEY=...
   # NOTION_TASKS_DATABASE_ID=...
   # NOTION_PROJECTS_DATABASE_ID=...
   ```

### Phase 2: OpenAIClientの更新

```typescript
// packages/client/src/openai.ts
// Params型のtools配列をFunctionTool[]からTool[]へ変更
type Params = {
  systemPrompt: string;
  inputMessages: InputMessage[];
  tools?: OpenAI.Responses.Tool[];  // FunctionTool[] → Tool[]
};
```

### Phase 3: MCPツール定義の追加

```typescript
// packages/core/src/agent/agent-orchestrator.ts
import type OpenAI from 'openai';

function buildMcpTool(): OpenAI.Responses.Tool.Mcp {
  const serverUrl = process.env.NOTION_MCP_SERVER_URL;
  const authToken = process.env.NOTION_MCP_AUTH_TOKEN;

  if (!serverUrl) throw new Error('NOTION_MCP_SERVER_URL is required');

  return {
    type: 'mcp',
    server_label: 'notion',
    server_url: serverUrl,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    require_approval: 'never',  // または削除系ツールは 'always'
  };
}
```

### Phase 4: NotionToolExecutorの縮小

```typescript
// 制御フロー専用に縮小
export class ControlFlowToolExecutor implements ToolExecutor {
  async execute(toolCall: ControlFlowToolCall): Promise<ToolExecutionResult> {
    if (toolCall.intent === 'done_for_now') {
      return { event: { type: 'tool_response', content: 'done', toolCall } };
    }
    if (toolCall.intent === 'request_more_information') {
      return { event: { type: 'tool_response', content: 'need_info', toolCall } };
    }
    throw new Error(`Unknown control flow tool: ${toolCall.intent}`);
  }
}
```

### Phase 5: プロンプト更新

システムプロンプトをMCPツール名（`API-query-data-source`等）に合わせて更新。LLMがMCPツールをどう使うか（データベースIDをどう指定するか等）のガイダンスが必要。

---

## 10. リスクと注意事項

| リスク | 詳細 | 対策 |
|--------|------|------|
| **notion-mcp-serverがメンテナンスモード** | `@notionhq/notion-mcp-server`は積極的な開発が停止 | Notion公式のRemote MCP移行待ち、またはフォーク/自作 |
| **Notion Remote MCPのOAuth要件** | `https://mcp.notion.com/mcp`はOAuth 2.1必須でサーバー間認証に不向き | セルフホスト版を継続使用 |
| **外部公開MCPサーバーのセキュリティ** | MCPサーバーを外部公開するとNotionへのアクセスが露出 | Bearer token認証の徹底、ファイアウォール設定 |
| **MCPツール名の変更リスク** | `API-query-data-source`等の名前はNotion側の仕様変更で変わり得る | プロンプトの柔軟な記述、テストの整備 |
| **LLMのMCPツール活用精度** | 高レベルな抽象（`get_tasks`）と比べてMCPは低レベルなAPIで、LLMが適切に使えるか要検証 | システムプロンプトでの詳細ガイダンス |

---

## 11. 参考リンク

- [OpenAI Remote MCP ガイド](https://platform.openai.com/docs/guides/tools-remote-mcp)
- [Notion MCP Server (npm)](https://www.npmjs.com/package/@notionhq/notion-mcp-server)
- [MCP Streamable HTTP Transport仕様](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http)
- [openai@6.8.1 型定義](packages/client/node_modules/openai/resources/responses/responses.d.ts)
- [POCスクリプト](../poc/mcp-integration-poc.ts)
