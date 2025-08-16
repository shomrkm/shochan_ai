import type { AgentTool } from './tools';
import type { EnrichedToolResult } from '../tools/tool-execution-context';

export type ProcessMessageResult =
  | {
      toolCall: AgentTool;
      toolResult: EnrichedToolResult;
    }
  | {
      response: string;
    };