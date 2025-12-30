import dotenv from 'dotenv';
import app from './app';
import { registerFallbackHandlers } from './middleware/fallback-handlers';
import { RedisStateStore } from './state/redis-store';
import { StreamManager } from './streaming/manager';
import {
	createAgentRouter,
	type AgentDependencies,
} from './routes/agent';
import {
	createStreamRouter,
	type StreamDependencies,
} from './routes/stream';
import {
	LLMAgentReducer,
	NotionToolExecutor,
	builPrompt,
	taskAgentTools,
} from '@shochan_ai/core';
import { OpenAIClient, NotionClient } from '@shochan_ai/client';

dotenv.config({ path: '../../.env' });

const PORT = process.env.PORT || 3001;

/**
 * Initialize server dependencies and routes.
 * Creates all required instances and registers API routes.
 */
async function setupServer(): Promise<void> {
	// Create shared instances
	const redisStore = new RedisStateStore(
		process.env.REDIS_URL || 'redis://localhost:6379',
	);
	const streamManager = new StreamManager();

	await redisStore.connect();
	console.log('✅ Connected to Redis');

	// Create agent dependencies
	const openaiClient = new OpenAIClient();
	const notionClient = new NotionClient();
	const reducer = new LLMAgentReducer(openaiClient, taskAgentTools, builPrompt);
	const executor = new NotionToolExecutor(notionClient);

	const agentDeps: AgentDependencies = {
		redisStore,
		streamManager,
		reducer,
		executor,
	};

	const streamDeps: StreamDependencies = {
		redisStore,
		streamManager,
	};

	// Create and register routers using factory functions
	const agentRouter = createAgentRouter(agentDeps);
	const streamRouter = createStreamRouter(streamDeps);

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
