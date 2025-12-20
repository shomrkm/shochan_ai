import type { Thread } from '../thread/thread';
import type { Event, ToolCallEvent } from '../types/event';
import type { AgentReducer } from './agent-reducer';
import type { ToolExecutor } from './tool-executor';
import type { StateStore } from '../state/state-store';

/**
 * Coordinates Reducer, Executor, and StateStore (Mediator Pattern).
 * Separates pure state transitions from side effects.
 */
export class AgentOrchestrator {
	constructor(
		private readonly reducer: AgentReducer<Thread, Event>,
		private readonly executor: ToolExecutor,
		private readonly stateStore: StateStore<Thread>,
	) {}

	async processEvent(event: Event): Promise<Thread> {
		const currentState = this.stateStore.getState();
		const newState = this.reducer.reduce(currentState, event);
		this.stateStore.setState(newState);
		return newState;
	}

	/**
	 * Executes a tool call and adds both the tool call and response events to state.
	 * @param toolCallEvent - Must be a ToolCallEvent (enforced by TypeScript)
	 */
	async executeToolCall(toolCallEvent: ToolCallEvent): Promise<Thread> {
		await this.processEvent(toolCallEvent);

		const result = await this.executor.execute(toolCallEvent.data);
		const finalState = await this.processEvent(result.event);

		return finalState;
	}

	getState(): Thread {
		return this.stateStore.getState();
	}
}
