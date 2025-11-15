import * as readline from 'readline';
import { TaskAgent } from './agent/task-agent';
import { Thread, type Event } from './thread/thread';
import dotenv from 'dotenv';

dotenv.config();

export async function cli() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: Please provide a message as a command line argument');
    process.exit(1);
  }

  const message = args.join(' ');
  const taskAgent = new TaskAgent();
  const thread = new Thread([{ type: 'user_input', data: message }]);

  let newThread = await taskAgent.agetnLoop(thread);
  let lastEvent = newThread.events.slice(-1)[0];

  while (true) {
    if (thread.awaitingHumanResponse()) {
      const humanResponse = await askHuman(lastEvent.data.parameters.message);
      thread.events.push(humanResponse);
      lastEvent = humanResponse;
      continue;
    }

    if (thread.awaitingHumanApproval() && (await askHumanApproval())) {
      newThread = await taskAgent.handleNextStep(lastEvent.data, newThread);
      lastEvent = newThread.events.slice(-1)[0];
      continue;
    }
    if (thread.awaitingHumanApproval() && !(await askHumanApproval())) {
      thread.events.push({
        type: 'tool response',
        data: `user denied the operation to ${lastEvent.type}`,
      });
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
