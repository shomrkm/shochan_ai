// src/types/prompt-types.ts
export interface PromptContext {
  userMessage: string;
  conversationStage: 'initial' | 'gathering_info' | 'confirming' | 'executing';
  collectedInfo: Record<string, string>;
  questionCount: number;
}

export interface PromptFunction {
  name: string;
  description: string;
  build: (context: PromptContext) => string;
}