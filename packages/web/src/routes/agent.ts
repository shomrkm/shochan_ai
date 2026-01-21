import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import {
	Thread,
	LLMAgentReducer,
	NotionToolExecutor,
	isAwaitingApprovalEvent,
	type Event,
	taskAgentTools,
} from '@shochan_ai/core';
import type { OpenAIClient, NotionClient } from '@shochan_ai/client';
import type { RedisStateStore } from '../state/redis-store';
import type { StreamManager } from '../streaming/manager';

export interface AgentDependencies {
	redisStore: RedisStateStore;
	streamManager: StreamManager;
	reducer: LLMAgentReducer<OpenAIClient, typeof taskAgentTools>;
	executor: NotionToolExecutor<NotionClient>;
}

/**
 * Create agent router with injected dependencies.
 * Dependencies are captured in closure, avoiding global state.
 *
 * @param deps - Agent dependencies (redisStore, streamManager, reducer, executor)
 * @returns Configured Express Router
 */
export function createAgentRouter(deps: AgentDependencies): Router {
	const { redisStore, streamManager, reducer, executor } = deps;
	const router = Router();

	/**
	 * POST /api/agent/query
	 * Submit a new query to the agent.
	 */
	router.post('/query', async (req: Request, res: Response) => {
		try {
			const { message } = req.body;
			if (!message || typeof message !== 'string') {
				res
					.status(400)
					.json({ error: 'Message is required and must be a string' });
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
      
		// Start agent processing in background (don't await)
		processAgent(conversationId, deps).catch((error) => {
			console.error(`Background processAgent error for ${conversationId}:`, error);
		});

		// Return conversationId immediately so client can start SSE connection
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

      const thread = await redisStore.get(conversationId);
      if (!thread) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const latestEvent = thread.latestEvent;
      if (!latestEvent || !isAwaitingApprovalEvent(latestEvent)) {
        res.status(400).json({
          error: 'No pending approval',
          message: 'This conversation is not waiting for approval',
        });
        return;
      }

      const pendingToolCall = latestEvent.data;

      if(!approved) {
        console.log(`❌ Approval denied for: ${conversationId}`);

        const denialEvent: Event = {
          type: 'user_input',
          timestamp: Date.now(),
          data: 'denied',
        };
        const updatedThread = reducer.reduce(thread, denialEvent);
        await redisStore.set(conversationId, updatedThread);

        await processAgent(conversationId, deps);

        res.json({ success: true });
        return;
      }

      console.log(`✅ Approval granted for: ${conversationId}`);

      const approvalEvent: Event = {
        type: 'user_input',
        timestamp: Date.now(),
        data: 'approved',
      };
      let currentThread = new Thread([...thread.events, approvalEvent]);
      await redisStore.set(conversationId, currentThread);

      console.log(`⚙️  Executing approved tool: ${pendingToolCall.intent}`);
      const result = await executor.execute(pendingToolCall);

      streamManager.send(conversationId, result.event);
      currentThread = reducer.reduce(currentThread, result.event);
      await redisStore.set(conversationId, currentThread);

      await processAgent(conversationId, deps);

      console.log(
        `✅ Tool executed successfully: ${pendingToolCall.intent}`,
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Approve error:', error);
      res.status(500).json({ error: 'Failed to process approval' });
    }
  });

	return router;
}

/**
 * Maximum number of iterations to prevent infinite loops.
 * Protects against LLM generating unexpected continuous responses.
 */
const MAX_ITERATIONS = 50;

/**
 * SSE connection timeout configuration
 */
const SSE_CONNECTION_TIMEOUT = 2000; // 2 seconds
const SSE_CONNECTION_CHECK_INTERVAL = 100; // 100ms

/**
 * Wait for SSE connection to be established with timeout.
 * Polls the StreamManager to check if the session exists.
 *
 * @param conversationId - Unique conversation identifier
 * @param streamManager - StreamManager instance
 * @param timeout - Maximum time to wait in milliseconds (default: 2000ms)
 * @returns Promise<boolean> - true if connection established, false if timeout
 */
async function waitForSSEConnection(
	conversationId: string,
	streamManager: StreamManager,
	timeout: number = SSE_CONNECTION_TIMEOUT,
): Promise<boolean> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		if (streamManager.hasSession(conversationId)) {
			const elapsed = Date.now() - startTime;
			console.log(`✅ SSE connection confirmed for ${conversationId} (${elapsed}ms)`);
			return true;
		}
		await new Promise((resolve) => setTimeout(resolve, SSE_CONNECTION_CHECK_INTERVAL));
	}

	console.warn(`⚠️  SSE connection timeout for ${conversationId} after ${timeout}ms`);
	return false;
}

