import dotenv from 'dotenv';
import app from './app';
import { registerFallbackHandlers } from './middleware/fallback-handlers';
import { RedisStateStore } from './state/redis-store';
import { StreamManager } from './streaming/manager';
import { initializeAgent } from './routes/agent';
import { initializeStream } from './routes/stream';

dotenv.config({ path: '../../.env' });

const PORT = process.env.PORT || 3001;

/**
 * Initialize server dependencies and routes.
 * Connects to Redis, registers API routes, and sets up fallback handlers.
 */
async function setupServer(): Promise<void> {
	const redisStore = new RedisStateStore(
		process.env.REDIS_URL || 'redis://localhost:6379',
	);
	const streamManager = new StreamManager();

	await redisStore.connect();
	console.log('✅ Connected to Redis');

	const agentRouter = await initializeAgent(redisStore, streamManager);
	const streamRouter = initializeStream(redisStore, streamManager);

	app.use('/api/agent', agentRouter);
	app.use('/api/stream', streamRouter);

	registerFallbackHandlers(app);

	console.log('✅ Routes initialized');
}

// Setup server and start listening
if (process.env.NODE_ENV !== 'test') {
	setupServer()
		.then(() => {
			app.listen(PORT, () => {
				console.log(
					`🚀 Shochan AI Web API server running on http://localhost:${PORT}`,
				);
				console.log(`📊 Health check: http://localhost:${PORT}/health`);
			});
		})
		.catch((error) => {
			console.error('Failed to setup server:', error);
			process.exit(1);
		});
}

export { setupServer };
export default app;
