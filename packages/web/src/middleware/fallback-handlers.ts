import type { Express, Request, Response, NextFunction } from 'express';

/**
 * Register 404 and error handlers on the Express app.
 * Must be called AFTER all routes are registered.
 *
 * @param app - Express application instance
 */
export function registerFallbackHandlers(app: Express): void {
	// 404 handler - must be registered AFTER routes
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
}

