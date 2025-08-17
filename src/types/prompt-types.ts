export interface PromptContext {
  userMessage: string;
  conversationStage: 'initial' | 'gathering_info' | 'confirming' | 'executing';
  collectedInfo: Record<string, string>;
  questionCount: number;
}
