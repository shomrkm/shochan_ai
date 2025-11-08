# Anthropic API から OpenAI API への移行計画

## 概要

このドキュメントは、Shochan AI プロジェクトを Anthropic API (Claude) から OpenAI API (GPT) へ移行するための包括的な計画書です。

---

## 現状分析

### 使用中の Anthropic API 機能

#### 1. **SDK とバージョン**
- パッケージ: `@anthropic-ai/sdk@^0.59.0`
- モデル: `claude-sonnet-4-5-20250929` (Sonnet 4.5)
- Max Tokens: 1024

#### 2. **主要機能**
- **Messages API** (`client.messages.create()`)
- **Function Calling / Tool Use** (8つのツール定義)
- **会話履歴管理** (`conversationHistory`)
- **システムプロンプト** (`system` パラメータ)
- **リトライロジック** (指数バックオフ、最大3回)

#### 3. **影響を受けるファイル**

| ファイルパス | 役割 | 変更の必要性 |
|------------|------|------------|
| `src/clients/claude.ts` | Claude API クライアントラッパー | **完全書き換え** |
| `src/agent/task-agent.ts` | メインエージェントロジック | **部分修正** (インポートとクラス名) |
| `package.json` | 依存関係管理 | **依存関係変更** |
| `.env.example` | 環境変数テンプレート | **API キー名変更** |
| `README.md` | ドキュメント | **更新** |
| `docs/ARCHITECTURE.md` | アーキテクチャドキュメント | **更新** |

---

## OpenAI API 仕様

### 1. **SDK 情報**
- パッケージ: `openai@^4.77.3` (最新版)
- TypeScript サポート: 4.9以上
- インストール: `npm install openai`

### 2. **推奨モデル**
- **GPT-4o** (`gpt-4o`) - Function calling 対応、最新で最も高性能
- **GPT-4o mini** (`gpt-4o-mini`) - コスト効率重視の場合
- **GPT-4 Turbo** (`gpt-4-turbo`) - 代替オプション

### 3. **API 機能マッピング**

| Anthropic 機能 | OpenAI 相当機能 | 互換性 |
|---------------|---------------|--------|
| `messages.create()` | `chat.completions.create()` | ✅ 完全互換 |
| `tools` (Function calling) | `tools` (Function calling) | ✅ 完全互換 |
| `system` (システムプロンプト) | `messages[{role: 'system'}]` | ✅ 完全互換 |
| `conversationHistory` | `messages` 配列 | ✅ 完全互換 |
| `max_tokens` | `max_tokens` | ✅ 完全互換 |

### 4. **主な違い**

#### Anthropic API (現在)
```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  system: systemPrompt,
  messages: [...conversationHistory, { role: 'user', content: userMessage }],
  tools: tools,
});

const toolUse = response.content.find(c => c.type === 'tool_use');
return {
  intent: toolUse.name,
  parameters: toolUse.input
};
```

#### OpenAI API (移行後)
```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  max_tokens: 1024,
  messages: [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ],
  tools: tools,
});

const toolCall = response.choices[0]?.message.tool_calls?.[0];
return {
  intent: toolCall.function.name,
  parameters: JSON.parse(toolCall.function.arguments)
};
```

### 5. **ツール定義の違い**

#### Anthropic 形式
```typescript
{
  name: 'create_task',
  description: 'Create a new task in the GTD system',
  input_schema: {
    type: 'object',
    properties: { /* ... */ },
    required: ['title', 'description', 'task_type']
  }
}
```

#### OpenAI 形式
```typescript
{
  type: 'function',
  function: {
    name: 'create_task',
    description: 'Create a new task in the GTD system',
    parameters: {
      type: 'object',
      properties: { /* ... */ },
      required: ['title', 'description', 'task_type']
    }
  }
}
```

**差分**: OpenAI は `type: 'function'` でラップし、`input_schema` → `parameters` に変更

### 6. **エラーハンドリング**

