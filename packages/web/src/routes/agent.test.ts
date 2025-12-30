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

		redisStore = new RedisStateStore(
			process.env.REDIS_URL || 'redis://localhost:6379',
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

	afterEach(() => {
		// Reset all mocks after each test to ensure test isolation
		mockGenerateNextToolCall.mockReset();
		mockExecute.mockReset();
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

		/**
		 * Test: awaiting_approval event persistence for delete_task
		 *
		 * Requirements:
		 * - awaiting_approval event must be added to Thread
		 * - awaiting_approval event must be saved to Redis
		 * - approval endpoint must be able to find the awaiting_approval event
		 */
		it('should persist awaiting_approval event when delete_task is generated', async () => {
			// Configure mock to return delete_task
			mockGenerateNextToolCall.mockResolvedValueOnce({
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'delete_task',
					parameters: { task_id: 'TEST_TASK_123' },
				},
			});

			// Create initial conversation with delete request
			const response = await request(app)
				.post('/api/agent/query')
				.send({ message: 'Delete TEST_TASK_123' })
				.expect(200);

			const conversationId = response.body.conversationId;

			// Wait for processAgent to run
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify awaiting_approval event was saved to Redis
			const thread = await redisStore.get(conversationId);
			expect(thread).toBeDefined();

			// Expected event sequence:
			// 1. user_input: "Delete TEST_TASK_123"
			// 2. tool_call: delete_task
			// 3. awaiting_approval: delete_task
      expect(thread?.events[0].type).toBe('user_input');
      expect(thread?.events[1].type).toBe('tool_call');
			expect(thread?.latestEvent?.type).toBe('awaiting_approval');

			// Cleanup
			await redisStore.delete(conversationId);
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

    it('should handle approval correctly', async () => {
      // Configure mock to return null when called after approval (processAgent should finish)
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

      // Create a test conversation with awaiting_approval event
      // Note: In real flow, there would be a tool_call event before awaiting_approval,
      // but for this test we only need awaiting_approval to test the approval flow
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

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);

      // Wait for processAgent to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify approval event was added
      const updatedThread = await redisStore.get(conversationId);
      if (!updatedThread) {
        throw new Error('Thread not found in Redis after approval');
      }

      // Expected events: user_input, tool_call, awaiting_approval, user_input (approved), tool_response
      expect(updatedThread.events.length).toBe(5);
      expect(updatedThread.events[updatedThread.events.length -2]).toEqual({
        type: 'user_input',
        timestamp: expect.any(Number),
        data: 'approved',
      });
      expect(updatedThread.latestEvent).toEqual({
        type: 'tool_response',
        timestamp: expect.any(Number),
        data: {
          intent: 'delete_task',
          parameters: { task_id: 'XYZ' },
        },
      });

      // Cleanup
      await redisStore.delete(conversationId);
    });

		it('should handle denial correctly', async () => {
			mockGenerateNextToolCall.mockResolvedValue(null);

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

			// Wait for processAgent to complete
			await new Promise((resolve) => setTimeout(resolve, 100));

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
