import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { Thread, ToolCallEvent } from '@shochan_ai/core';
import { RedisStateStore } from '../state/redis-store';
import { StreamManager } from '../streaming/manager';
import { createAgentRouter, type AgentDependencies } from './agent';

// Mock for generateNextToolCall
const mockGenerateNextToolCall = vi.fn().mockResolvedValue(null);

// Mock executor
const mockExecute = vi.fn();

describe('Agent Routes', () => {
	let app: Express;
	let redisStore: RedisStateStore;
	let streamManager: StreamManager;

	beforeAll(async () => {
		app = express();
		app.use(express.json());

		// Use unique key prefix for this test file to enable parallel execution
		redisStore = new RedisStateStore(
			process.env.REDIS_URL || 'redis://localhost:6379',
			'test:agent-routes:',
		);
		streamManager = new StreamManager();

		await redisStore.connect();

		// Create dependencies with mocks - enables easy testing
		const deps: AgentDependencies = {
			redisStore,
			streamManager,
			reducer: {
				generateNextToolCall: mockGenerateNextToolCall,
				reduce: (state: Thread, event: unknown) =>
					new Thread([...state.events, event as any]),
			} as unknown as AgentDependencies['reducer'],
			executor: {
				execute: mockExecute,
			} as unknown as AgentDependencies['executor'],
		};

		const agentRouter = createAgentRouter(deps);
		app.use('/api/agent', agentRouter);
	});

	afterAll(async () => {
		await redisStore.disconnect();
	});

	afterEach(async () => {
		mockGenerateNextToolCall.mockReset();
		mockGenerateNextToolCall.mockResolvedValue(null);
		mockExecute.mockReset();
	});

	describe('POST /api/agent/query', () => {
		it('should return conversationId when valid message is provided', async () => {
			// Explicitly set mock to return null for this test
			mockGenerateNextToolCall.mockResolvedValueOnce(null);
			
			const response = await request(app)
				.post('/api/agent/query')
				.send({ message: 'Test message' })
				.expect(200);

			expect(response.body).toHaveProperty('conversationId');
			expect(typeof response.body.conversationId).toBe('string');
			expect(response.body.conversationId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
			
			// Wait for background processAgent to complete before checking
			// processAgent has 2000ms SSE connection timeout + processing time
			await new Promise((resolve) => setTimeout(resolve, 2500));
			
			const thread = await redisStore.get(response.body.conversationId);
			expect(thread).toBeDefined();
			expect(thread?.events).toHaveLength(1);
			expect(thread?.events[0].type).toBe('user_input');
			expect(thread?.events[0].data).toBe('Test message');
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

		/**
		 * Test: awaiting_approval event persistence for delete_task
		 *
		 * Requirements:
		 * - awaiting_approval event must be added to Thread
		 * - awaiting_approval event must be saved to Redis
		 * - approval endpoint must be able to find the awaiting_approval event
		 */
		it('should persist awaiting_approval event when delete_task is generated', async () => {
			mockGenerateNextToolCall.mockResolvedValueOnce({
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'delete_task',
					parameters: { task_id: 'TEST_TASK_123' },
				},
			});

			const response = await request(app)
				.post('/api/agent/query')
				.send({ message: 'Delete TEST_TASK_123' })
				.expect(200);

			const conversationId = response.body.conversationId;

			// Wait for processAgent to complete
			// processAgent has 2000ms SSE connection timeout + processing time
			await new Promise((resolve) => setTimeout(resolve, 2500));

			const thread = await redisStore.get(conversationId);
			expect(thread).toBeDefined();
			expect(thread?.events.length).toBe(3);
			// Expected event sequence:
			// 1. user_input: "Delete TEST_TASK_123"
			// 2. tool_call: delete_task
			// 3. awaiting_approval: delete_task
			expect(thread?.events[thread?.events.length - 3].type).toBe('user_input');
			expect(thread?.events[thread?.events.length - 2].type).toBe('tool_call');
			expect(thread?.latestEvent?.type).toBe('awaiting_approval');
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
		});

		it('should return 400 when no pending approval', async () => {
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
		});

    it('should handle approval correctly', async () => {
      mockGenerateNextToolCall.mockResolvedValue(null);
      mockExecute.mockResolvedValueOnce({
        event: {
          type: 'tool_response',
          timestamp: Date.now(),
          data: {
            intent: 'delete_task',
            parameters: { task_id: 'XYZ' },
          },
        },
      });
      const conversationId = 'test-conversation-id-3';
      const thread = new Thread([
        {
          type: 'user_input',
          timestamp: Date.now(),
          data: 'Delete task XYZ',
        },
        {
          type: 'tool_call',
          timestamp: Date.now(),
          data: {
            intent: 'delete_task',
            parameters: { task_id: 'XYZ' },
          },
        } as ToolCallEvent,
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
        .send({ approved: true })
        .expect(200);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedThread = await redisStore.get(conversationId);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(updatedThread?.events.length).toBe(5);
      expect(updatedThread?.events[updatedThread?.events.length -2]).toEqual({
        type: 'user_input',
        timestamp: expect.any(Number),
        data: 'approved',
      });
      expect(updatedThread?.latestEvent).toEqual({
        type: 'tool_response',
        timestamp: expect.any(Number),
        data: {
          intent: 'delete_task',
          parameters: { task_id: 'XYZ' },
        },
      });
    });

		it('should handle denial correctly', async () => {
			mockGenerateNextToolCall.mockResolvedValue(null);
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
			await new Promise((resolve) => setTimeout(resolve, 100));

			const updatedThread = await redisStore.get(conversationId);
			expect(response.body).toHaveProperty('success');
			expect(response.body.success).toBe(true);
			expect(updatedThread?.events).toHaveLength(3);
			expect(updatedThread?.events[2].type).toBe('user_input');
			expect(updatedThread?.events[2].data).toBe('denied');
		});
	});
});
