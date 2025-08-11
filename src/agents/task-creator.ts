// src/agents/task-creator.ts
import { ClaudeClient } from '../clients/claude';
import { ToolExecutor } from '../tools';
import { TASK_CREATOR_SYSTEM_PROMPT } from '../prompts/system';
import { AgentTool, ToolResult } from '../types/tools';

export class TaskCreatorAgent {
  private claude: ClaudeClient;
  private toolExecutor: ToolExecutor;

  constructor() {
    this.claude = new ClaudeClient();
    this.toolExecutor = new ToolExecutor();
  }

  async processMessage(userMessage: string): Promise<{
    toolCall?: AgentTool;
    toolResult?: ToolResult;
    response?: string;
  }> {
    console.log(`\n👤 User: ${userMessage}`);

    try {
      // Claude にツール呼び出しを生成させる
      const toolCall = await this.claude.generateToolCall(
        TASK_CREATOR_SYSTEM_PROMPT,
        userMessage
      );

      if (!toolCall) {
        // ツール呼び出しがない場合は通常の応答
        const response = await this.claude.generateResponse(
          TASK_CREATOR_SYSTEM_PROMPT,
          userMessage
        );

        console.log(`🤖 Claude: ${response}`);
        return { response };
      }

      console.log(`🤖 Claude generated tool call: ${toolCall.function.name}`);

      // ツールを実行
      const toolResult = await this.toolExecutor.execute(toolCall);

      return { toolCall, toolResult };
    } catch (error) {
      console.error('❌ Agent processing failed:', error);
      return {
        response: `処理中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // 接続テスト
  async testConnections(): Promise<boolean> {
    console.log('🔍 Testing connections...');
    
    try {
      const notionConnected = await this.toolExecutor.testConnection();
      if (!notionConnected) {
        console.log('❌ Notion connection failed');
        return false;
      }

      console.log('✅ All connections successful');
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }
}
