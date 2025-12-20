import type { ToolCall } from '../types/tools';
import type { ToolResponseEvent, ErrorEvent } from '../types/event';
import type { ToolExecutor, ToolExecutionResult } from './tool-executor';

/**
 * NotionToolExecutor: Concrete implementation of ToolExecutor for Notion-related tools.
 *
 * This class handles execution of all Notion-related tools:
 * - create_task
 * - create_project
 * - update_task
 * - delete_task
 * - get_tasks
 * - get_task_details
 *
 * Non-Notion tools (done_for_now, request_more_information) return
 * appropriate events without calling external APIs.
 *
 * @template TNotionClient - Type of Notion client with required methods
 */
export class NotionToolExecutor<
	TNotionClient extends {
		getTasks(toolCall: ToolCall): Promise<unknown>;
		createTask(toolCall: ToolCall): Promise<unknown>;
		createProject(toolCall: ToolCall): Promise<unknown>;
		deleteTask(toolCall: ToolCall): Promise<unknown>;
		updateTask(toolCall: ToolCall): Promise<unknown>;
		getTaskDetails(toolCall: ToolCall): Promise<unknown>;
	},
> implements ToolExecutor
{
	/**
	 * Creates a new NotionToolExecutor.
	 *
	 * @param notionClient - Notion API client with task management methods
	 */
	constructor(private readonly notionClient: TNotionClient) {}

	/**
	 * Executes a tool call and returns the result as an event.
	 *
	 * This method handles all tool types:
	 * - Notion API calls: create_task, create_project, update_task, delete_task, get_tasks, get_task_details
	 * - Control flow tools: done_for_now, request_more_information
	 *
	 * All errors are caught and returned as error events, ensuring the method never throws.
	 *
	 * @param toolCall - The tool to execute
	 * @returns A promise resolving to a ToolExecutionResult containing either:
	 *          - tool_response event (on success)
	 *          - error event (on failure)
	 */
	async execute(toolCall: ToolCall): Promise<ToolExecutionResult> {
		try {
			// Handle control flow tools that don't require API calls
			if (
				toolCall.intent === 'done_for_now' ||
				toolCall.intent === 'request_more_information'
			) {
				return this.createSuccessResult(toolCall.parameters);
			}

			// Handle Notion API tools
			const result = await this.executeNotionTool(toolCall);
			return this.createSuccessResult(result);
		} catch (error) {
			return this.createErrorResult(error, toolCall.intent);
		}
	}

	/**
	 * Executes a Notion-specific tool by delegating to the appropriate client method.
	 *
	 * @param toolCall - The Notion tool to execute
	 * @returns Promise resolving to the tool execution result
	 * @throws Error if the tool intent is not recognized
	 */
	private async executeNotionTool(toolCall: ToolCall): Promise<unknown> {
		switch (toolCall.intent) {
			case 'get_tasks':
				return await this.notionClient.getTasks(toolCall);
			case 'create_task':
				return await this.notionClient.createTask(toolCall);
			case 'create_project':
				return await this.notionClient.createProject(toolCall);
			case 'delete_task':
				return await this.notionClient.deleteTask(toolCall);
			case 'update_task':
				return await this.notionClient.updateTask(toolCall);
			case 'get_task_details':
				return await this.notionClient.getTaskDetails(toolCall);
			default:
				// TypeScript should ensure this is never reached due to exhaustive switch
				throw new Error(
					`Unknown tool intent: ${(toolCall as ToolCall).intent}`,
				);
		}
	}

	/**
	 * Creates a successful tool execution result.
	 *
	 * @param data - The result data from the tool execution
	 * @returns ToolExecutionResult with a tool_response event
	 */
	private createSuccessResult(data: unknown): ToolExecutionResult {
		const event: ToolResponseEvent = {
			type: 'tool_response',
			timestamp: Date.now(),
			data,
		};
		return { event };
	}

	/**
	 * Creates an error tool execution result.
	 *
	 * @param error - The error that occurred
	 * @param intent - The tool intent that failed
	 * @returns ToolExecutionResult with an error event
	 */
	private createErrorResult(
		error: unknown,
		intent: string,
	): ToolExecutionResult {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error';
		const event: ErrorEvent = {
			type: 'error',
			timestamp: Date.now(),
			data: {
				error: `Failed to execute tool '${intent}': ${errorMessage}`,
				code: error instanceof Error ? error.name : undefined,
			},
		};
		return { event };
	}
}