#### Anthropic リトライ対象エラー
```typescript
[429, 500, 502, 503, 504, 529] // status codes
```

#### OpenAI リトライ対象エラー
```typescript
[429, 500, 502, 503, 504] // 529 (overloaded) は OpenAI では使用されない
```

---

## 移行戦略

### Phase 1: 準備フェーズ (所要時間: 30分)

#### 1.1 依存関係の更新
```bash
# Anthropic SDK の削除
npm uninstall @anthropic-ai/sdk

# OpenAI SDK のインストール
npm install openai@^4.77.3

# TypeScript 型チェック
npx tsc --noEmit
```

#### 1.2 環境変数の準備
`.env.example` を更新:
```diff
# AI API Keys
- ANTHROPIC_API_KEY=your_anthropic_api_key_here
+ OPENAI_API_KEY=your_openai_api_key_here
```

実際の `.env` ファイルに `OPENAI_API_KEY` を追加:
```bash
OPENAI_API_KEY=sk-proj-...
```

---

### Phase 2: コア実装フェーズ (所要時間: 1-2時間)

#### 2.1 `claude.ts` のリネームとリファクタリング

**ファイル名変更**:
```bash
mv src/clients/claude.ts src/clients/openai.ts
```

**実装の書き換え** (`src/clients/openai.ts`):

```typescript
import OpenAI from 'openai';
import type { ToolCall } from '../types/tools';

type Params = {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: OpenAI.ChatCompletionMessageParam[];
  tools?: OpenAI.ChatCompletionTool[];
};

export class OpenAIClient {
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateToolCall({
    systemPrompt,
    userMessage,
    conversationHistory = [],
    tools = [],
  }: Params): Promise<ToolCall | null> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const messages: OpenAI.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...conversationHistory,
          {
            role: 'user',
            content: userMessage,
          },
        ];

        const response = await this.client.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 1024,
          messages,
          tools: tools.length > 0 ? tools : undefined,
        });

        const choice = response.choices[0];
        if (!choice?.message.tool_calls || choice.message.tool_calls.length === 0) {
          return null;
        }

        const toolCall = choice.message.tool_calls[0];
        return {
          intent: toolCall.function.name,
          parameters: JSON.parse(toolCall.function.arguments) as Record<string, unknown>,
        };
      } catch (error) {
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(
            `🔄 OpenAI API error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`
          );
          await this.sleep(delay);
          continue;
        }

        console.error('OpenAI API error:', error);
        throw error;
      }
    }

    throw new Error('Max retries exceeded for OpenAI API');
  }

  private isRetryableError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      // Retry on 429 (rate limit), 500, 502, 503, 504
      return [429, 500, 502, 503, 504].includes(status);
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

#### 2.2 `task-agent.ts` の更新

```typescript
// Before
import { ClaudeClient } from '../clients/claude';

export class TaskAgent {
  private claude: ClaudeClient;

  constructor() {
    this.claude = new ClaudeClient();
  }

  private async determineNextStep(thread: Thread) {
    return await this.claude.generateToolCall({
      // ...
    });
  }
}
```

```typescript
// After
import { OpenAIClient } from '../clients/openai';

export class TaskAgent {
  private openai: OpenAIClient;

  constructor() {
    this.openai = new OpenAIClient();
  }

