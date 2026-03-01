import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';

/**
 * Create and configure the Express application.
 * Sets up base middleware (CORS, JSON parsing, logging) and health endpoint.
 *
 * @returns Configured Express application
 */
export function createApp(): Express {
  const app: Express = express();

  // Base middleware
  app.use(cors());
  app.use(express.json());

  // Request logging middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

// Create default app instance for backward compatibility
const app = createApp();

export default app;
