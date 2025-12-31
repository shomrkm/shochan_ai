import type { Session } from 'better-sse';
import type { Event } from '@shochan_ai/core';

/**
 * StreamManager manages SSE (Server-Sent Events) sessions for real-time event streaming.
 * Each conversation has its own SSE session identified by conversationId.
 */
export class StreamManager {
	private sessions = new Map<string, Session>();

	/**
	 * Register a new SSE session for a conversation.
	 * @param conversationId - Unique identifier for the conversation
	 * @param session - better-sse Session instance
	 */
	register(conversationId: string, session: Session): void {
		this.sessions.set(conversationId, session);
		console.log(`📡 SSE session registered: ${conversationId}`);
	}

	/**
	 * Send an event to a specific conversation's SSE session.
	 * If the session doesn't exist, the event is silently ignored.
	 * @param conversationId - Unique identifier for the conversation
	 * @param event - Event to send to the client
	 */
	send(conversationId: string, event: Event): void {
		const session = this.sessions.get(conversationId);
		if (!session) {
			console.warn(`⚠️  No SSE session found for: ${conversationId}`);
			return;
		}

		try {
			session.push(event, event.type);
			console.log(`📤 Event sent to ${conversationId}: ${event.type}`);
		} catch (error) {
			console.error(`❌ Failed to send event to ${conversationId}:`, error);
			this.unregister(conversationId);
		}
	}

	/**
	 * Unregister an SSE session when the connection is closed.
	 * @param conversationId - Unique identifier for the conversation
	 */
	unregister(conversationId: string): void {
		const session = this.sessions.get(conversationId);
		if (session) {
			this.sessions.delete(conversationId);
			console.log(`🔌 SSE session unregistered: ${conversationId}`);
		}
	}

	/**
	 * Check if a session exists for a conversation.
	 * @param conversationId - Unique identifier for the conversation
	 */
	hasSession(conversationId: string): boolean {
		return this.sessions.has(conversationId);
	}

	/**
	 * Get the number of active sessions.
	 */
	getActiveSessionCount(): number {
		return this.sessions.size;
	}

	/**
	 * Get all active conversation IDs.
	 */
	getActiveConversationIds(): string[] {
		return Array.from(this.sessions.keys());
	}

	/**
	 * Close all sessions (for graceful shutdown).
	 */
	closeAll(): void {
		for (const conversationId of this.sessions.keys()) {
			this.unregister(conversationId);
		}
		console.log('🛑 All SSE sessions closed');
	}
}
