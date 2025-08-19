import type Anthropic from '@anthropic-ai/sdk';

export interface PromptContext {
  userMessage: string;
  conversationHistory: Anthropic.MessageParam[];
}
