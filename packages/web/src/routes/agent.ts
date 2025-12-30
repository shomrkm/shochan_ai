import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { randomUUID } from 'crypto';
import {
	Thread,
	LLMAgentReducer,
	NotionToolExecutor,
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
let reducer: LLMAgentReducer<OpenAIClient, typeof taskAgentTools>;
let executor: NotionToolExecutor<NotionClient>;

/**
 * Initialize agent dependencies.
 * Should be called once at server startup.
 */
async function initializeAgent(
	store: RedisStateStore,
	manager: StreamManager,
): Promise<typeof router> {
	redisStore = store;
	streamManager = manager;

	const openaiClient = new OpenAIClient();
	const notionClient = new NotionClient();
	reducer = new LLMAgentReducer(openaiClient, taskAgentTools, builPrompt);
	executor = new NotionToolExecutor(notionClient);

	return router;
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

		console.log(`🤖 Starting agent processing for: ${conversationId}`);

		// Agent loop
		while (true) {
			// 1. Generate next tool call via LLM
			const toolCallEvent = await reducer.generateNextToolCall(currentThread);

			// 2. No tool call - agent finished
			if (!toolCallEvent) {
				console.log(`✅ Agent finished (no tool call) for: ${conversationId}`);
				streamManager.send(conversationId, {
					type: 'complete',
					timestamp: Date.now(),
					data: { message: 'Agent processing completed' },
				});
				break;
			}

			// 3. Add tool_call event to thread and stream it
			console.log(`🔧 Tool call generated: ${toolCallEvent.data.intent}`);
			streamManager.send(conversationId, toolCallEvent);
			currentThread = new Thread([...currentThread.events, toolCallEvent]);
			await redisStore.set(conversationId, currentThread);

			const toolCall = toolCallEvent.data;

			// 4. Check if approval required (delete_task)
			if (toolCall.intent === 'delete_task') {
				console.log(`⚠️  Approval required for: ${conversationId}`);

				// Create awaiting_approval event
				const awaitingApprovalEvent: Event = {
					type: 'awaiting_approval',
					timestamp: Date.now(),
					data: toolCall,
				};

				// Add to thread and save to Redis
				currentThread = new Thread([...currentThread.events, awaitingApprovalEvent]);
				await redisStore.set(conversationId, currentThread);

				// Stream the event
				streamManager.send(conversationId, awaitingApprovalEvent);

				break; // Pause - will resume when approval is received
			}

			// 5. Handle terminal tools
			if (toolCall.intent === 'done_for_now') {
				console.log(`✅ Agent finished (done_for_now) for: ${conversationId}`);
				streamManager.send(conversationId, {
					type: 'complete',
					timestamp: Date.now(),
					data: { message: toolCall.parameters.message },
				});
				break;
			}

			if (toolCall.intent === 'request_more_information') {
				console.log(`❓ More information requested for: ${conversationId}`);
				streamManager.send(conversationId, {
					type: 'complete',
					timestamp: Date.now(),
					data: { message: toolCall.parameters.message },
				});
				break;
			}

			// 6. Execute tool
			console.log(`⚙️  Executing tool: ${toolCall.intent}`);
			const result = await executor.execute(toolCall);

			// 7. Stream tool_response event
			streamManager.send(conversationId, result.event);
			currentThread = new Thread([...currentThread.events, result.event]);
			await redisStore.set(conversationId, currentThread);

			console.log(`✅ Tool executed successfully: ${toolCall.intent}`);
		}
	} catch (error) {
		console.error(`❌ processAgent error for ${conversationId}:`, error);
		streamManager.send(conversationId, {
			type: 'error',
			timestamp: Date.now(),
			data: {
				error: error instanceof Error ? error.message : String(error),
				code: 'AGENT_PROCESSING_FAILED',
			},
		});
		throw error;
	}
}

export { initializeAgent };
export default router;
