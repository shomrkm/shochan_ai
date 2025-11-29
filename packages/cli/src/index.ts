#!/usr/bin/env node

import * as readline from 'readline';
import { TaskAgent } from './agent/task-agent';
import { isAwaitingApprovalEvent, isToolCallEvent, Thread, type Event } from '@shochan_ai/core';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from repository root
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

export async function cli() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: Please provide a message as a command line argument');
    process.exit(1);
  }

  const message = args.join(' ');
  const taskAgent = new TaskAgent();
  const thread = new Thread([{ type: 'user_input', timestamp: Date.now(), data: message }]);

  let newThread = await taskAgent.agetnLoop(thread);
  let lastEvent = newThread.events.slice(-1)[0];

  while (true) {
    if (thread.awaitingHumanResponse() && isAwaitingApprovalEvent(lastEvent)) {
      const humanResponse = await askHuman(lastEvent.data.parameters.message as string);
      thread.events.push(humanResponse);
      lastEvent = humanResponse;
      continue;
    }

    if (thread.awaitingHumanApproval() && (await askHumanApproval()) && isToolCallEvent(lastEvent)) {
      newThread = await taskAgent.handleNextStep(lastEvent.data, newThread);
      lastEvent = newThread.events.slice(-1)[0];
      continue;
    }

    newThread = await taskAgent.agetnLoop(thread);
    lastEvent = newThread.events.slice(-1)[0];
  }
}

async function askHuman(message: string): Promise<Event> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message}\n> `, (answer) => {
      rl.close();
      resolve({
        type: 'user_input',
        timestamp: Date.now(),
        data: answer.trim(),
      });
    });
  });
}

async function askHumanApproval(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n⚠️  Confirmation');
  console.log('Are you sure you want to proceed?\n');

  return new Promise((resolve) => {
    rl.question('Continue? (yes/no): ', (answer) => {
      rl.close();
      const response = answer.trim().toLowerCase();
      resolve(response === 'yes' || response === 'y');
    });
  });
}

if (require.main === module) {
  cli().catch(console.error);
}
