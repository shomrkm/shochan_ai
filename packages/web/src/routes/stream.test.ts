import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { Thread } from '@shochan_ai/core';
import { RedisStateStore } from '../state/redis-store';
import { StreamManager } from '../streaming/manager';
import { createStreamRouter, type StreamDependencies } from './stream';

describe('Stream Route', () => {
	let app: Express;
	let redisStore: RedisStateStore;
	let streamManager: StreamManager;

	beforeAll(async () => {
		app = express();
		app.use(express.json());

		// Use unique key prefix for this test file to enable parallel execution
		redisStore = new RedisStateStore(
			process.env.REDIS_URL || 'redis://localhost:6379',
			'test:stream-routes:',
		);
		streamManager = new StreamManager();

		await redisStore.connect();

		// Create dependencies using factory function pattern
		const deps: StreamDependencies = {
			redisStore,
			streamManager,
		};

		const streamRouter = createStreamRouter(deps);
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
	});
});