  private async determineNextStep(thread: Thread) {
    return await this.openai.generateToolCall({
      // ...
    });
  }
}
```

#### 2.3 ツール定義の変換

`task-agent.ts` の `determineNextStep` メソッド内のツール定義を OpenAI 形式に変換:

```typescript
// Before (Anthropic format)
tools: [
  {
    name: 'create_task',
    description: 'Create a new task in the GTD system',
    input_schema: {
      type: 'object',
      properties: { /* ... */ },
      required: ['title', 'description', 'task_type'],
    },
  },
  // ...
]
```

```typescript
// After (OpenAI format)
tools: [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task in the GTD system',
      parameters: {
        type: 'object',
        properties: { /* ... */ },
        required: ['title', 'description', 'task_type'],
      },
    },
  },
  // ...
]
```

**全8ツールを変換**:
1. `create_task`
2. `create_project`
3. `get_tasks`
4. `request_more_information`
5. `delete_task`
6. `update_task`
7. `get_task_details`
8. `done_for_now`

---

### Phase 3: 型定義の更新 (所要時間: 30分)

#### 3.1 型インポートの更新

`src/clients/openai.ts`:
```typescript
// Anthropic 型を OpenAI 型に置き換え
import OpenAI from 'openai';

type Params = {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: OpenAI.ChatCompletionMessageParam[];
  tools?: OpenAI.ChatCompletionTool[];
};
```

#### 3.2 会話履歴の型互換性

**Anthropic 型**:
```typescript
Anthropic.MessageParam[]
```

**OpenAI 型**:
```typescript
OpenAI.ChatCompletionMessageParam[]
```

型構造は互換性があるため、`Thread` クラスの変更は不要。

---

### Phase 4: テストと検証 (所要時間: 1-2時間)

#### 4.1 型チェック
```bash
npx tsc --noEmit
```

期待される結果: エラー0件

#### 4.2 ユニットテストの実行
```bash
npm test
```

期待される結果: 全テスト成功

#### 4.3 統合テスト (手動)

**テストシナリオ**:

1. **タスク取得**
   ```bash
   npm run cli "今日のタスクを教えて"
   ```
   期待: タスク一覧が表示される

2. **タスク作成**
   ```bash
   npm run cli "明日までにレポートを完成させるタスクを作成して"
   ```
   期待: タスクが正常に作成される

3. **プロジェクト作成**
   ```bash
   npm run cli "新しいWebサイト開発プロジェクトを作成して"
   ```
   期待: プロジェクトが正常に作成される

4. **タスク詳細取得**
   ```bash
   npm run cli "タスクID xxx の詳細を教えて"
   ```
   期待: タスク詳細が表示される

5. **タスク更新**
   ```bash
   npm run cli "タスク xxx を完了状態に更新して"
   ```
   期待: タスクが正常に更新される

6. **追加情報要求**
   ```bash
   npm run cli "タスクを作成したい"
   ```
   期待: 必要な情報を尋ねられる

7. **エラーハンドリング**
   - 無効な API キーでテスト
   - ネットワークエラーシミュレーション
   期待: 適切なエラーメッセージとリトライ動作

#### 4.4 パフォーマンス比較

| 項目 | Anthropic (Claude) | OpenAI (GPT-4o) | 備考 |
|-----|-------------------|----------------|------|
| 平均応答時間 | 測定予定 | 測定予定 | 初回実行時に記録 |
| トークン使用量 | 測定予定 | 測定予定 | Function calling の精度比較 |
| コスト | $15/MTok (input) | $2.50/MTok (input) | GPT-4o の方が安価 |

---

### Phase 5: ドキュメント更新 (所要時間: 30分)

#### 5.1 README.md の更新

```diff
## Prerequisites

- Node.js (v18 or higher)
- TypeScript
- Notion account with API access
- - Anthropic API key
+ - OpenAI API key
```

```diff
3. Create a `.env` file in the root directory with the following variables:
\`\`\`env
- ANTHROPIC_API_KEY=your_anthropic_api_key_here
+ OPENAI_API_KEY=your_openai_api_key_here
NOTION_API_KEY=your_notion_api_key_here
NOTION_TASKS_DATABASE_ID=your_notion_tasks_database_id
NOTION_PROJECTS_DATABASE_ID=your_notion_projects_database_id
\`\`\`
```

