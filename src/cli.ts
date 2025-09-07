import * as readline from 'readline';
import { TaskAgent } from './agent/task-agent';
import { Thread, Event } from './thread/thread';
import dotenv from 'dotenv';

dotenv.config();

export async function cli() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Error: Please provide a message as a command line argument");
    process.exit(1);
  }

  const message = args.join(" ");
  const taskAgent = new TaskAgent();
  const thread = new Thread([{ type: "user_input", data: message }]);

  let newThread = await taskAgent.agetnLoop(thread);
  let lastEvent = newThread.events.slice(-1)[0];

  while (lastEvent.data.intent !== "done_for_now") {
    const responseEvent = await askHuman(lastEvent);
    newThread.events.push(responseEvent);
    newThread = await taskAgent.agetnLoop(newThread);
    lastEvent = newThread.events.slice(-1)[0];
  }

  console.log(lastEvent.data.message);
  process.exit(0);
}

async function askHuman(lastEvent: Event): Promise<Event> {
  return await askHumanCLI(lastEvent.data.message);
}

async function askHumanCLI(message: string): Promise<Event> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message}\n> `, (answer) => {
      rl.close();
      resolve({
        type: "user_input",
        data: answer.trim(),
      });
    });
  });
}

if (require.main === module) {
  cli().catch(console.error);
}