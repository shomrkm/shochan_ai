import { Thread } from '../thread/thread';
import type { Event } from '../types/event';
import type { AgentReducer } from './agent-reducer';

/**
 * ThreadReducer: Concrete implementation of AgentReducer for Thread state management.
 *
 * This reducer implements a pure state transition function following Redux principles:
 * - Takes current Thread state and an Event
 * - Returns a new Thread state with the event added
 * - No side effects (API calls, I/O, etc.)
 * - Synchronous operation only
 *
 * The reducer's responsibility is limited to:
 * 1. Adding events to the thread's event history
 * 2. Maintaining immutability (returns new Thread instance)
 * 3. Preserving all existing thread data
 *
 * Side effects like tool execution are handled by ToolExecutor.
 */
export class ThreadReducer implements AgentReducer<Thread, Event> {
	/**
	 * Reduces the current thread state and an event into a new thread state.
	 *
	 * This method:
	 * - Creates a new Thread instance with the event added to the history
	 * - Maintains immutability by not modifying the input state
	 * - Performs no side effects (pure function)
	 * - Executes synchronously
	 *
	 * @param state - The current Thread state
	 * @param event - The event to add to the thread
	 * @returns A new Thread instance with the event added
	 *
	 * @example
	 * ```typescript
	 * const reducer = new ThreadReducer();
	 * const currentThread = new Thread([event1, event2]);
	 *
	 * const newEvent: UserInputEvent = {
	 *   type: 'user_input',
	 *   timestamp: Date.now(),
	 *   data: { message: 'Create a task' }
	 * };
	 *
	 * const newThread = reducer.reduce(currentThread, newEvent);
	 * // newThread.events.length === 3
	 * // currentThread.events.length === 2 (unchanged)
	 * ```
	 */
	reduce(state: Thread, event: Event): Thread {
		// Create a new Thread with the event added
		// This maintains immutability - the original state is not modified
		return new Thread([...state.events, event]);
	}
}
