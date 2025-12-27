import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { Thread } from '@shochan_ai/core';
import { RedisStateStore } from '../state/redis-store';
import { StreamManager } from '../streaming/manager';
import { initializeStream } from './stream';

describe('Stream Route', () => {
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

		const streamRouter = initializeStream(redisStore, streamManager);
		app.use('/api/stream', streamRouter);
	});

	afterAll(async () => {
		await redisStore.disconnect();
		streamManager.closeAll();
	});

	describe('GET /api/stream/:conversationId', () => {
		it('should return 404 when conversation does not exist', async () => {
			const response = await request(app)
				.get('/api/stream/non-existent-id')
				.expect(404);

			expect(response.body).toHaveProperty('error');
			expect(response.body.error).toBe('Conversation not found');
		});

		// Note: Full SSE connection testing is covered in Phase 4.8 integration tests
		// SSE connections are long-lived and difficult to test with supertest
	});
});
