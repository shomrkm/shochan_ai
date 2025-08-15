// src/prompts/prompt-manager.ts
import { 
  PromptContext, 
  PromptFunction,
  INITIAL_CONVERSATION_PROMPT,
  INFORMATION_GATHERING_PROMPT,
  CONFIRMATION_PROMPT,
  EXECUTION_PROMPT
} from './prompt-functions';

export class PromptManager {
  private promptFunctions: Map<string, PromptFunction> = new Map();

  constructor() {
    this.initializePromptFunctions();
  }

  private initializePromptFunctions(): void {
    this.promptFunctions.set('initial_conversation', INITIAL_CONVERSATION_PROMPT);
    this.promptFunctions.set('information_gathering', INFORMATION_GATHERING_PROMPT);
    this.promptFunctions.set('confirmation', CONFIRMATION_PROMPT);
    this.promptFunctions.set('execution', EXECUTION_PROMPT);
  }

  buildSystemPrompt(context: PromptContext): string {
    const promptName = this.selectPromptFunction(context);
    const promptFunction = this.promptFunctions.get(promptName);
    
    if (!promptFunction) {
      console.warn(`Prompt function ${promptName} not found, using initial_conversation`);
      return INITIAL_CONVERSATION_PROMPT.build(context);
    }

    const generatedPrompt = promptFunction.build(context);
    
    // デバッグ情報をログ出力
    console.log(`🎯 Using prompt function: ${promptFunction.name}`);
    console.log(`📋 Description: ${promptFunction.description}`);
    
    return generatedPrompt;
  }

  private selectPromptFunction(context: PromptContext): string {
    // シンプルなロジックで適切なプロンプトを選択
    switch (context.conversationStage) {
      case 'initial':
        return 'initial_conversation';
      case 'gathering_info':
        return 'information_gathering';
      case 'confirming':
        return 'confirmation';
      case 'executing':
        return 'execution';
      default:
        return 'initial_conversation';
    }
  }

  // デバッグ用：生成されたプロンプトを表示
  debugPrompt(context: PromptContext): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 PROMPT DEBUG');
    console.log('='.repeat(60));
    console.log('Context:', JSON.stringify(context, null, 2));
    console.log('\nGenerated Prompt:');
    console.log(this.buildSystemPrompt(context));
    console.log('='.repeat(60) + '\n');
  }

  // プロンプト関数を動的に追加
  addPromptFunction(promptFunction: PromptFunction): void {
    this.promptFunctions.set(promptFunction.name, promptFunction);
    console.log(`✅ Added prompt function: ${promptFunction.name}`);
  }

  // 使用可能なプロンプト関数一覧
  listPromptFunctions(): string[] {
    return Array.from(this.promptFunctions.keys());
  }
}