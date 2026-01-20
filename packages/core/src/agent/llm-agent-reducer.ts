import { Thread } from '../thread/thread';
import type { Event, ToolCallEvent } from '../types/event';
import type { ToolCall } from '../types/tools';
import type { AgentReducer } from './agent-reducer';

/**
 * AgentReducer implementation that uses an LLM to determine next tool calls.
 * Generic LLM client interface supports OpenAI, Anthropic, etc.
 */
export class LLMAgentReducer<
	TLLMClient extends {
		generateToolCall(params: {
			systemPrompt: string;
			inputMessages: Array<unknown>;
			tools?: Array<unknown>;
		}): Promise<{ toolCall: ToolCall | null; fullOutput?: Array<unknown> }>;
		generateToolCallWithStreaming?(params: {
			systemPrompt: string;
			inputMessages: Array<unknown>;
			tools?: Array<unknown>;
			onToolCall?: (toolCall: ToolCall) => void;
			onTextChunk?: (chunk: string, messageId: string) => void;
		}): Promise<{ toolCall: ToolCall | null; fullText: string }>;
		generateTextWithStreaming?(params: {
			systemPrompt: string;
			inputMessages: Array<unknown>;
			onTextChunk?: (chunk: string, messageId: string) => void;
		}): Promise<string>;
	},
	TTools extends Array<unknown>,
> implements AgentReducer<Thread, Event>
{
	constructor(
		private readonly llmClient: TLLMClient,
		private readonly tools: TTools,
		private readonly systemPromptBuilder: (threadContext: string) => string,
	) {}

	/**
	 * Adds the event to thread state. Pure function with no side effects.
	 */
	reduce(state: Thread, event: Event): Thread {
		return new Thread([...state.events, event]);
	}

	/**
	 * Generates next tool call via LLM. Should be called by orchestrator after user input.
	 */
	async generateNextToolCall(state: Thread): Promise<ToolCallEvent | null> {
		const threadContext = state.serializeForLLM();
		const systemPrompt = this.systemPromptBuilder(threadContext);

		console.log('🔍 Generating tool call with prompt:', systemPrompt.substring(0, 200) + '...');
		console.log('🔍 Available tools:', this.tools.map((t: any) => t.name).join(', '));

		const { toolCall, fullOutput } = await this.llmClient.generateToolCall({
			systemPrompt,
			inputMessages: [{ role: 'user', content: systemPrompt }],
			tools: this.tools,
		});

		console.log('🔍 LLM response output:', JSON.stringify(fullOutput, null, 2));

		if (!toolCall) {
			console.log('⚠️  No tool call in response');
			return null;
		}

		return {
			type: 'tool_call',
			timestamp: Date.now(),
			data: toolCall,
		};
	}

	/**
	 * Generates next tool call via LLM with streaming support.
	 * Streams text tokens in real-time via callbacks.
	 *
	 * @param state - Current thread state
	 * @param onToolCall - Callback when tool call is detected
	 * @param onTextChunk - Callback for each text token
	 * @returns Tool call event or null if no tool call
	 */
	async generateNextToolCallWithStreaming(
		state: Thread,
		onToolCall?: (toolCall: ToolCall) => void,
		onTextChunk?: (chunk: string, messageId: string) => void,
	): Promise<ToolCallEvent | null> {
		if (!this.llmClient.generateToolCallWithStreaming) {
			throw new Error('LLM client does not support streaming');
		}

		const threadContext = state.serializeForLLM();
		const systemPrompt = this.systemPromptBuilder(threadContext);

		const { toolCall } = await this.llmClient.generateToolCallWithStreaming({
			systemPrompt,
			inputMessages: [{ role: 'user', content: systemPrompt }],
			tools: this.tools,
			onToolCall,
			onTextChunk,
		});

		if (!toolCall) {
			return null;
		}

		return {
			type: 'tool_call',
			timestamp: Date.now(),
			data: toolCall,
		};
	}

	/**
	 * Generate explanation text with streaming support.
	 * Used after tool execution to explain results to the user.
	 *
	 * This method uses Multi-turn approach:
	 * - Turn 1: Tool execution (already done)
	 * - Turn 2: Text generation (this method)
	 *
	 * @param state - Current thread state (including tool results)
	 * @param onTextChunk - Callback for each text token
	 * @returns Generated text
	 */
	async generateExplanationWithStreaming(
		state: Thread,
		onTextChunk?: (chunk: string, messageId: string) => void,
	): Promise<string> {
		if (!this.llmClient.generateTextWithStreaming) {
			throw new Error('LLM client does not support text streaming');
		}

		const threadContext = state.serializeForLLM();
		const systemPrompt = `Based on the conversation history and tool results below, provide a natural language explanation to the user.

${threadContext}

Explain what you did and provide a helpful response. Be conversational and respond in the same language the user used.`;

		return await this.llmClient.generateTextWithStreaming({
			systemPrompt,
			inputMessages: [{ role: 'user', content: systemPrompt }],
			onTextChunk,
		});
	}
}
