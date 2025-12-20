import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentOrchestrator } from './agent-orchestrator';
import { ThreadReducer } from './thread-reducer';
import { Thread } from '../thread/thread';
import { InMemoryStateStore } from '../state/in-memory-state-store';
import type {
	Event,
	UserInputEvent,
	ToolCallEvent,
	ToolResponseEvent,
	ErrorEvent,
} from '../types/event';
import type { ToolCall } from '../types/tools';
import type { ToolExecutor, ToolExecutionResult } from './tool-executor';

/**
 * Mock ToolExecutor for testing
 * Returns success responses for all tool calls
 */
class MockToolExecutor implements ToolExecutor {
	execute = vi.fn(
		async (toolCall: ToolCall): Promise<ToolExecutionResult> => {
			const event: ToolResponseEvent = {
				type: 'tool_response',
				timestamp: Date.now(),
				data: {
					success: true,
					tool: toolCall.intent,
					parameters: toolCall.parameters,
				},
			};
			return { event };
		},
	);
}

/**
 * Mock ToolExecutor that returns error events
 */
class ErrorMockToolExecutor implements ToolExecutor {
	execute = vi.fn(
		async (_toolCall: ToolCall): Promise<ToolExecutionResult> => {
			const event: ErrorEvent = {
				type: 'error',
				timestamp: Date.now(),
				data: {
					error: 'API connection failed',
					code: 'CONNECTION_ERROR',
				},
			};
			return { event };
		},
	);
}