```diff
### Environment Variables

- - `ANTHROPIC_API_KEY`: Your Anthropic API key for AI access
+ - `OPENAI_API_KEY`: Your OpenAI API key for AI access
- `NOTION_API_KEY`: Your Notion integration token
- `NOTION_TASKS_DATABASE_ID`: The ID of your tasks Notion database
- `NOTION_PROJECTS_DATABASE_ID`: The ID of your projects Notion database
```

#### 5.2 `docs/ARCHITECTURE.md` の更新

```diff
## Core Components

### AI Client
- - **ClaudeClient** (`src/clients/claude.ts`)
+ - **OpenAIClient** (`src/clients/openai.ts`)
-   - Manages interaction with Anthropic's Claude API
+   - Manages interaction with OpenAI's GPT API
  - Handles tool calling and response parsing
  - Implements retry logic for API errors
```

#### 5.3 `.env.example` の最終確認

```env
# AI API Keys
OPENAI_API_KEY=your_openai_api_key_here

# Notion API
NOTION_API_KEY=your_notion_api_key_here
NOTION_TASKS_DATABASE_ID=your_task_db_id
NOTION_PROJECTS_DATABASE_ID=your_project_db_id

# Other settings
NODE_ENV=development
```

---

### Phase 6: Git コミット (所要時間: 15分)

#### 6.1 変更内容の確認
```bash
git status
git diff
```

