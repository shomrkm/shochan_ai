import type Anthropic from '@anthropic-ai/sdk';
import type { Thread } from '../events/thread';

export interface PromptContext {
  userMessage: string;
  conversationHistory: Anthropic.MessageParam[]; // Legacy compatibility - will be removed in Phase 5
  thread?: Thread; // TODO: Make required in Phase 5 when XML becomes default - XML context generated via thread.toPrompt()
}
