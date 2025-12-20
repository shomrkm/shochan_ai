import { Thread } from '../thread/thread';
import type { Event } from '../types/event';
import type { AgentReducer } from './agent-reducer';

/**
 * Pure reducer implementation that adds events to thread history.
 */
export class ThreadReducer implements AgentReducer<Thread, Event> {
	reduce(state: Thread, event: Event): Thread {
		return new Thread([...state.events, event]);
	}
}
