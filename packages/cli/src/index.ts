#!/usr/bin/env node

import * as readline from 'readline';
import {
	Thread,
	LLMAgentReducer,
	NotionToolExecutor,
	AgentOrchestrator,
	InMemoryStateStore,
	builPrompt,
	taskAgentTools,
	type Event,
	type ToolCallEvent,
} from '@shochan_ai/core';
import { OpenAIClient, NotionClient } from '@shochan_ai/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

export async function cli() {
	const args = process.argv.slice(2);

	// Initialize clients
	const openaiClient = new OpenAIClient();
	const notionClient = new NotionClient();

	// Initialize components
	const initialThread = new Thread([]);
	const reducer = new LLMAgentReducer(openaiClient, taskAgentTools, builPrompt);
	const executor = new NotionToolExecutor(notionClient);
	const stateStore = new InMemoryStateStore<Thread>(initialThread);

	const orchestrator = new AgentOrchestrator(reducer, executor, stateStore);

	// Process initial message if provided
	if (args.length > 0) {
		const message = args.join(' ');
		const userInputEvent: Event = {
			type: 'user_input',
			timestamp: Date.now(),
			data: message,
		};
		await agentLoop(orchestrator, reducer, userInputEvent);
	}

	// Start interactive REPL mode
	await startInteractiveMode(orchestrator, reducer);
}

/**
 * Interactive REPL mode - continuously prompts user for input
 */
async function startInteractiveMode(
	orchestrator: AgentOrchestrator,
	reducer: LLMAgentReducer<OpenAIClient, typeof taskAgentTools>,
): Promise<void> {
	console.log('\n💬 Interactive mode started. Type your message (Ctrl+C to exit)\n');

	while (true) {
		const userInputEvent = await askHuman('');

		// Exit on empty input
		if (typeof userInputEvent.data !== 'string' || userInputEvent.data.trim() === '') {
			continue;
		}

		await agentLoop(orchestrator, reducer, userInputEvent);
	}
}

async function agentLoop(
	orchestrator: AgentOrchestrator,
	reducer: LLMAgentReducer<OpenAIClient, typeof taskAgentTools>,
	userInputEvent: Event,
): Promise<void> {
	let currentThread = await orchestrator.processEvent(userInputEvent);

	while (true) {
		const toolCallEvent = await generateToolCall(orchestrator, reducer, currentThread);
		if (!toolCallEvent || toolCallEvent.shouldExit) break;

		const shouldContinue = await handleToolCall(
			toolCallEvent.event,
			orchestrator,
		);

		if (!shouldContinue.continue) break;
		if (shouldContinue.newThread) {
			currentThread = shouldContinue.newThread;
		}
	}
}

async function generateToolCall(
	orchestrator: AgentOrchestrator,
	reducer: LLMAgentReducer<OpenAIClient, typeof taskAgentTools>,
	currentThread: Thread,
): Promise<{ event: ToolCallEvent; thread: Thread; shouldExit: false } | { thread: Thread; shouldExit: true } | null> {
	try {
		const toolCallEvent = await reducer.generateNextToolCall(currentThread);
		
		if (!toolCallEvent) {
			console.log('\n✅ Agent finished without tool call');
			return null;
		}

		console.log(`\n🔧 Tool call: ${toolCallEvent.data.intent}`);
		return { event: toolCallEvent, thread: currentThread, shouldExit: false };
	} catch (error) {
		console.error(`\n❌ Error generating tool call: ${error instanceof Error ? error.message : String(error)}`);
		const errorEvent: Event = {
			type: 'error',
			timestamp: Date.now(),
			data: {
				error: error instanceof Error ? error.message : String(error),
				code: 'LLM_TOOL_CALL_GENERATION_FAILED',
			},
		};
		const updatedThread = await orchestrator.processEvent(errorEvent);
		return { thread: updatedThread, shouldExit: true };
	}
}

async function handleToolCall(
	toolCallEvent: ToolCallEvent,
	orchestrator: AgentOrchestrator,
): Promise<{ continue: boolean; newThread?: Thread }> {
	const toolCall = toolCallEvent.data;

	// Handle approval-required tools
	if (toolCall.intent === 'delete_task') {
		const approved = await askHumanApproval(toolCall);
		if (!approved) {
			console.log('❌ Operation cancelled by user');
			return { continue: false };
		}
	}

	// Handle terminal tools
	if (toolCall.intent === 'done_for_now') {
		console.log(`\n💬 Done for now`);
		return { continue: false };
	}

	// Handle request for more information
	if (toolCall.intent === 'request_more_information') {
		console.log(`\n💬 Need more information`);
		const humanResponseEvent = await askHuman('');
		await orchestrator.processEvent(humanResponseEvent);
		return { continue: true };
	}

	// Execute tool and handle result
	const newThread = await orchestrator.executeToolCall(toolCallEvent);
	const lastEvent = newThread.latestEvent;
  if (!lastEvent) {
    console.error('❌ No event found in the thread');
    return { continue: false };
  }

	if (lastEvent.type === 'tool_response') {
		console.log('✅ Tool executed successfully');
		return { continue: true, newThread };
	} else if (lastEvent.type === 'error') {
		console.error(`❌ Error: ${lastEvent.data.error}`);
		return { continue: false };
	}

	return { continue: true, newThread };
}

async function askHuman(message: string): Promise<Event> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(`\n${message}\n> `, (answer) => {
			rl.close();
			resolve({
				type: 'user_input',
				timestamp: Date.now(),
				data: answer.trim(),
			});
		});
	});
}

async function askHumanApproval(toolCall: ToolCallEvent['data']): Promise<boolean> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log('\n⚠️  Confirmation Required');
	console.log(`Tool: ${toolCall.intent}`);
	console.log(`Parameters: ${JSON.stringify(toolCall.parameters, null, 2)}`);

	return new Promise((resolve) => {
		rl.question('\nContinue? (yes/no): ', (answer) => {
			rl.close();
			const response = answer.trim().toLowerCase();
			resolve(response === 'yes' || response === 'y');
		});
	});
}

if (require.main === module) {
	cli().catch(console.error);
}
