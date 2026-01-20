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
		}): Promise<{ toolCall: ToolCall | null }>;
		generateToolCallWithStreaming?(params: {
			systemPrompt: string;
			inputMessages: Array<unknown>;
			tools?: Array<unknown>;
			onToolCall?: (toolCall: ToolCall) => void;
			onTextChunk?: (chunk: string, messageId: string) => void;
		}): Promise<{ toolCall: ToolCall | null; fullText: string }>;
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

		const { toolCall } = await this.llmClient.generateToolCall({
			systemPrompt,
			inputMessages: [{ role: 'user', content: systemPrompt }],
			tools: this.tools,
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
}
