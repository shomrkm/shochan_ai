import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMAgentReducer } from './llm-agent-reducer';
import { Thread } from '../thread/thread';
import type { UserInputEvent } from '../types/event';
import type { ToolCall } from '../types/tools';

describe('LLMAgentReducer', () => {
	describe('generateNextToolCall', () => {
		it('should generate tool call successfully', async () => {
			const mockToolCall: ToolCall = {
				intent: 'create_task',
				parameters: { title: 'Test Task' },
			};

			const mockLLMClient = {
				generateToolCall: vi.fn().mockResolvedValue({
					toolCall: mockToolCall,
					fullOutput: [],
				}),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			const result = await reducer.generateNextToolCall(thread);

			expect(result).toBeDefined();
			expect(result?.type).toBe('tool_call');
			expect(result?.data).toEqual(mockToolCall);
			expect(mockLLMClient.generateToolCall).toHaveBeenCalledOnce();
		});

		it('should return null when no tool call is generated', async () => {
			const mockLLMClient = {
				generateToolCall: vi.fn().mockResolvedValue({
					toolCall: null,
					fullOutput: [],
				}),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Just chatting',
			};
			const thread = new Thread([userInputEvent]);

			const result = await reducer.generateNextToolCall(thread);

			expect(result).toBeNull();
		});

		it('should throw error when LLM call fails', async () => {
			const mockError = new Error('API connection failed');
			const mockLLMClient = {
				generateToolCall: vi.fn().mockRejectedValue(mockError),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			await expect(reducer.generateNextToolCall(thread)).rejects.toThrow(
				'Tool call generation failed: API connection failed',
			);
		});

		it('should handle non-Error exceptions', async () => {
			const mockLLMClient = {
				generateToolCall: vi.fn().mockRejectedValue('String error'),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			await expect(reducer.generateNextToolCall(thread)).rejects.toThrow(
				'Tool call generation failed: String error',
			);
		});
	});

	describe('generateNextToolCallWithStreaming', () => {
		it('should throw error when LLM client does not support streaming', async () => {
			const mockLLMClient = {
				generateToolCall: vi.fn().mockResolvedValue({
					toolCall: null,
					fullOutput: [],
				}),
				// generateToolCallWithStreaming is not defined
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			await expect(
				reducer.generateNextToolCallWithStreaming(thread),
			).rejects.toThrow('LLM client does not support streaming');
		});

		it('should handle streaming errors gracefully', async () => {
			const mockError = new Error('Streaming failed');
			const mockLLMClient = {
				generateToolCall: vi.fn(),
				generateToolCallWithStreaming: vi.fn().mockRejectedValue(mockError),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			await expect(
				reducer.generateNextToolCallWithStreaming(thread),
			).rejects.toThrow('Streaming tool call generation failed: Streaming failed');
		});
	});

	describe('generateExplanationWithStreaming', () => {
		it('should throw error when LLM client does not support text streaming', async () => {
			const mockLLMClient = {
				generateToolCall: vi.fn().mockResolvedValue({
					toolCall: null,
					fullOutput: [],
				}),
				// generateTextWithStreaming is not defined
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			await expect(
				reducer.generateExplanationWithStreaming(thread),
			).rejects.toThrow('LLM client does not support text streaming');
		});

		it('should generate explanation successfully', async () => {
			const mockLLMClient = {
				generateToolCall: vi.fn(),
				generateTextWithStreaming: vi
					.fn()
					.mockResolvedValue('Task created successfully'),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			const result = await reducer.generateExplanationWithStreaming(thread);

			expect(result).toBe('Task created successfully');
			expect(mockLLMClient.generateTextWithStreaming).toHaveBeenCalledOnce();
		});

		it('should call onTextChunk callback for each chunk', async () => {
			const chunks = ['Task ', 'created ', 'successfully'];
			const mockLLMClient = {
				generateToolCall: vi.fn(),
				generateTextWithStreaming: vi.fn().mockImplementation(({ onTextChunk }) => {
					const messageId = 'test-message-id';
					for (const chunk of chunks) {
						onTextChunk?.(chunk, messageId);
					}
					return Promise.resolve(chunks.join(''));
				}),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			const onTextChunk = vi.fn();
			await reducer.generateExplanationWithStreaming(thread, onTextChunk);

			expect(onTextChunk).toHaveBeenCalledTimes(3);
			expect(onTextChunk).toHaveBeenNthCalledWith(
				1,
				'Task ',
				expect.any(String),
			);
			expect(onTextChunk).toHaveBeenNthCalledWith(
				2,
				'created ',
				expect.any(String),
			);
			expect(onTextChunk).toHaveBeenNthCalledWith(
				3,
				'successfully',
				expect.any(String),
			);
		});

		it('should handle streaming errors gracefully', async () => {
			const mockError = new Error('Network timeout');
			const mockLLMClient = {
				generateToolCall: vi.fn(),
				generateTextWithStreaming: vi.fn().mockRejectedValue(mockError),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			await expect(
				reducer.generateExplanationWithStreaming(thread),
			).rejects.toThrow(
				'Streaming explanation generation failed: Network timeout',
			);
		});

		it('should handle non-Error exceptions in streaming', async () => {
			const mockLLMClient = {
				generateToolCall: vi.fn(),
				generateTextWithStreaming: vi
					.fn()
					.mockRejectedValue('Unexpected error'),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([userInputEvent]);

			await expect(
				reducer.generateExplanationWithStreaming(thread),
			).rejects.toThrow(
				'Streaming explanation generation failed: Unexpected error',
			);
		});
	});

	describe('reduce', () => {
		it('should add event to thread', () => {
			const mockLLMClient = {
				generateToolCall: vi.fn(),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([]);

			const newThread = reducer.reduce(thread, userInputEvent);

			expect(newThread.events).toHaveLength(1);
			expect(newThread.events[0]).toEqual(userInputEvent);
		});

		it('should not modify original thread', () => {
			const mockLLMClient = {
				generateToolCall: vi.fn(),
			};

			const mockTools = [{ name: 'create_task' }];
			const mockSystemPromptBuilder = (context: string) =>
				`System prompt: ${context}`;

			const reducer = new LLMAgentReducer(
				mockLLMClient,
				mockTools,
				mockSystemPromptBuilder,
			);

			const userInputEvent: UserInputEvent = {
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			};
			const thread = new Thread([]);

			const newThread = reducer.reduce(thread, userInputEvent);

			expect(thread.events).toHaveLength(0);
			expect(newThread.events).toHaveLength(1);
			expect(newThread).not.toBe(thread);
		});
	});
});

