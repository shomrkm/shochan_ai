import express, {
	type Express,
	type Request,
	type Response,
	type NextFunction,
} from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { RedisStateStore } from './state/redis-store';
import { StreamManager } from './streaming/manager';
import { initializeAgent } from './routes/agent';
import { initializeStream } from './routes/stream';

dotenv.config({ path: '../../.env' });

const app: Express = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req: Request, _res: Response, next: NextFunction) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
	next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize dependencies and routes
async function setupRoutes() {
	const redisStore = new RedisStateStore(process.env.REDIS_URL || 'redis://localhost:6379');
	const streamManager = new StreamManager();

	await redisStore.connect();
	console.log('✅ Connected to Redis');

	const agentRouter = await initializeAgent(redisStore, streamManager);
	const streamRouter = initializeStream(redisStore, streamManager);

	app.use('/api/agent', agentRouter);
	app.use('/api/stream', streamRouter);

	console.log('✅ Routes initialized');
}

// Setup routes if not in test environment
if (process.env.NODE_ENV !== 'test') {
	setupRoutes().catch((error) => {
		console.error('Failed to setup routes:', error);
		process.exit(1);
	});
}

// 404 handler
app.use((_req: Request, res: Response) => {
	res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
	console.error('Server error:', err);
	res.status(500).json({
		error: 'Internal Server Error',
		message: process.env.NODE_ENV === 'development' ? err.message : undefined,
	});
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
	app.listen(PORT, () => {
		console.log(
			`🚀 Shochan AI Web API server running on http://localhost:${PORT}`,
		);
		console.log(`📊 Health check: http://localhost:${PORT}/health`);
	});
}

export default app;
