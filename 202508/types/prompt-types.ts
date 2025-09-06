import type { Thread } from '../events/thread';

export interface PromptContext {
  userMessage: string;
  thread: Thread; // XML context generated via thread.toPrompt()
}
