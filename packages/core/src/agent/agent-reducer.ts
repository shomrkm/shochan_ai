import type { Thread } from '../thread/thread';
import type { Event } from '../types/event';

/**
 * Pure function interface for state transitions: (state, event) → newState
 * No side effects, no async operations, returns new state (immutable).
 */
export interface AgentReducer<TState = Thread, TEvent = Event> {
	reduce(state: TState, event: TEvent): TState;
}
