import {
  PROMPT_KEYS,
  type PromptContext,
  type PromptFunction,
  type PromptFunctionKey,
  type PromptFunctionRegistry,
} from '../types/prompt-types';

import {
  CONFIRMATION_PROMPT,
  EXECUTION_PROMPT,
  INFORMATION_GATHERING_PROMPT,
  INITIAL_CONVERSATION_PROMPT,
} from './prompt-functions';

export class PromptManager {
  private promptFunctions: PromptFunctionRegistry;

  constructor() {
    this.promptFunctions = {
      [PROMPT_KEYS.INITIAL_CONVERSATION]: INITIAL_CONVERSATION_PROMPT,
      [PROMPT_KEYS.INFORMATION_GATHERING]: INFORMATION_GATHERING_PROMPT,
      [PROMPT_KEYS.CONFIRMATION]: CONFIRMATION_PROMPT,
      [PROMPT_KEYS.EXECUTION]: EXECUTION_PROMPT,
    };
  }

  buildSystemPrompt(context: PromptContext): string {
    const promptKey = this.selectPromptFunction(context);
    const promptFunction = this.promptFunctions[promptKey];

    if (!promptFunction) {
      console.warn(`Prompt function ${promptKey} not found, using initial_conversation`);
      return INITIAL_CONVERSATION_PROMPT.build(context);
    }

    const generatedPrompt = promptFunction.build(context);

    // display the prompt function name and description
    console.log(`🎯 Using prompt function: ${promptFunction.name}`);
    console.log(`📋 Description: ${promptFunction.description}`);

    return generatedPrompt;
  }

  private selectPromptFunction(context: PromptContext): PromptFunctionKey {
    switch (context.conversationStage) {
      case 'initial':
        return PROMPT_KEYS.INITIAL_CONVERSATION;
      case 'gathering_info':
        return PROMPT_KEYS.INFORMATION_GATHERING;
      case 'confirming':
        return PROMPT_KEYS.CONFIRMATION;
      case 'executing':
        return PROMPT_KEYS.EXECUTION;
      default:
        return PROMPT_KEYS.INITIAL_CONVERSATION;
    }
  }

  // debug: display the generated prompt
  debugPrompt(context: PromptContext): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 PROMPT DEBUG');
    console.log('='.repeat(60));
    console.log('Context:', JSON.stringify(context, null, 2));
    console.log('\nGenerated Prompt:');
    console.log(this.buildSystemPrompt(context));
    console.log('='.repeat(60) + '\n');
  }

  // add prompt function dynamically
  addPromptFunction(promptFunction: PromptFunction): void {
    this.promptFunctions[promptFunction.name] = promptFunction;
    console.log(`✅ Added prompt function: ${promptFunction.name}`);
  }

  // list available prompt functions
  listPromptFunctions(): PromptFunctionKey[] {
    return Object.keys(this.promptFunctions) as PromptFunctionKey[];
  }
}
