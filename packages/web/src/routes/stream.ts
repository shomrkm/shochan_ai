import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { createSession, type Session } from 'better-sse';
import { RedisStateStore } from '../state/redis-store';
import { StreamManager } from '../streaming/manager';

const router: ExpressRouter = Router();

// Shared instances (will be initialized by initializeStream)
let redisStore: RedisStateStore;
let streamManager: StreamManager;

/**
 * Initialize stream route with dependencies
 */
export function initializeStream(
	redis: RedisStateStore,
	manager: StreamManager,
): Router {
	redisStore = redis;
	streamManager = manager;
	return router;
}

/**
 * GET /stream/:conversationId
 *
 * Establishes SSE connection for real-time event streaming
 */
router.get('/:conversationId', async (req: Request, res: Response) => {
	const { conversationId } = req.params;

	try {
		// Verify conversation exists
		const thread = await redisStore.get(conversationId);
		if (!thread) {
			res.status(404).json({ error: 'Conversation not found' });
			return;
		}

		// Create SSE session
		const session: Session = await createSession(req, res);

		// Register session with StreamManager
		streamManager.register(conversationId, session);

		console.log(`📡 SSE connection established for: ${conversationId}`);

		// Send initial connection event
		session.push(
			{
				type: 'connected',
				timestamp: Date.now(),
				data: { conversationId },
			},
			'connected',
		);

		// Handle client disconnect
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

export default router;
