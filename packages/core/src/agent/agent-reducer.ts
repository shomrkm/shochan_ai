import type { Thread } from '../thread/thread';
import type { Event } from '../types/event';

/**
 * AgentReducer interface following the Redux pattern.
 *
 * A reducer is a pure function that takes the current state and an event,
 * and returns a new state. It must not have any side effects or perform
 * async operations.
 *
 * Key principles:
 * - Pure function: Same inputs always produce same outputs
 * - No side effects: Cannot modify external state or perform I/O
 * - Returns new state: Never mutates the input state
 * - Synchronous: All async operations should be handled outside the reducer
 *
 * @template TState - The type of state being managed (default: Thread)
 * @template TEvent - The type of events the reducer handles (default: Event)
 */
export interface AgentReducer<TState = Thread, TEvent = Event> {
  /**
   * Reduces the current state and an event into a new state.
   *
   * This is the core reducer function following Redux principles:
   * - Must be a pure function
   * - Must return a new state object (immutability)
   * - Must not perform any side effects
   * - Must be synchronous
   *
   * @param state - The current state
   * @param event - The event to process
   * @returns A new state object reflecting the event
   *
   * @example
   * ```typescript
   * const reducer: AgentReducer<Thread, Event> = {
   *   reduce(state: Thread, event: Event): Thread {
   *     // Create new Thread with the event added
   *     return new Thread([...state.events, event]);
   *   }
   * };
   * ```
   */
  reduce(state: TState, event: TEvent): TState;
}
