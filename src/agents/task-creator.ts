import { ClaudeClient } from '../clients/claude';
import { ToolExecutor } from '../tools';
import { TASK_CREATOR_SYSTEM_PROMPT } from '../prompts/system';
import { AgentTool, QuestionToolResult, ToolResult } from '../types/tools';
import Anthropic from '@anthropic-ai/sdk';
import { isAskQuestionTool, isCreateProjectTool, isCreateTaskTool, isQuestionToolResult } from '../types/toolGuards';
import { PromptManager } from '../prompts/prompt-manager';
import { PromptContext } from '../types/prompt-types';

type ProcessMessageResult = {
  toolCall: AgentTool;
  toolResult: ToolResult;
} | {
  response: string;
};

export class TaskCreatorAgent {
  private claude: ClaudeClient;
  private toolExecutor: ToolExecutor;
  private promptManager: PromptManager;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private collectedInfo: Record<string, string> = {};
  private questionCount: number = 0;
  private conversationStage: PromptContext['conversationStage'] = 'initial';

  private readonly MAX_ITERATIONS = 8;

  constructor() {
    this.claude = new ClaudeClient();
    this.toolExecutor = new ToolExecutor();
    this.promptManager = new PromptManager();
  }

  /**
   * start the conversation
   * @param userMessage the message from the user
   */
  async startConversation(userMessage: string): Promise<void> {
    console.log('🎯 Starting interactive conversation...\n');
    this.clearHistory();
    
    let currentMessage = userMessage;
    let iterations = 0;
    
    while (iterations < this.MAX_ITERATIONS) {
      iterations++;
      console.log(`\n🔄 Conversation iteration ${iterations}/${this.MAX_ITERATIONS}`);
      
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
        this.questionCount++;
        this.conversationStage = this.determineNextStage();
        
        if (result.toolResult.success && result.toolResult.data?.answer) {
          const answer = result.toolResult.data.answer;
          currentMessage = answer;
          
          this.updateCollectedInfo(result.toolCall, answer);
          
          console.log('\n📝 Collected information so far:');
          console.log(JSON.stringify(this.collectedInfo, null, 2));
          console.log('\n');
        } else {
          console.log('❌ Failed to get user answer, ending conversation.');
          break;
        }
      }
    }
    
    if (iterations >= this.MAX_ITERATIONS) {
      console.log('⚠️  Maximum iterations reached. Conversation ended.');
    }
    
    console.log('🏁 Conversation completed!\n');
  }

  /**
   * process the message
   * @param userMessage the message from the user
   * @returns the result of the message
   */
  async processMessage(userMessage: string): Promise<ProcessMessageResult> {
    console.log(`\n👤 User: ${userMessage}`);

    try {
      // Factor 2: 動的プロンプト生成
      const promptContext: PromptContext = {
        userMessage,
        conversationStage: this.conversationStage,
        collectedInfo: this.collectedInfo,
        questionCount: this.questionCount,
      };

      // デバッグモードの場合、プロンプトを表示
      if (process.env.DEBUG_PROMPTS === 'true') {
        this.promptManager.debugPrompt(promptContext);
      }

      const systemPrompt = this.useDynamicPrompts() 
        ? this.promptManager.buildSystemPrompt(promptContext)
        : TASK_CREATOR_SYSTEM_PROMPT;

      const toolCall = await this.claude.generateToolCall(
        systemPrompt,
        userMessage,
        this.conversationHistory
      );

      if (!toolCall) {
        const response = await this.claude.generateResponse(
          systemPrompt,
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
      if (this.useDynamicPrompts()) {
        console.log(`📋 Used prompt stage: ${this.conversationStage}`);
      }

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

  /**
   * update the collected info
   * @param toolCall the tool call
   * @param answer the answer from the user
   */
  private updateCollectedInfo(toolCall: AgentTool, answer: string): void {
    if (!isAskQuestionTool(toolCall)) {
      throw new Error('Invalid tool type for askQuestion');
    }

    const question = toolCall.function.parameters.question;
    
    const q = question.toLowerCase();
    if (q.includes('feature') || q.includes('functionality') || q.includes('what')) {
      this.collectedInfo.feature = answer;
    } else if (q.includes('technology') || q.includes('tech stack') || q.includes('how')) {
      this.collectedInfo.techStack = answer;
    } else if (q.includes('deadline') || q.includes('when') || q.includes('timeline')) {
      this.collectedInfo.deadline = answer;
    } else if (q.includes('priority') || q.includes('importance') || q.includes('urgent')) {
      this.collectedInfo.priority = answer;
    } else if (q.includes('name') || q.includes('title') || q.includes('call')) {
      this.collectedInfo.title = answer;
    } else if (q.includes('description') || q.includes('detail') || q.includes('about')) {
      this.collectedInfo.description = answer;
    } else if (q.includes('confirm') || q.includes('proceed') || q.includes('correct')) {
      this.collectedInfo.confirmation = answer;
    } else {
      const key = `question_${Object.keys(this.collectedInfo).length + 1}`;
      this.collectedInfo[key] = answer;
    }
  }

  /**
   * determine the next stage of the conversation
   * @returns the next stage of the conversation
   */
  private determineNextStage(): PromptContext['conversationStage'] {
    const hasBasicInfo = this.collectedInfo.feature || this.collectedInfo.title;
    const hasDetails = this.collectedInfo.description || this.collectedInfo.feature;
    
    if (hasBasicInfo && hasDetails && this.questionCount >= 2) {
      return 'confirming';
    } else if (this.questionCount >= 1) {
      return 'gathering_info';
    } else {
      return 'initial';
    }
  }

  private hasCalledTool(result: ProcessMessageResult): result is { toolCall: AgentTool; toolResult: ToolResult } {
    return 'toolCall' in result && 'toolResult' in result;
  }

  private clearHistory(): void {
    this.conversationHistory = [];
    this.collectedInfo = {};
    this.questionCount = 0;
    this.conversationStage = 'initial';
    console.log('🧹 Conversation history and collected info cleared');
  }

  /**
   * use dynamic prompts
   * @returns true if dynamic prompts are enabled
   */
  private useDynamicPrompts(): boolean {
    return process.env.USE_DYNAMIC_PROMPTS === 'true';
  }

  enableDynamicPrompts(): void {
    process.env.USE_DYNAMIC_PROMPTS = 'true';
    console.log('🎯 Dynamic prompts enabled (Factor 2)');
  }

  disableDynamicPrompts(): void {
    process.env.USE_DYNAMIC_PROMPTS = 'false';
    console.log('📝 Using static prompt (original behavior)');
  }

  enablePromptDebugging(): void {
    process.env.DEBUG_PROMPTS = 'true';
    console.log('🔍 Prompt debugging enabled');
  }

  disablePromptDebugging(): void {
    process.env.DEBUG_PROMPTS = 'false';
    console.log('🔇 Prompt debugging disabled');
  }

  showAvailablePromptFunctions(): void {
    const functions = this.promptManager.listPromptFunctions();
    console.log('📋 Available prompt functions:');
    functions.forEach(func => console.log(`  - ${func}`));
  }

  getCurrentPromptContext(): PromptContext {
    return {
      userMessage: '',
      conversationStage: this.conversationStage,
      collectedInfo: this.collectedInfo,
      questionCount: this.questionCount,
    };
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
