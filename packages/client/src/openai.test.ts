import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIClient } from './openai';

// Mock OpenAI SDK
vi.mock('openai', () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			responses: {
				create: vi.fn(),
			},
		})),
	};
});

describe('OpenAIClient', () => {
	describe('generateTextWithStreaming', () => {
		it('should stream text chunks successfully', async () => {
			const mockStream = [
				{ type: 'response.output_text.delta', delta: 'Hello ' },
				{ type: 'response.output_text.delta', delta: 'world' },
				{ type: 'response.output_text.delta', delta: '!' },
			];

			const mockCreate = vi.fn().mockImplementation(async function* () {
				for (const event of mockStream) {
					yield event;
				}
			});

			const client = new OpenAIClient('test-api-key');
			// @ts-expect-error - accessing private property for testing
			client.client.responses.create = mockCreate;

			const chunks: string[] = [];
			const onTextChunk = vi.fn((chunk: string) => {
				chunks.push(chunk);
			});

			const result = await client.generateTextWithStreaming({
				systemPrompt: 'Test prompt',
				inputMessages: [{ role: 'user', content: 'Hello' }],
				onTextChunk,
			});

			expect(result).toBe('Hello world!');
			expect(onTextChunk).toHaveBeenCalledTimes(3);
			expect(chunks).toEqual(['Hello ', 'world', '!']);
		});

		it('should handle empty text generation with warning', async () => {
			const mockStream: never[] = [];

			const mockCreate = vi.fn().mockImplementation(async function* () {
				for (const event of mockStream) {
					yield event;
				}
			});

			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const client = new OpenAIClient('test-api-key');
			// @ts-expect-error - accessing private property for testing
			client.client.responses.create = mockCreate;

			const result = await client.generateTextWithStreaming({
				systemPrompt: 'Test prompt',
				inputMessages: [{ role: 'user', content: 'Hello' }],
			});

			expect(result).toBe('');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'⚠️  OpenAI streaming completed but no text was generated',
			);

			consoleWarnSpy.mockRestore();
		});

		it('should handle API error events', async () => {
			const mockStream = [
				{ type: 'response.output_text.delta', delta: 'Hello ' },
				{
					type: 'error',
					error: { message: 'Rate limit exceeded', code: 'rate_limit' },
				},
			];

			const mockCreate = vi.fn().mockImplementation(async function* () {
				for (const event of mockStream) {
					yield event;
				}
			});

			const client = new OpenAIClient('test-api-key');
			// @ts-expect-error - accessing private property for testing
			client.client.responses.create = mockCreate;

			await expect(
				client.generateTextWithStreaming({
					systemPrompt: 'Test prompt',
					inputMessages: [{ role: 'user', content: 'Hello' }],
				}),
			).rejects.toThrow('OpenAI streaming error');
		});

		it('should handle streaming connection errors', async () => {
			const mockError = new Error('Network connection failed');
			const mockCreate = vi.fn().mockRejectedValue(mockError);

			const client = new OpenAIClient('test-api-key');
			// @ts-expect-error - accessing private property for testing
			client.client.responses.create = mockCreate;

			await expect(
				client.generateTextWithStreaming({
					systemPrompt: 'Test prompt',
					inputMessages: [{ role: 'user', content: 'Hello' }],
				}),
			).rejects.toThrow(
				'Failed to generate text with streaming: Network connection failed',
			);
		});

		it('should handle non-Error exceptions', async () => {
			const mockCreate = vi.fn().mockRejectedValue('Unexpected error');

			const client = new OpenAIClient('test-api-key');
			// @ts-expect-error - accessing private property for testing
			client.client.responses.create = mockCreate;

			await expect(
				client.generateTextWithStreaming({
					systemPrompt: 'Test prompt',
					inputMessages: [{ role: 'user', content: 'Hello' }],
				}),
			).rejects.toThrow(
				'Failed to generate text with streaming: Unexpected error',
			);
		});

		it('should call onTextChunk callback with messageId', async () => {
			const mockStream = [
				{ type: 'response.output_text.delta', delta: 'Test' },
			];

			const mockCreate = vi.fn().mockImplementation(async function* () {
				for (const event of mockStream) {
					yield event;
				}
			});

			const client = new OpenAIClient('test-api-key');
			// @ts-expect-error - accessing private property for testing
			client.client.responses.create = mockCreate;

			const onTextChunk = vi.fn();

			await client.generateTextWithStreaming({
				systemPrompt: 'Test prompt',
				inputMessages: [{ role: 'user', content: 'Hello' }],
				onTextChunk,
			});

			expect(onTextChunk).toHaveBeenCalledWith('Test', expect.any(String));
			
			// Verify messageId is a valid UUID
			const messageId = onTextChunk.mock.calls[0][1];
			expect(messageId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
		});

		it('should use same messageId for all chunks in one stream', async () => {
			const mockStream = [
				{ type: 'response.output_text.delta', delta: 'First ' },
				{ type: 'response.output_text.delta', delta: 'Second' },
			];

			const mockCreate = vi.fn().mockImplementation(async function* () {
				for (const event of mockStream) {
					yield event;
				}
			});

			const client = new OpenAIClient('test-api-key');
			// @ts-expect-error - accessing private property for testing
			client.client.responses.create = mockCreate;

			const onTextChunk = vi.fn();

			await client.generateTextWithStreaming({
				systemPrompt: 'Test prompt',
				inputMessages: [{ role: 'user', content: 'Hello' }],
				onTextChunk,
			});

			expect(onTextChunk).toHaveBeenCalledTimes(2);
			
			const messageId1 = onTextChunk.mock.calls[0][1];
			const messageId2 = onTextChunk.mock.calls[1][1];
			
			// Both chunks should have the same messageId
			expect(messageId1).toBe(messageId2);
		});

		it('should handle streaming interruption gracefully', async () => {
			const mockStream = [
				{ type: 'response.output_text.delta', delta: 'Start ' },
			];

			const mockCreate = vi.fn().mockImplementation(async function* () {
				for (const event of mockStream) {
					yield event;
				}
				throw new Error('Stream interrupted');
			});

			const client = new OpenAIClient('test-api-key');
			// @ts-expect-error - accessing private property for testing
			client.client.responses.create = mockCreate;

			await expect(
				client.generateTextWithStreaming({
					systemPrompt: 'Test prompt',
					inputMessages: [{ role: 'user', content: 'Hello' }],
				}),
			).rejects.toThrow(
				'Failed to generate text with streaming: Stream interrupted',
			);
		});
	});
});

