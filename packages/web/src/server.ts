import express, {
	type Express,
	type Request,
	type Response,
	type NextFunction,
} from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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

// API routes will be added here
// app.use('/api/agent', agentRouter);
// app.use('/api/stream', streamRouter);

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
