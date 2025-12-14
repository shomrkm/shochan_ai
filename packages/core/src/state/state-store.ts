import type { Thread } from '../thread/thread';

/**
 * Interface for state persistence. Implementations: InMemoryStateStore (CLI), RedisStateStore (Web).
 */
export interface StateStore<TState = Thread> {
	getState(): TState;
	setState(state: TState): void;
}
