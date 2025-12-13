#!/usr/bin/env node

import * as readline from 'readline';
import {
	Thread,
	LLMAgentReducer,
	NotionToolExecutor,
	AgentOrchestrator,
	InMemoryStateStore,
	builPrompt,
	type Event,
	type ToolCallEvent,
	isToolCallEvent,
} from '@shochan_ai/core';
import { OpenAIClient, NotionClient } from '@shochan_ai/client';
import { taskAgentTools } from './agent/task-agent-tools';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

export async function cli() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error('Error: Please provide a message as a command line argument');
		process.exit(1);
	}

	const message = args.join(' ');

	// Initialize clients
	const openaiClient = new OpenAIClient();
	const notionClient = new NotionClient();

	// Initialize components
	const initialThread = new Thread([]);
	const reducer = new LLMAgentReducer(openaiClient, taskAgentTools, builPrompt);
	const executor = new NotionToolExecutor(notionClient);
	const stateStore = new InMemoryStateStore<Thread>(initialThread);

	const orchestrator = new AgentOrchestrator(reducer, executor, stateStore);

	// Process initial user input
	const userInputEvent: Event = {
		type: 'user_input',
		timestamp: Date.now(),
		data: message,
	};

	await processUserInput(orchestrator, reducer, userInputEvent);
}

async function processUserInput(
	orchestrator: AgentOrchestrator,
	reducer: LLMAgentReducer<OpenAIClient, typeof taskAgentTools>,
	userInputEvent: Event,
): Promise<void> {
	// Add user input to thread
	let currentThread = await orchestrator.processEvent(userInputEvent);

	// Agent loop: LLM → Tool Execution → LLM
	while (true) {
		// Generate next tool call via LLM
		const toolCallEvent = await reducer.generateNextToolCall(currentThread);

		if (!toolCallEvent) {
			console.log('\n✅ Agent finished without tool call');
			break;
		}

		const toolCall = toolCallEvent.data;
		console.log(`\n🔧 Tool call: ${toolCall.intent}`);

		// Check if this tool requires approval
		if (toolCall.intent === 'delete_task') {
			const approved = await askHumanApproval(toolCall);
			if (!approved) {
				console.log('❌ Operation cancelled by user');
				break;
			}
		}

		// Check if this is done_for_now (terminal)
		if (toolCall.intent === 'done_for_now') {
			console.log(`\n💬 ${toolCall.parameters.message}`);
			break;
		}

		// Check if this is request_more_information (needs user input, then continue)
		if (toolCall.intent === 'request_more_information') {
			console.log(`\n💬 ${toolCall.parameters.message}`);
			const humanResponse = await askHuman('');
			await processUserInput(orchestrator, reducer, humanResponse);
			break; // Exit current loop, recursion handles the rest
		}

		// Execute tool call
		currentThread = await orchestrator.executeToolCall(toolCallEvent);

		// Log the result
		const lastEvent = currentThread.events[currentThread.events.length - 1];
		if (lastEvent.type === 'tool_response') {
			console.log('✅ Tool executed successfully');
		} else if (lastEvent.type === 'error') {
			console.error(`❌ Error: ${lastEvent.data.error}`);
			break;
		}
	}
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
