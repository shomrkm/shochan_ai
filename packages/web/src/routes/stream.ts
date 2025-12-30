import { Router, type Request, type Response } from 'express';
import { createSession, type Session } from 'better-sse';
import type { RedisStateStore } from '../state/redis-store';
import type { StreamManager } from '../streaming/manager';

/**
 * Dependencies required by the stream router.
 */
export interface StreamDependencies {
	redisStore: RedisStateStore;
	streamManager: StreamManager;
}

/**
 * Create stream router with injected dependencies.
 * Dependencies are captured in closure, avoiding global state.
 *
 * @param deps - Stream dependencies (redisStore, streamManager)
 * @returns Configured Express Router
 */
export function createStreamRouter(deps: StreamDependencies): Router {
	const { redisStore, streamManager } = deps;
	const router = Router();

	/**
	 * GET /api/stream/:conversationId
	 * Establishes SSE connection for real-time event streaming
	 */
	router.get('/:conversationId', async (req: Request, res: Response) => {
		const { conversationId } = req.params;

		try {
			const thread = await redisStore.get(conversationId);
			if (!thread) {
				res.status(404).json({ error: 'Conversation not found' });
				return;
			}

			const session: Session = await createSession(req, res);
			streamManager.register(conversationId, session);

			console.log(`📡 SSE connection established for: ${conversationId}`);

			session.push(
				{
					type: 'connected',
					timestamp: Date.now(),
					data: { conversationId },
				},
				'connected',
			);

			req.on('close', () => {
				console.log(`🔌 SSE connection closed for: ${conversationId}`);
				streamManager.unregister(conversationId);
			});
		} catch (error) {
			console.error('SSE connection error:', error);
			if (!res.headersSent) {
				res.status(500).json({ error: 'Failed to establish SSE connection' });
			}
		}
	});

	return router;
}
