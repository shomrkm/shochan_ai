export interface PromptContext {
  userMessage: string;
  collectedInfo: Record<string, string>;
  questionCount: number;
}
