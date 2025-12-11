import type { ToolCall } from '../types/tools';
import type { Event } from '../types/event';

/**
 * Result of a tool execution.
 * Contains the tool response event to be added to the thread.
 */
export type ToolExecutionResult = {
	/**
	 * The event representing the tool's response.
	 * This event should be added to the thread after execution.
	 */
	event: Event;
};

/**
 * ToolExecutor interface for executing tools with side effects.
 *
 * This interface separates side effects from pure reducers following the Redux pattern:
 * - Reducers: Pure functions for state transitions
 * - ToolExecutor: Handles all side effects (API calls, I/O, etc.)
 *
 * Key responsibilities:
 * - Execute tools that interact with external systems (Notion API, OpenAI, etc.)
 * - Handle async operations
 * - Manage errors and retries
 * - Return events that can be processed by reducers
 *
 * Design principles:
 * - Single Responsibility: Only handles tool execution, not state management
 * - Dependency Injection: External dependencies (API clients) injected via constructor
 * - Error Handling: All errors should be caught and returned as error events
 *
 * @example
 * ```typescript
 * class NotionToolExecutor implements ToolExecutor {
 *   constructor(private notionClient: NotionClient) {}
 *
 *   async execute(toolCall: ToolCall): Promise<ToolExecutionResult> {
 *     try {
 *       if (toolCall.intent === 'create_task') {
 *         const result = await this.notionClient.createTask(toolCall.parameters);
 *         return {
 *           event: {
 *             type: 'tool_response',
 *             timestamp: Date.now(),
 *             data: result
 *           }
 *         };
 *       }
 *       throw new Error(`Unknown tool: ${toolCall.intent}`);
 *     } catch (error) {
 *       return {
 *         event: {
 *           type: 'error',
 *           timestamp: Date.now(),
 *           data: { error: error.message }
 *         }
 *       };
 *     }
 *   }
 * }
 * ```
 */
export interface ToolExecutor {
	/**
	 * Executes a tool and returns the result as an event.
	 *
	 * This method:
	 * - Performs async operations (API calls, I/O, etc.)
	 * - Handles errors gracefully
	 * - Returns an event that can be added to the thread
	 *
	 * @param toolCall - The tool to execute
	 * @returns A promise that resolves to the execution result
	 *
	 * @throws Should NOT throw errors. All errors should be caught and
	 *         returned as error events in the ToolExecutionResult.
	 */
	execute(toolCall: ToolCall): Promise<ToolExecutionResult>;
}
