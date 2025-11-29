import type { ToolCall } from './tools';

/**
 * Base event interface with discriminated type field
 */
interface BaseEvent<T extends string> {
	type: T;
	timestamp: number;
}

/**
 * User input event - captures user messages and responses
 */
export interface UserInputEvent extends BaseEvent<'user_input'> {
	data: string;
}

/**
 * Tool call event - records AI-initiated tool invocations
 */
export interface ToolCallEvent extends BaseEvent<'tool_call'> {
	data: ToolCall;
}

/**
 * Tool response event - stores results from tool executions
 */
export interface ToolResponseEvent extends BaseEvent<'tool_response'> {
	data: unknown;
}

/**
 * Error event - captures errors during processing
 */
export interface ErrorEvent extends BaseEvent<'error'> {
	data: {
		error: string;
		code?: string;
	};
}

/**
 * Awaiting approval event - indicates human approval is required
 */
export interface AwaitingApprovalEvent
	extends BaseEvent<'awaiting_approval'> {
	data: ToolCall;
}

/**
 * Complete event - signals end of agent processing
 */
export interface CompleteEvent extends BaseEvent<'complete'> {
	data: {
		message: string;
	};
}

/**
 * Discriminated union of all event types
 * TypeScript will automatically narrow the type based on the 'type' field
 */
export type Event =
	| UserInputEvent
	| ToolCallEvent
	| ToolResponseEvent
	| ErrorEvent
	| AwaitingApprovalEvent
	| CompleteEvent;

/**
 * Type guard to check if an event is a user input event
 */
export function isUserInputEvent(event: Event): event is UserInputEvent {
	return event.type === 'user_input';
}

/**
 * Type guard to check if an event is a tool call event
 */
export function isToolCallEvent(event: Event): event is ToolCallEvent {
	return event.type === 'tool_call';
}

/**
 * Type guard to check if an event is a tool response event
 */
export function isToolResponseEvent(event: Event): event is ToolResponseEvent {
	return event.type === 'tool_response';
}

/**
 * Type guard to check if an event is an error event
 */
export function isErrorEvent(event: Event): event is ErrorEvent {
	return event.type === 'error';
}

/**
 * Type guard to check if an event is an awaiting approval event
 */
export function isAwaitingApprovalEvent(
	event: Event,
): event is AwaitingApprovalEvent {
	return event.type === 'awaiting_approval';
}

/**
 * Type guard to check if an event is a complete event
 */
export function isCompleteEvent(event: Event): event is CompleteEvent {
	return event.type === 'complete';
}
