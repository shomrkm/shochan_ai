import type { Thread } from '../thread/thread';

/**
 * Interface for state persistence. Implementations: InMemoryStateStore (CLI), RedisStateStore (Web).
 * 
 * **Warning**: Returns state by reference. Callers must not mutate the returned state.
 */
export interface StateStore<TState = Thread> {
	getState(): TState;
	setState(state: TState): void;
}
