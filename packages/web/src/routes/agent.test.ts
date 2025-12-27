import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { Thread } from '@shochan_ai/core';
import { RedisStateStore } from '../state/redis-store';
import { StreamManager } from '../streaming/manager';
import { initializeAgent } from './agent';

// Mock API clients to avoid requiring real API keys in tests
vi.mock('@shochan_ai/client', () => ({
	OpenAIClient: vi.fn().mockImplementation(() => ({
		generateToolCall: vi.fn().mockResolvedValue({ toolCall: null }),
	})),
	NotionClient: vi.fn().mockImplementation(() => ({})),
}));

describe('Agent Routes', () => {
	let app: Express;
	let redisStore: RedisStateStore;
	let streamManager: StreamManager;

	beforeAll(async () => {
		app = express();
		app.use(express.json());

		redisStore = new RedisStateStore(
			process.env.REDIS_URL || 'redis://localhost:6379',
		);
		streamManager = new StreamManager();

		await redisStore.connect();

		const agentRouter = await initializeAgent(redisStore, streamManager);
		app.use('/api/agent', agentRouter);
	});

	afterAll(async () => {
		await redisStore.disconnect();
	});

	describe('POST /api/agent/query', () => {
		it('should return conversationId when valid message is provided', async () => {
			const response = await request(app)
				.post('/api/agent/query')
				.send({ message: 'Test message' })
				.expect(200);

			expect(response.body).toHaveProperty('conversationId');
			expect(typeof response.body.conversationId).toBe('string');
			expect(response.body.conversationId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);

			// Verify thread was saved to Redis
			const thread = await redisStore.get(response.body.conversationId);
			expect(thread).toBeDefined();
			expect(thread?.events).toHaveLength(1);
			expect(thread?.events[0].type).toBe('user_input');
			expect(thread?.events[0].data).toBe('Test message');

			// Cleanup
			await redisStore.delete(response.body.conversationId);
		});

		it('should return 400 when message is missing', async () => {
			const response = await request(app)
				.post('/api/agent/query')
				.send({})
				.expect(400);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toBe(
				'Message is required and must be a string',
			);
		});

		it('should return 400 when message is not a string', async () => {
			const response = await request(app)
				.post('/api/agent/query')
				.send({ message: 123 })
				.expect(400);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toBe(
				'Message is required and must be a string',
			);
		});
	});

	describe('POST /api/agent/approve/:conversationId', () => {
		it('should return 404 when conversation does not exist', async () => {
			const response = await request(app)
				.post('/api/agent/approve/non-existent-id')
				.send({ approved: true })
				.expect(404);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toBe('Conversation not found');
		});

		it('should return 400 when approved is not a boolean', async () => {
			// Create a test conversation
			const conversationId = 'test-conversation-id';
			const thread = new Thread([
				{
					type: 'user_input',
					timestamp: Date.now(),
					data: 'Test message',
				},
			]);
			await redisStore.set(conversationId, thread);

			const response = await request(app)
				.post(`/api/agent/approve/${conversationId}`)
				.send({ approved: 'yes' })
				.expect(400);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toBe('approved must be a boolean');

			// Cleanup
			await redisStore.delete(conversationId);
		});

		it('should return 400 when no pending approval', async () => {
			// Create a test conversation without awaiting_approval event
			const conversationId = 'test-conversation-id-2';
			const thread = new Thread([
				{
					type: 'user_input',
					timestamp: Date.now(),
					data: 'Test message',
				},
			]);
			await redisStore.set(conversationId, thread);

			const response = await request(app)
				.post(`/api/agent/approve/${conversationId}`)
				.send({ approved: true })
				.expect(400);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toBe('No pending approval');
			expect(response.body.message).toBe(
				'This conversation is not waiting for approval',
			);

			// Cleanup
			await redisStore.delete(conversationId);
		});

		it('should return 200 when approving a valid awaiting_approval event', async () => {
			// Create a test conversation with awaiting_approval event
			const conversationId = 'test-conversation-id-3';
			const thread = new Thread([
				{
					type: 'user_input',
					timestamp: Date.now(),
					data: 'Delete task ABC',
				},
				{
					type: 'awaiting_approval',
					timestamp: Date.now(),
					data: {
						intent: 'delete_task',
						parameters: { task_id: 'ABC' },
					},
				},
			]);
			await redisStore.set(conversationId, thread);

			const response = await request(app)
				.post(`/api/agent/approve/${conversationId}`)
				.send({ approved: true })
				.expect(200);

			expect(response.body).toHaveProperty('success');
			expect(response.body.success).toBe(true);

			// Verify approval event was added
			const updatedThread = await redisStore.get(conversationId);
			expect(updatedThread?.events).toHaveLength(3);
			expect(updatedThread?.events[2].type).toBe('user_input');
			expect(updatedThread?.events[2].data).toBe('approved');

			// Cleanup
			await redisStore.delete(conversationId);
		});

		it('should handle denial correctly', async () => {
			// Create a test conversation with awaiting_approval event
			const conversationId = 'test-conversation-id-4';
			const thread = new Thread([
				{
					type: 'user_input',
					timestamp: Date.now(),
					data: 'Delete task XYZ',
				},
				{
					type: 'awaiting_approval',
					timestamp: Date.now(),
					data: {
						intent: 'delete_task',
						parameters: { task_id: 'XYZ' },
					},
				},
			]);
			await redisStore.set(conversationId, thread);

			const response = await request(app)
				.post(`/api/agent/approve/${conversationId}`)
				.send({ approved: false })
				.expect(200);

			expect(response.body).toHaveProperty('success');
			expect(response.body.success).toBe(true);

			// Verify denial event was added
			const updatedThread = await redisStore.get(conversationId);
			expect(updatedThread?.events).toHaveLength(3);
			expect(updatedThread?.events[2].type).toBe('user_input');
			expect(updatedThread?.events[2].data).toBe('denied');

			// Cleanup
			await redisStore.delete(conversationId);
		});
	});
});