/**
 * Generate explanation text with streaming and send chunks via SSE.
 * This is a helper function to avoid code duplication for streaming logic.
 *
 * @param conversationId - Unique conversation identifier
 * @param currentThread - Current thread state
 * @param deps - Agent dependencies (reducer and streamManager)
 */
async function generateAndStreamExplanation(
	conversationId: string,
	currentThread: Thread,
	deps: Pick<AgentDependencies, 'reducer' | 'streamManager'>,
): Promise<void> {
	const { reducer, streamManager } = deps;

	console.log(`📝 Generating explanation with streaming...`);

	await reducer.generateExplanationWithStreaming(
		currentThread,
		(chunk, messageId) => {
			const textChunkEvent: Event = {
				type: 'text_chunk',
				timestamp: Date.now(),
				data: {
					content: chunk,
					messageId,
				},
			};
			streamManager.send(conversationId, textChunkEvent);
		},
	);

	console.log(`✅ Explanation generated for ${conversationId}`);
}

/**
 * Process agent execution in background using Multi-turn approach.
 * Receives dependencies explicitly instead of using globals.
 *
 * Multi-turn approach:
 * - Turn 1: Tool call detection and execution (non-streaming)
 * - Turn 2: Text generation with streaming (real-time display)
 *
 * @param conversationId - Unique conversation identifier
 * @param deps - Agent dependencies
 * @throws {Error} When conversation not found or max iterations reached
 */
async function processAgent(
	conversationId: string,
	deps: AgentDependencies,
): Promise<void> {
	const { redisStore, streamManager, reducer, executor } = deps;
	let iterations = 0;

	try {
		let currentThread = await redisStore.get(conversationId);
		if (!currentThread) {
			throw new Error('Conversation not found');
		}

		console.log(`🤖 Starting agent processing for: ${conversationId}`);

		// Send connected event to confirm SSE connection establishment
		streamManager.send(conversationId, {
			type: 'connected',
			timestamp: Date.now(),
			data: { status: 'ready', conversationId },
		});

		// Wait for SSE connection establishment with dynamic polling
		const isConnected = await waitForSSEConnection(conversationId, streamManager);
		if (!isConnected) {
			console.warn(`⚠️  Proceeding without confirmed SSE connection for ${conversationId}`);
		}

		while (true) {
			if (iterations >= MAX_ITERATIONS) {
				console.error( `🔁 Max iterations reached for ${conversationId} after ${iterations} iterations`);
				throw new Error(`Maximum iterations (${MAX_ITERATIONS}) reached without completion`);
			}
			iterations++;

			// ========================================
			// Turn 1: Tool call detection and execution
			// ========================================
			const toolCallEvent = await reducer.generateNextToolCall(currentThread);

			if (!toolCallEvent) {
				console.error(`❌ No tool call generated for ${conversationId}`);
				break;
			}

			console.log(`🔧 Tool call generated: ${toolCallEvent.data.intent}`);
			streamManager.send(conversationId, toolCallEvent);
			currentThread = reducer.reduce(currentThread, toolCallEvent);
			await redisStore.set(conversationId, currentThread);

		const toolCall = toolCallEvent.data;

		// ========================================
		// Check if this is a completion tool
		// ========================================
		if (toolCall.intent === 'done_for_now' || toolCall.intent === 'request_more_information') {
			console.log(`📝 Completion tool detected: ${toolCall.intent}`);
			await generateAndStreamExplanation(conversationId, currentThread, { reducer, streamManager });
			break; // Complete
		}

		// delete_task requires approval
		if (toolCall.intent === 'delete_task') {
			console.log(`⚠️  Approval required for: ${conversationId}`);

			const awaitingApprovalEvent: Event = { 
				type: 'awaiting_approval', 
				timestamp: Date.now(), 
				data: toolCall 
			};
			streamManager.send(conversationId, awaitingApprovalEvent);
			currentThread = reducer.reduce(currentThread, awaitingApprovalEvent);
			await redisStore.set(conversationId, currentThread);

			break;
		}

		// Execute tool
		console.log(`⚙️  Executing tool: ${toolCall.intent}`);
		const result = await executor.execute(toolCall);

		streamManager.send(conversationId, result.event);
		currentThread = reducer.reduce(currentThread, result.event);
		await redisStore.set(conversationId, currentThread);

		console.log(`✅ Tool executed successfully: ${toolCall.intent}`);

		// ========================================
		// Turn 2: Generate explanation with streaming
		// ========================================
		await generateAndStreamExplanation(conversationId, currentThread, { reducer, streamManager });
		break; // Complete after explanation
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
	}
}
