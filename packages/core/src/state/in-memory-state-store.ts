import type { StateStore } from './state-store';
import type { Thread } from '../thread/thread';

/**
 * In-memory state storage for CLI. For Web, use RedisStateStore.
 * 
 * **Warning**: Does not protect against mutations. Always create new state objects instead of mutating.
 * 
 * @example
 * // ✅ Correct
 * store.setState(new Thread([...store.getState().events, newEvent]));
 * 
 * // ❌ Wrong
 * store.getState().events.push(newEvent);
 */
export class InMemoryStateStore<TState = Thread> implements StateStore<TState> {
	private state: TState;

	constructor(initialState: TState) {
		this.state = initialState;
	}

	getState(): TState {
		return this.state;
	}

	setState(state: TState): void {
		this.state = state;
	}
}