#### 6.2 コミット
```bash
git add .
git commit -m "feat: migrate from Anthropic API to OpenAI API

- Replace @anthropic-ai/sdk with openai package
- Rename ClaudeClient to OpenAIClient
- Update tool definitions to OpenAI format
- Change environment variable from ANTHROPIC_API_KEY to OPENAI_API_KEY
- Update documentation (README.md, ARCHITECTURE.md)
- Maintain backward compatibility in type definitions
- Keep existing retry logic and error handling patterns

BREAKING CHANGE: Requires OPENAI_API_KEY instead of ANTHROPIC_API_KEY

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## リスクと対策

### リスク1: Function Calling の挙動の違い

**リスク**: Claude と GPT-4o で function calling の推論精度が異なる可能性

**対策**:
- システムプロンプトの微調整
- 各ツールの `description` を詳細化
- 実際の使用パターンでのテスト実施

### リスク2: 会話履歴のフォーマット違い

**リスク**: メッセージ形式の微妙な違いによる互換性問題

**対策**:
- `Thread` クラスの型定義を確認
- 必要に応じて型変換ロジックを追加
- 統合テストで会話の流れを検証

### リスク3: コストの変動

**リスク**: トークン使用量の変動によるコスト増加

**対策**:
- 初期段階でトークン使用量をモニタリング
- 必要に応じて `max_tokens` を調整
- GPT-4o mini への切り替えオプションを検討

### リスク4: API レート制限の違い

**リスク**: OpenAI のレート制限が Anthropic と異なる

**対策**:
- リトライロジックは既存実装を維持
- 429 エラーのハンドリングを確認
- 必要に応じて backoff 時間を調整

---

## ロールバック計画

万が一問題が発生した場合のロールバック手順:

### 1. Git リバート
```bash
git revert HEAD
```

### 2. 依存���係の復元
```bash
npm uninstall openai
npm install @anthropic-ai/sdk@^0.59.0
```

### 3. 環境変数の復元
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### 4. 動作確認
```bash
npx tsc --noEmit
npm test
npm run cli "今日のタスクを教えて"
```

---

## 成功基準

移行が成功したと判断する基準:

- [ ] TypeScript コンパイルエラー 0件
- [ ] 全ユニットテスト成功
- [ ] 全統合テストシナリオ成功
- [ ] タスク作成・取得・更新・削除が正常動作
- [ ] プロジェクト作成が正常動作
- [ ] エラーハンドリングとリトライが正常動作
- [ ] ドキュメントが最新状態に更新済み
- [ ] `.env.example` が正しく更新済み

---

## タイムライン

| Phase | タスク | 所要時間 | 累計時間 |
|-------|-------|---------|---------|
| 1 | 準備フェーズ | 30分 | 30分 |
| 2 | コア実装フェーズ | 1-2時間 | 2.5時間 |
| 3 | 型定義の更新 | 30分 | 3時間 |
| 4 | テストと検証 | 1-2時間 | 5時間 |
| 5 | ドキュメント更新 | 30分 | 5.5時間 |
| 6 | Git コミット | 15分 | 6時間 |

**総所要時間**: 約5-6時間

---

## チェックリスト

### Phase 1: 準備
- [ ] `npm uninstall @anthropic-ai/sdk`
- [ ] `npm install openai@^4.77.3`
- [ ] `.env` に `OPENAI_API_KEY` 追加
- [ ] `.env.example` 更新

### Phase 2: コア実装
- [ ] `src/clients/claude.ts` → `src/clients/openai.ts` リネーム
- [ ] `OpenAIClient` クラス実装
- [ ] `src/agent/task-agent.ts` のインポート更新
- [ ] 全8ツール定義を OpenAI 形式に変換

### Phase 3: 型定義
- [ ] 型インポートを `OpenAI` に変更
- [ ] `Params` 型の更新
- [ ] 型チェック実行 (`npx tsc --noEmit`)

### Phase 4: テスト
- [ ] ユニットテスト実行 (`npm test`)
- [ ] タスク取得テスト
- [ ] タスク作成テスト
- [ ] プロジェクト作成テスト
- [ ] タスク詳細取得テスト
- [ ] タスク更新テスト
- [ ] 追加情報要求テスト
- [ ] エラーハンドリングテスト

### Phase 5: ドキュメント
- [ ] `README.md` 更新
- [ ] `docs/ARCHITECTURE.md` 更新
- [ ] `.env.example` 最終確認

### Phase 6: コミット
- [ ] `git status` 確認
- [ ] `git diff` レビュー
- [ ] コミットメッセージ作成
- [ ] `git commit`

---

## 付録

### A. OpenAI モデル選択ガイド

| モデル | 用途 | コスト (Input) | 推奨度 |
|--------|------|---------------|--------|
| **gpt-4o** | 最高性能、複雑な function calling | $2.50/MTok | ⭐⭐⭐⭐⭐ |
| **gpt-4o-mini** | コスト重視、シンプルなタスク | $0.15/MTok | ⭐⭐⭐⭐ |
| **gpt-4-turbo** | 代替オプション | $10.00/MTok | ⭐⭐⭐ |

**推奨**: `gpt-4o` (最新、最高性能、Claude Sonnet 4.5 と同等レベル)

### B. コスト比較

**現在 (Anthropic Claude Sonnet 4.5)**:
- Input: $15.00 / Million Tokens
- Output: $75.00 / Million Tokens

**移行後 (OpenAI GPT-4o)**:
- Input: $2.50 / Million Tokens
- Output: $10.00 / Million Tokens

**コスト削減率**: 約83% (Input)、約87% (Output)

### C. 参考リンク

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Node.js SDK GitHub](https://github.com/openai/openai-node)
- [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI npm package](https://www.npmjs.com/package/openai)

---

## 結論

この移行計画に従うことで、Anthropic API から OpenAI API への移行を安全かつ効率的に実行できます。主な変更点は以下の通りです:

1. **SDK の置き換え**: `@anthropic-ai/sdk` → `openai`
2. **クライアントクラスのリファクタリング**: `ClaudeClient` → `OpenAIClient`
3. **ツール定義形式の変換**: Anthropic 形式 → OpenAI 形式
4. **環境変数の変更**: `ANTHROPIC_API_KEY` → `OPENAI_API_KEY`

移行によるメリット:
- **コスト削減**: 約83-87%のコスト削減
- **最新モデル**: GPT-4o による高精度な function calling
- **豊富なドキュメント**: OpenAI の充実したドキュメントとコミュニティサポート

リスクは適切に管理され、ロールバック計画も準備されています。