describe('AgentOrchestrator', () => {
	let reducer: ThreadReducer;
	let executor: MockToolExecutor;
	let stateStore: InMemoryStateStore<Thread>;
	let orchestrator: AgentOrchestrator;

	beforeEach(() => {
		reducer = new ThreadReducer();
		executor = new MockToolExecutor();
		stateStore = new InMemoryStateStore(new Thread([]));
		orchestrator = new AgentOrchestrator(reducer, executor, stateStore);
	});

	describe('processEvent', () => {
		it('should process a user input event', async () => {
			const event: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};

			const newState = await orchestrator.processEvent(event);

			expect(newState.events).toHaveLength(1);
			expect(newState.events[0]).toEqual(event);
		});

		it('should persist state after processing event', async () => {
			const event: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Test message',
			};

			await orchestrator.processEvent(event);

			const storedState = stateStore.getState();
			expect(storedState.events).toHaveLength(1);
			expect(storedState.events[0]).toEqual(event);
		});

		it('should process multiple events sequentially', async () => {
			const event1: UserInputEvent = {
				type: 'user_input',
				timestamp: 1000,
				data: 'First message',
			};

			const event2: UserInputEvent = {
				type: 'user_input',
				timestamp: 2000,
				data: 'Second message',
			};

			await orchestrator.processEvent(event1);
			const finalState = await orchestrator.processEvent(event2);

			expect(finalState.events).toHaveLength(2);
			expect(finalState.events[0]).toEqual(event1);
			expect(finalState.events[1]).toEqual(event2);
		});
	});

	describe('executeToolCall', () => {
		it('should execute a tool call and add both events to state', async () => {
			const toolCallEvent: ToolCallEvent = {
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'get_tasks',
					parameters: {},
				},
			};

			const finalState = await orchestrator.executeToolCall(toolCallEvent);

			// Should have 2 events: tool_call + tool_response
			expect(finalState.events).toHaveLength(2);
			expect(finalState.events[0].type).toBe('tool_call');
			expect(finalState.events[1].type).toBe('tool_response');
		});

		it('should call executor.execute with the correct tool call', async () => {
			const toolCall: ToolCall = {
				intent: 'create_task',
				parameters: {
					title: 'New Task',
					description: 'Task description',
					task_type: 'Today',
				},
			};

			const toolCallEvent: ToolCallEvent = {
				type: 'tool_call',
				timestamp: Date.now(),
				data: toolCall,
			};

			await orchestrator.executeToolCall(toolCallEvent);

			// Verify executor.execute was called exactly once
			expect(executor.execute).toHaveBeenCalledTimes(1);
			// Verify it was called with the correct tool call
			expect(executor.execute).toHaveBeenCalledWith(toolCall);
		});

		it('should call executor.execute only once per tool call', async () => {
			const toolCallEvent: ToolCallEvent = {
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'get_tasks',
					parameters: {},
				},
			};

			await orchestrator.executeToolCall(toolCallEvent);

			expect(executor.execute).toHaveBeenCalledTimes(1);
		});

		it('should not call executor.execute for non-tool_call events via processEvent', async () => {
			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Test',
			};

			await orchestrator.processEvent(userInputEvent);

			expect(executor.execute).not.toHaveBeenCalled();
		});

		// Note: "should throw error if event is not a tool_call" test removed
		// because TypeScript now enforces ToolCallEvent type at compile time

		it('should persist state after tool execution', async () => {
			const toolCallEvent: ToolCallEvent = {
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'create_task',
					parameters: {
						title: 'New Task',
						description: 'Task description',
						task_type: 'Today',
					},
				},
			};

			await orchestrator.executeToolCall(toolCallEvent);

			const storedState = stateStore.getState();
			expect(storedState.events).toHaveLength(2);
		});

		it('should maintain event order during tool execution', async () => {
			// Add initial user input
			const userInput: UserInputEvent = {
				type: 'user_input',
				timestamp: 1000,
				data: 'Create a task',
			};
			await orchestrator.processEvent(userInput);

			// Execute tool call
			const toolCallEvent: ToolCallEvent = {
				type: 'tool_call',
				timestamp: 2000,
				data: {
					intent: 'create_task',
					parameters: {
						title: 'Task',
						description: 'Desc',
						task_type: 'Today',
					},
				},
			};
			const finalState = await orchestrator.executeToolCall(toolCallEvent);

			// Should have: user_input, tool_call, tool_response
			expect(finalState.events).toHaveLength(3);
			expect(finalState.events[0].type).toBe('user_input');
			expect(finalState.events[1].type).toBe('tool_call');
			expect(finalState.events[2].type).toBe('tool_response');
		});
	});

	describe('getState', () => {
		it('should return current state from state store', () => {
			const currentState = orchestrator.getState();

			expect(currentState).toBeInstanceOf(Thread);
			expect(currentState.events).toHaveLength(0);
		});

		it('should return updated state after processing events', async () => {
			const event: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Test',
			};

			await orchestrator.processEvent(event);

			const currentState = orchestrator.getState();
			expect(currentState.events).toHaveLength(1);
		});
	});

	describe('Integration scenarios', () => {
		it('should handle a complete conversation flow', async () => {
			// 1. User input
			const userInput: UserInputEvent = {
				type: 'user_input',
				timestamp: 1000,
				data: 'Get my tasks',
			};
			await orchestrator.processEvent(userInput);

			// 2. Tool call
			const toolCall: ToolCallEvent = {
				type: 'tool_call',
				timestamp: 2000,
				data: {
					intent: 'get_tasks',
					parameters: {},
				},
			};
			await orchestrator.executeToolCall(toolCall);

			// 3. Another user input
			const userInput2: UserInputEvent = {
				type: 'user_input',
				timestamp: 3000,
				data: 'Create a new task',
			};
			const finalState = await orchestrator.processEvent(userInput2);

			// Should have all events in order
			expect(finalState.events).toHaveLength(4);
			expect(finalState.events[0].type).toBe('user_input');
			expect(finalState.events[1].type).toBe('tool_call');
			expect(finalState.events[2].type).toBe('tool_response');
			expect(finalState.events[3].type).toBe('user_input');

			// Should have called executor once
			expect(executor.execute).toHaveBeenCalledTimes(1);
		});

		it('should maintain state consistency across operations', async () => {
			const events: Event[] = [
				{
					type: 'user_input',
					timestamp: 1000,
					data: 'First message',
				} as UserInputEvent,
				{
					type: 'tool_call',
					timestamp: 2000,
					data: {
						intent: 'get_tasks',
						parameters: {},
					},
				} as ToolCallEvent,
			];

			await orchestrator.processEvent(events[0]);
			await orchestrator.executeToolCall(events[1]);

			const stateFromOrchestrator = orchestrator.getState();
			const stateFromStore = stateStore.getState();

			// Both should be the same
			expect(stateFromOrchestrator).toBe(stateFromStore);
			expect(stateFromOrchestrator.events.length).toBe(3);
		});

		it('should call executor multiple times for multiple tool calls', async () => {
			const toolCall1: ToolCallEvent = {
				type: 'tool_call',
				timestamp: 1000,
				data: {
					intent: 'get_tasks',
					parameters: {},
				},
			};

			const toolCall2: ToolCallEvent = {
				type: 'tool_call',
				timestamp: 2000,
				data: {
					intent: 'create_task',
					parameters: {
						title: 'Task',
						description: 'Desc',
						task_type: 'Today',
					},
				},
			};

			await orchestrator.executeToolCall(toolCall1);
			await orchestrator.executeToolCall(toolCall2);

			// Should have called executor twice
			expect(executor.execute).toHaveBeenCalledTimes(2);
			// Verify call order and parameters
			expect(executor.execute).toHaveBeenNthCalledWith(1, toolCall1.data);
			expect(executor.execute).toHaveBeenNthCalledWith(2, toolCall2.data);
		});
	});

	describe('Error handling', () => {
		it('should add error event to state when executor returns an error', async () => {
			const errorExecutor = new ErrorMockToolExecutor();
			const errorOrchestrator = new AgentOrchestrator(
				new ThreadReducer(),
				errorExecutor,
				new InMemoryStateStore(new Thread([])),
			);

			const toolCallEvent: ToolCallEvent = {
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'get_tasks',
					parameters: {},
				},
			};

			const finalState = await errorOrchestrator.executeToolCall(toolCallEvent);

			// Should have 2 events: tool_call + error
			expect(finalState.events).toHaveLength(2);
			expect(finalState.events[0].type).toBe('tool_call');
			expect(finalState.events[1].type).toBe('error');

			// Verify error details
			const errorEvent = finalState.events[1] as ErrorEvent;
			expect(errorEvent.data.error).toBe('API connection failed');
			expect(errorEvent.data.code).toBe('CONNECTION_ERROR');
		});

		it('should continue processing after error event', async () => {
			const errorExecutor = new ErrorMockToolExecutor();
			const errorOrchestrator = new AgentOrchestrator(
				new ThreadReducer(),
				errorExecutor,
				new InMemoryStateStore(new Thread([])),
			);

			// First: user input
			const userInput: UserInputEvent = {
				type: 'user_input',
				timestamp: 1000,
				data: 'Get my tasks',
			};
			await errorOrchestrator.processEvent(userInput);

			// Second: tool call that fails
			const toolCallEvent: ToolCallEvent = {
				type: 'tool_call',
				timestamp: 2000,
				data: {
					intent: 'get_tasks',
					parameters: {},
				},
			};
			await errorOrchestrator.executeToolCall(toolCallEvent);

			// Third: another user input after error
			const userInput2: UserInputEvent = {
				type: 'user_input',
				timestamp: 3000,
				data: 'Try again',
			};
			const finalState = await errorOrchestrator.processEvent(userInput2);

			// Should have: user_input, tool_call, error, user_input
			expect(finalState.events).toHaveLength(4);
			expect(finalState.events[0].type).toBe('user_input');
			expect(finalState.events[1].type).toBe('tool_call');
			expect(finalState.events[2].type).toBe('error');
			expect(finalState.events[3].type).toBe('user_input');
		});

		it('should persist error state in state store', async () => {
			const errorExecutor = new ErrorMockToolExecutor();
			const errorStateStore = new InMemoryStateStore(new Thread([]));
			const errorOrchestrator = new AgentOrchestrator(
				new ThreadReducer(),
				errorExecutor,
				errorStateStore,
			);

			const toolCallEvent: ToolCallEvent = {
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'get_tasks',
					parameters: {},
				},
			};

			await errorOrchestrator.executeToolCall(toolCallEvent);

			// Verify error is persisted in state store
			const storedState = errorStateStore.getState();
			expect(storedState.events).toHaveLength(2);
			expect(storedState.events[1].type).toBe('error');
		});
	});
});
