import { ClaudeClient } from '../clients/claude';
import { ToolExecutor } from '../tools';
import { TASK_CREATOR_SYSTEM_PROMPT } from '../prompts/system';
import { AgentTool, QuestionToolResult, ToolResult } from '../types/tools';
import Anthropic from '@anthropic-ai/sdk';
import { isAskQuestionTool, isCreateProjectTool, isCreateTaskTool, isQuestionToolResult } from '../types/toolGuards';

type ProcessMessageResult = {
  toolCall: AgentTool;
  toolResult: ToolResult;
} | {
  response: string;
};

export class TaskCreatorAgent {
  private claude: ClaudeClient;
  private toolExecutor: ToolExecutor;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private collectedInfo: Record<string, string> = {};

  constructor() {
    this.claude = new ClaudeClient();
    this.toolExecutor = new ToolExecutor();
  }

  async startConversation(userMessage: string): Promise<void> {
    console.log('🎯 Starting interactive conversation...\n');
    this.clearHistory();
    
    let currentMessage = userMessage;
    
    while (true) {
      const result = await this.processMessage(currentMessage);
      if(!this.hasCalledTool(result)) {
        console.log('💬 Agent provided a response without tools.');
        break;
      }

      if (isCreateTaskTool(result.toolCall) || isCreateProjectTool(result.toolCall)) {
        console.log('✅ Task/Project created successfully!');
        break;
      }

      if (isAskQuestionTool(result.toolCall) && isQuestionToolResult(result.toolResult)) {
        if (result.toolResult.success && result.toolResult.data?.answer) {
          const answer = result.toolResult.data.answer;
          currentMessage = answer;
          
          this.updateCollectedInfo(result.toolCall, answer);
          
          console.log('📝 Collected information so far:');
          console.log(JSON.stringify(this.collectedInfo, null, 2));
          console.log('\n');
        } else {
          console.log('❌ Failed to get user answer, ending conversation.');
          break;
        }
      }
    }
    
    console.log('🏁 Conversation completed!\n');
  }

  async processMessage(userMessage: string): Promise<ProcessMessageResult> {
    console.log(`\n👤 User: ${userMessage}`);

    try {
      const toolCall = await this.claude.generateToolCall(
        TASK_CREATOR_SYSTEM_PROMPT,
        userMessage,
        this.conversationHistory
      );

      if (!toolCall) {
        const response = await this.claude.generateResponse(
          TASK_CREATOR_SYSTEM_PROMPT,
          userMessage,
          this.conversationHistory
        );

        console.log(`🤖 Claude: ${response}`);
        
        this.conversationHistory.push(
          { role: 'user', content: userMessage },
          { role: 'assistant', content: response }
        );

        return { response };
      }

      console.log(`🤖 Claude generated tool call: ${toolCall.function.name}`);

      const toolResult = await this.toolExecutor.execute(toolCall);

      this.conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: `Used tool: ${toolCall.function.name}` }
      );

      return { toolCall, toolResult };
    } catch (error) {
      console.error('❌ Agent processing failed:', error);
      return {
        response: `申し訳ございません。処理中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private updateCollectedInfo(toolCall: AgentTool, answer: string): void {
    if (!isAskQuestionTool(toolCall)) {
      throw new Error('Invalid tool type for askQuestion');
    }

    const question = toolCall.function.parameters.question;
    
    // classify the answer into the collectedInfo
    const q = question.toLowerCase();
    if (q.includes('feature') || q.includes('functionality')) {
      this.collectedInfo.feature = answer;
    } else if (q.includes('technology') || q.includes('tech stack')) {
      this.collectedInfo.techStack = answer;
    } else if (q.includes('deadline') || q.includes('when')) {
      this.collectedInfo.deadline = answer;
    } else if (q.includes('priority') || q.includes('importance')) {
      this.collectedInfo.priority = answer;
    } else {
      const key = `question_${Object.keys(this.collectedInfo).length + 1}`;
      this.collectedInfo[key] = answer;
    }
  }

  private hasCalledTool(result: ProcessMessageResult): result is { toolCall: AgentTool; toolResult: ToolResult } {
    return 'toolCall' in result && 'toolResult' in result;
  }

  private clearHistory(): void {
    this.conversationHistory = [];
    this.collectedInfo = {};
    console.log('🧹 Conversation history and collected info cleared');
  }

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