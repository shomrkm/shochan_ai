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
    console.log('cli loop:', thread.serializeForLLM());
    console.log('lastEvent:', lastEvent);
    if(newThread.awaitingHumanApproval()) {
      if( await askHumanApproval(lastEvent.data.parameters)) {
        newThread = await taskAgent.handleNextStep(lastEvent.data, newThread);
        lastEvent = newThread.events.slice(-1)[0];
      } else {
        thread.events.push({ 
          type: "user_input",
          data: {
            message: "Cancel tool call",
            deny_tool_call: lastEvent.data
          }
        });
        newThread = await taskAgent.agetnLoop(newThread);
        lastEvent = newThread.events.slice(-1)[0];
      }
      continue;
    }

    const responseEvent = await askHuman(lastEvent);
    newThread.events.push(responseEvent);
    newThread = await taskAgent.agetnLoop(newThread);
    lastEvent = newThread.events.slice(-1)[0];
  }

  console.log(lastEvent.data.parameters.message);
  process.exit(0);
}

async function askHuman(lastEvent: Event): Promise<Event> {
  return await askHumanCLI(lastEvent.data?.parameters?.message);
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

async function askHumanApproval(taskInfo?: any): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n⚠️  削除確認');
  if (taskInfo) {
    console.log(`タスク: ${taskInfo.title || taskInfo.task_id}`);
    if (taskInfo.description) console.log(`説明: ${taskInfo.description}`);
  }
  console.log('このタスクを削除してもよろしいですか？\n');

  return new Promise((resolve) => {
    rl.question('削除を実行しますか？ (yes/no): ', (answer) => {
      rl.close();
      const response = answer.trim().toLowerCase();
      resolve(response === 'yes' || response === 'y' || response === 'はい');
    });
  });
}



if (require.main === module) {
  cli().catch(console.error);
}