import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { randomUUID } from 'crypto';
import {
	Thread,
	LLMAgentReducer,
	NotionToolExecutor,
	AgentOrchestrator,
	builPrompt,
	taskAgentTools,
	isAwaitingApprovalEvent,
	type Event,
} from '@shochan_ai/core';
import { OpenAIClient, NotionClient } from '@shochan_ai/client';
import { RedisStateStore } from '../state/redis-store';
import { StreamManager } from '../streaming/manager';

const router: ExpressRouter = Router();

// Shared instances
let redisStore: RedisStateStore;
let streamManager: StreamManager;
let orchestrator: AgentOrchestrator;

/**
 * Initialize agent dependencies.
 * Should be called once at server startup.
 */
async function initializeAgent(
	store: RedisStateStore,
	manager: StreamManager,
): Promise<void> {
	redisStore = store;
	streamManager = manager;

	const openaiClient = new OpenAIClient();
	const notionClient = new NotionClient();
	const reducer = new LLMAgentReducer(openaiClient, taskAgentTools, builPrompt);
	const executor = new NotionToolExecutor(notionClient);

	// Create orchestrator with InMemoryStateStore wrapper
	// (We'll manage Thread persistence separately via Redis)
	orchestrator = new AgentOrchestrator(reducer, executor, {
		getState: () => new Thread([]),
		setState: () => {},
	});
}

/**
 * POST /api/agent/query
 * Submit a new query to the agent.
 */
router.post('/query', async (req: Request, res: Response) => {
	try {
		const { message } = req.body;

		if (!message || typeof message !== 'string') {
			res.status(400).json({ error: 'Message is required and must be a string' });
			return;
		}

		const conversationId = randomUUID();

		const userInputEvent: Event = {
			type: 'user_input',
			timestamp: Date.now(),
			data: message,
		};
		const initialThread = new Thread([userInputEvent]);

		await redisStore.set(conversationId, initialThread);

		processAgent(conversationId).catch((error) => {
			console.error(`Agent processing failed for ${conversationId}:`, error);
			streamManager.send(conversationId, {
				type: 'error',
				timestamp: Date.now(),
				data: { error: error.message },
			});
		});

		res.json({ conversationId });
	} catch (error) {
		console.error('Query error:', error);
		res.status(500).json({ error: 'Failed to process query' });
	}
});

/**
 * POST /api/agent/approve/:conversationId
 * Approve or deny a pending tool call.
 */
router.post('/approve/:conversationId', async (req: Request, res: Response) => {
	try {
		const { conversationId } = req.params;
		const { approved } = req.body;

		if (typeof approved !== 'boolean') {
			res.status(400).json({ error: 'approved must be a boolean' });
			return;
		}

		// Get current thread from Redis
		const thread = await redisStore.get(conversationId);
		if (!thread) {
			res.status(404).json({ error: 'Conversation not found' });
			return;
		}

		// Check if the latest event is awaiting_approval
		const latestEvent = thread.latestEvent;
		if (!latestEvent || !isAwaitingApprovalEvent(latestEvent)) {
			res.status(400).json({
				error: 'No pending approval',
				message: 'This conversation is not waiting for approval',
			});
			return;
		}

		// Add approval event
		const approvalEvent: Event = {
			type: 'user_input',
			timestamp: Date.now(),
			data: approved ? 'approved' : 'denied',
		};

		const updatedThread = new Thread([...thread.events, approvalEvent]);
		await redisStore.set(conversationId, updatedThread);

		// Resume agent processing
		processAgent(conversationId).catch((error) => {
			console.error(`Agent processing failed for ${conversationId}:`, error);
			streamManager.send(conversationId, {
				type: 'error',
				timestamp: Date.now(),
				data: { error: error.message },
			});
		});

		res.json({ success: true });
	} catch (error) {
		console.error('Approve error:', error);
		res.status(500).json({ error: 'Failed to process approval' });
	}
});

/**
 * Process agent execution in background.
 * Streams events to the client via SSE.
 */
async function processAgent(conversationId: string): Promise<void> {
	try {
		let currentThread = await redisStore.get(conversationId);
		if (!currentThread) {
			throw new Error('Conversation not found');
		}

		// Process the latest event
		const latestEvent = currentThread.latestEvent;
		if (!latestEvent) {
			throw new Error('Thread has no events');
		}
		currentThread = await orchestrator.processEvent(latestEvent);
		await redisStore.set(conversationId, currentThread);

		// TODO: Implement full agent loop with tool execution
		// For now, send completion event
		streamManager.send(conversationId, {
			type: 'complete',
			timestamp: Date.now(),
			data: {
				message: 'Agent processing completed',
			},
		});
	} catch (error) {
		console.error(`processAgent error for ${conversationId}:`, error);
		throw error;
	}
}

export { router as agentRouter };
export { initializeAgent };
