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

/**
 * Dependencies required by the agent router.
 * Using explicit interface enables easy mocking in tests.
 */
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

			processAgent(conversationId, deps).catch((error) => {
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
	router.post(
		'/approve/:conversationId',
		async (req: Request, res: Response) => {
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

				if (approved) {
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
					currentThread = new Thread([...currentThread.events, result.event]);
					await redisStore.set(conversationId, currentThread);

					console.log(
						`✅ Tool executed successfully: ${pendingToolCall.intent}`,
					);

					processAgent(conversationId, deps).catch((error) => {
						console.error(
							`Agent processing failed for ${conversationId}:`,
							error,
						);
						streamManager.send(conversationId, {
							type: 'error',
							timestamp: Date.now(),
							data: { error: error.message },
						});
					});
				} else {
					console.log(`❌ Approval denied for: ${conversationId}`);

					const denialEvent: Event = {
						type: 'user_input',
						timestamp: Date.now(),
						data: 'denied',
					};
					const updatedThread = new Thread([...thread.events, denialEvent]);
					await redisStore.set(conversationId, updatedThread);

					processAgent(conversationId, deps).catch((error) => {
						console.error(
							`Agent processing failed for ${conversationId}:`,
							error,
						);
						streamManager.send(conversationId, {
							type: 'error',
							timestamp: Date.now(),
							data: { error: error.message },
						});
					});
				}

				res.json({ success: true });
			} catch (error) {
				console.error('Approve error:', error);
				res.status(500).json({ error: 'Failed to process approval' });
			}
		},
	);

	return router;
}

/**
 * Maximum number of iterations to prevent infinite loops.
 * Protects against LLM generating unexpected continuous responses.
 */
const MAX_ITERATIONS = 50;

/**
 * Process agent execution in background.
 * Receives dependencies explicitly instead of using globals.
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

		while (true) {
			if (iterations >= MAX_ITERATIONS) {
				console.error( `🔁 Max iterations reached for ${conversationId} after ${iterations} iterations`);
				throw new Error(`Maximum iterations (${MAX_ITERATIONS}) reached without completion`);
			}
			iterations++;

			const toolCallEvent = await reducer.generateNextToolCall(currentThread);

			if (!toolCallEvent) {
				console.log(`✅ Agent finished (no tool call) for: ${conversationId}`);
				streamManager.send(conversationId, {
					type: 'complete',
					timestamp: Date.now(),
					data: { message: 'Agent processing completed' },
				});
				break;
			}

			console.log(`🔧 Tool call generated: ${toolCallEvent.data.intent}`);
			streamManager.send(conversationId, toolCallEvent);
			currentThread = new Thread([...currentThread.events, toolCallEvent]);
			await redisStore.set(conversationId, currentThread);

			const toolCall = toolCallEvent.data;

			if (toolCall.intent === 'delete_task') {
				console.log(`⚠️  Approval required for: ${conversationId}`);

				const awaitingApprovalEvent: Event = {
					type: 'awaiting_approval',
					timestamp: Date.now(),
					data: toolCall,
				};

				currentThread = new Thread([
					...currentThread.events,
					awaitingApprovalEvent,
				]);
				await redisStore.set(conversationId, currentThread);
				streamManager.send(conversationId, awaitingApprovalEvent);

				break;
			}

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

			console.log(`⚙️  Executing tool: ${toolCall.intent}`);
			const result = await executor.execute(toolCall);

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
