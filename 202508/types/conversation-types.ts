import type { EnrichedToolResult } from '../tools/tool-execution-context';
import type { AgentTool } from './tools';

export type ProcessMessageResult =
  | {
      toolCall: AgentTool;
      toolResult: EnrichedToolResult;
    }
  | {
      response: string;
    };
