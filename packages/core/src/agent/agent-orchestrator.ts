import type { Thread } from '../thread/thread';
import type { Event } from '../types/event';
import type { AgentReducer } from './agent-reducer';
import type { ToolExecutor } from './tool-executor';
import type { StateStore } from '../state/state-store';

/**
 * AgentOrchestrator: Coordinates the agent's execution loop.
 *
 * This class orchestrates the interaction between:
 * - AgentReducer: Pure state transitions
 * - ToolExecutor: Side effects (API calls, I/O)
 * - StateStore: State persistence
 *
 * Responsibilities:
 * 1. Process events through the reducer
 * 2. Execute tool calls via the executor
 * 3. Persist state changes via the state store
 * 4. Maintain the event-driven execution flow
 *
 * This is a simplified implementation that focuses on:
 * - Processing events sequentially
 * - Maintaining state immutability
 * - Separating pure functions from side effects
 *
 * Future enhancements could include:
 * - Async generator for streaming events
 * - Launch/Pause/Resume capabilities
 * - Conversation ID management
 * - Approval workflows
 */
export class AgentOrchestrator {
	/**
	 * Creates a new AgentOrchestrator.
	 *
	 * @param reducer - The reducer for pure state transitions
	 * @param executor - The executor for tool execution (side effects)
	 * @param stateStore - The state store for persistence
	 */
	constructor(
		private readonly reducer: AgentReducer<Thread, Event>,
		private readonly executor: ToolExecutor,
		private readonly stateStore: StateStore<Thread>,
	) {}

	/**
	 * Processes an event and updates the state.
	 *
	 * This method:
	 * 1. Retrieves the current state from the store
	 * 2. Applies the event via the reducer (pure function)
	 * 3. Persists the new state
	 * 4. Returns the updated state
	 *
	 * @param event - The event to process
	 * @returns The updated thread state
	 *
	 * @example
	 * ```typescript
	 * const orchestrator = new AgentOrchestrator(reducer, executor, stateStore);
	 *
	 * const userInputEvent: UserInputEvent = {
	 *   type: 'user_input',
	 *   timestamp: Date.now(),
	 *   data: 'Create a task'
	 * };
	 *
	 * const newState = await orchestrator.processEvent(userInputEvent);
	 * ```
	 */
	async processEvent(event: Event): Promise<Thread> {
		// Get current state
		const currentState = this.stateStore.getState();

		// Apply event through reducer (pure function)
		const newState = this.reducer.reduce(currentState, event);

		// Persist new state
		this.stateStore.setState(newState);

		return newState;
	}

	/**
	 * Executes a tool call and processes the result.
	 *
	 * This method:
	 * 1. Executes the tool via the executor (side effect)
	 * 2. Retrieves the result event
	 * 3. Processes the result event through the reducer
	 * 4. Persists the updated state
	 * 5. Returns the updated state
	 *
	 * @param toolCallEvent - The tool call event to execute
	 * @returns The updated thread state after tool execution
	 *
	 * @example
	 * ```typescript
	 * const toolCallEvent: ToolCallEvent = {
	 *   type: 'tool_call',
	 *   timestamp: Date.now(),
	 *   data: {
	 *     intent: 'get_tasks',
	 *     parameters: {}
	 *   }
	 * };
	 *
	 * const newState = await orchestrator.executeToolCall(toolCallEvent);
	 * ```
	 */
	async executeToolCall(toolCallEvent: Event): Promise<Thread> {
		// First, add the tool call event to the state
		const stateWithToolCall = await this.processEvent(toolCallEvent);

		// Extract the tool call from the event
		if (toolCallEvent.type !== 'tool_call') {
			throw new Error('Event must be a tool_call event');
		}

		// Execute the tool (side effect)
		const result = await this.executor.execute(toolCallEvent.data);

		// Process the tool response event
		const finalState = this.reducer.reduce(stateWithToolCall, result.event);

		// Persist the final state
		this.stateStore.setState(finalState);

		return finalState;
	}

	/**
	 * Gets the current state from the state store.
	 *
	 * @returns The current thread state
	 */
	getState(): Thread {
		return this.stateStore.getState();
	}
}
