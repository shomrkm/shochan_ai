import { describe, it, expect } from 'vitest';
import request from 'supertest';

// Set NODE_ENV before importing app
process.env.NODE_ENV = 'test';
import app from './server';

describe('Express Server', () => {

	describe('GET /health', () => {
		it('should return 200 with status ok', async () => {
			const response = await request(app).get('/health');

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('status', 'ok');
			expect(response.body).toHaveProperty('timestamp');
		});

		it('should return valid timestamp', async () => {
			const response = await request(app).get('/health');

			const timestamp = new Date(response.body.timestamp);
			expect(timestamp.getTime()).toBeGreaterThan(0);
		});
	});

	describe('404 handler', () => {
		it('should return 404 for non-existent routes', async () => {
			const response = await request(app).get('/non-existent-route');

			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('error', 'Not Found');
		});

		it('should return 404 for POST to non-existent routes', async () => {
			const response = await request(app).post('/non-existent-route');

			expect(response.status).toBe(404);
			expect(response.body).toHaveProperty('error', 'Not Found');
		});
	});

	describe('CORS', () => {
		it('should have CORS headers', async () => {
			const response = await request(app)
				.get('/health')
				.set('Origin', 'http://localhost:3000');

			expect(response.headers).toHaveProperty('access-control-allow-origin');
		});
	});

	describe('JSON parsing', () => {
		it('should parse JSON request body', async () => {
			// This will fail until we add a POST endpoint, but verifies middleware is set up
			const response = await request(app)
				.post('/health')
				.send({ test: 'data' })
				.set('Content-Type', 'application/json');

			// Should get 404 (no POST handler for /health) not 400 (JSON parse error)
			expect(response.status).toBe(404);
		});
	});
});
