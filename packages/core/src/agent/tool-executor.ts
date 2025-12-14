import type { ToolCall } from '../types/tools';
import type { Event } from '../types/event';

export type ToolExecutionResult = {
	event: Event;
};

/**
 * Interface for executing tools with side effects (API calls, I/O).
 * Errors should be caught and returned as error events.
 */
export interface ToolExecutor {
	execute(toolCall: ToolCall): Promise<ToolExecutionResult>;
}
