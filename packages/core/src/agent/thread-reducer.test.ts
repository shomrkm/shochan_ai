import { describe, it, expect } from 'vitest';
import { ThreadReducer } from './thread-reducer';
import { Thread } from '../thread/thread';
import type {
	Event,
	UserInputEvent,
	ToolCallEvent,
	ToolResponseEvent,
	ErrorEvent,
} from '../types/event';

describe('ThreadReducer', () => {
	describe('Pure function behavior', () => {
		it('should return a new Thread instance', () => {
			const reducer = new ThreadReducer();
			const initialEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Hello',
			};
			const currentThread = new Thread([initialEvent]);

			const newEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};

			const newThread = reducer.reduce(currentThread, newEvent);

			// Should return a new instance
			expect(newThread).not.toBe(currentThread);
			// Should be a Thread instance
			expect(newThread).toBeInstanceOf(Thread);
		});

		it('should not modify the original state', () => {
			const reducer = new ThreadReducer();
			const initialEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Hello',
			};
			const currentThread = new Thread([initialEvent]);

			const newEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};

			const originalEventsLength = currentThread.events.length;
			reducer.reduce(currentThread, newEvent);

			// Original thread should remain unchanged
			expect(currentThread.events.length).toBe(originalEventsLength);
			expect(currentThread.events).toHaveLength(1);
		});
	});

	describe('Event addition', () => {
		it('should add user_input event to thread', () => {
			const reducer = new ThreadReducer();
			const currentThread = new Thread([]);

			const newEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};

			const newThread = reducer.reduce(currentThread, newEvent);

			expect(newThread.events).toHaveLength(1);
			expect(newThread.events[0]).toEqual(newEvent);
		});

		it('should add tool_call event to thread', () => {
			const reducer = new ThreadReducer();
			const initialEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const currentThread = new Thread([initialEvent]);

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

			const newThread = reducer.reduce(currentThread, toolCallEvent);

			expect(newThread.events).toHaveLength(2);
			expect(newThread.events[1]).toEqual(toolCallEvent);
		});

		it('should add tool_response event to thread', () => {
			const reducer = new ThreadReducer();
			const currentThread = new Thread([]);

			const toolResponseEvent: ToolResponseEvent = {
				type: 'tool_response',
				timestamp: Date.now(),
				data: {
					task_id: 'task-123',
					title: 'New Task',
					description: 'Task description',
				},
			};

			const newThread = reducer.reduce(currentThread, toolResponseEvent);

			expect(newThread.events).toHaveLength(1);
			expect(newThread.events[0]).toEqual(toolResponseEvent);
		});

		it('should add error event to thread', () => {
			const reducer = new ThreadReducer();
			const currentThread = new Thread([]);

			const errorEvent: ErrorEvent = {
				type: 'error',
				timestamp: Date.now(),
				data: {
					error: 'Failed to create task',
					code: 'TASK_CREATION_ERROR',
				},
			};

			const newThread = reducer.reduce(currentThread, errorEvent);

			expect(newThread.events).toHaveLength(1);
			expect(newThread.events[0]).toEqual(errorEvent);
		});

		it('should maintain event order', () => {
			const reducer = new ThreadReducer();
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
			const currentThread = new Thread([event1]);

			const newThread = reducer.reduce(currentThread, event2);

			expect(newThread.events).toHaveLength(2);
			expect(newThread.events[0].timestamp).toBe(1000);
			expect(newThread.events[1].timestamp).toBe(2000);
		});
	});

	describe('Multiple reductions', () => {
		it('should handle multiple consecutive reductions', () => {
			const reducer = new ThreadReducer();
			const emptyThread = new Thread([]);

			const event1: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'First',
			};

			const event2: ToolCallEvent = {
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'get_tasks',
					parameters: {},
				},
			};

			const event3: ToolResponseEvent = {
				type: 'tool_response',
				timestamp: Date.now(),
				data: { tasks: [] },
			};

			const thread1 = reducer.reduce(emptyThread, event1);
			const thread2 = reducer.reduce(thread1, event2);
			const thread3 = reducer.reduce(thread2, event3);

			expect(thread3.events).toHaveLength(3);
			expect(thread3.events[0]).toEqual(event1);
			expect(thread3.events[1]).toEqual(event2);
			expect(thread3.events[2]).toEqual(event3);
		});

		it('should produce same result for same inputs (deterministic)', () => {
			const reducer = new ThreadReducer();
			const initialEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: 1000,
				data: 'Test',
			};
			const currentThread = new Thread([initialEvent]);

			const newEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: 2000,
				data: 'Second test',
			};

			const result1 = reducer.reduce(currentThread, newEvent);
			const result2 = reducer.reduce(currentThread, newEvent);

			// Results should have the same events
			expect(result1.events).toHaveLength(2);
			expect(result2.events).toHaveLength(2);
			expect(result1.events[0]).toEqual(result2.events[0]);
			expect(result1.events[1]).toEqual(result2.events[1]);
		});
	});

	describe('Type safety', () => {
		it('should handle all Event types correctly', () => {
			const reducer = new ThreadReducer();
			const currentThread = new Thread([]);

			const events: Event[] = [
				{
					type: 'user_input',
					timestamp: Date.now(),
					data: 'Test',
				},
				{
					type: 'tool_call',
					timestamp: Date.now(),
					data: {
						intent: 'create_task',
						parameters: {
							title: 'Task',
							description: 'Desc',
							task_type: 'Today',
						},
					},
				},
				{
					type: 'tool_response',
					timestamp: Date.now(),
					data: { result: 'success' },
				},
				{
					type: 'error',
					timestamp: Date.now(),
					data: { error: 'Test error' },
				},
				{
					type: 'awaiting_approval',
					timestamp: Date.now(),
					data: {
						intent: 'delete_task',
						parameters: { task_id: 'task-123', reason: 'Test' },
					},
				},
				{
					type: 'complete',
					timestamp: Date.now(),
					data: { message: 'Completed' },
				},
			];

			let thread = currentThread;
			for (const event of events) {
				thread = reducer.reduce(thread, event);
			}

			expect(thread.events).toHaveLength(6);
		});
	});
});
