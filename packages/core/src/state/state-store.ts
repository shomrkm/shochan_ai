import type { Thread } from '../thread/thread';

/**
 * StateStore interface for managing application state.
 *
 * This interface follows the Redux pattern where state is immutable
 * and updates are performed by returning new state objects.
 *
 * @template TState - The type of state being stored (default: Thread)
 */
export interface StateStore<TState = Thread> {
  /**
   * Retrieves the current state.
   *
   * @returns The current state object
   */
  getState(): TState;

  /**
   * Updates the state with a new state object.
   *
   * Note: This method does not merge states. The provided state
   * completely replaces the current state.
   *
   * @param state - The new state to set
   */
  setState(state: TState): void;
}
