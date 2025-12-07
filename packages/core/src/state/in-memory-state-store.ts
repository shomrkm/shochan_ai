import type { StateStore } from './state-store';
import type { Thread } from '../thread/thread';

/**
 * In-memory implementation of StateStore.
 *
 * This implementation stores state in memory and is suitable for:
 * - Single-threaded applications
 * - Testing
 * - Temporary state that doesn't need persistence
 *
 * For production use cases requiring:
 * - Persistence across restarts
 * - Multi-process state sharing
 * - State history/time-travel debugging
 * Consider implementing a different StateStore (e.g., using Redis, Database, or File System).
 *
 * @template TState - The type of state being stored (default: Thread)
 */
export class InMemoryStateStore<TState = Thread> implements StateStore<TState> {
  private state: TState;

  /**
   * Creates a new InMemoryStateStore with the given initial state.
   *
   * @param initialState - The initial state to store
   */
  constructor(initialState: TState) {
    this.state = initialState;
  }

  /**
   * Retrieves the current state.
   *
   * @returns The current state object
   */
  getState(): TState {
    return this.state;
  }

  /**
   * Updates the state with a new state object.
   *
   * Note: This method completely replaces the current state.
   * It does not perform any merging.
   *
   * @param state - The new state to set
   */
  setState(state: TState): void {
    this.state = state;
  }
}
