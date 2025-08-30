// src/cli.ts
import dotenv from 'dotenv';
import { NotionTaskAgent } from './agents/notion-task-agent';
import { InputHelper } from './utils/input-helper';

dotenv.config();

interface CliOptions {
  help?: boolean;
  version?: boolean;
  query?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-q':
      case '--query':
        if (i + 1 < args.length) {
          options.query = args[i + 1];
          i++;
        }
        break;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
🚀 Notion Task Manager CLI

Manage your Notion GTD tasks with natural language.

Usage:
  npm run cli                  Start interactive mode
  npm run cli -- -q "message"  Quick task creation
  npm run cli -- --help       Show this help
  npm run cli -- --version    Show version

Examples:
  npm run cli -- -q "Create a task to review Q3 reports"
  npm run cli -- -q "Show my today's tasks"
  npm run cli -- -q "Create a project for mobile app redesign"

Interactive mode commands:
  • "Create a task to [description]"
  • "Show my [today/next actions/someday] tasks"
  • "Create a project for [name]"
  • "Help me organize [context]"

Press Ctrl+C anytime to exit.
`);
}

function showVersion() {
  const packageJson = require('../package.json');
  console.log(`v${packageJson.version}`);
}

async function quickQuery(query: string) {
  console.log('🚀 Notion Task Manager - Quick Mode\n');
  
  const agent = new NotionTaskAgent();
  
  // Test connections quietly
  const connectionsOk = await agent.testConnections();
  if (!connectionsOk) {
    console.error('❌ Connection failed. Please check your Notion API token.');
    process.exit(1);
  }
  
  console.log(`🎯 Processing: "${query}"\n`);
  await agent.startConversation(query);
}

async function startInteractiveMode() {
  console.log('🚀 Notion Task Manager - Interactive Mode\n');
  console.log('✨ Manage your Notion tasks with natural language');
  console.log('🛑 Press Ctrl+C anytime to exit\n');

  // Set up graceful shutdown
  let isShuttingDown = false;
  const gracefulShutdown = () => {
    if (!isShuttingDown) {
      isShuttingDown = true;
      console.log('\n\n👋 Goodbye!');
      process.exit(0);
    }
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  try {
    const agent = new NotionTaskAgent();

    // Test connections
    const connectionsOk = await agent.testConnections();
    if (!connectionsOk) {
      console.log('❌ Connection tests failed');
      return;
    }

    console.log('🔗 Connected to Notion!\n');

    // Get initial user message
    const inputHelper = InputHelper.getInstance();

    console.log('='.repeat(60));
    console.log('💬 What would you like to do?');
    console.log('='.repeat(60));
    console.log('Examples:');
    console.log('  • "Create a task to review Q3 reports"');
    console.log('  • "Show my today\'s tasks"');
    console.log('  • "Create a project for mobile app redesign"');
    console.log('  • "What should I do next?"');
    console.log('='.repeat(60));

    const initialMessage = await inputHelper.getUserInput('\n🎯 Your request: ');

    if (initialMessage) {
      await agent.startConversation(initialMessage);
    } else {
      console.log('👋 No input provided. Goodbye!');
    }
  } catch (error) {
    if (!isShuttingDown) {
      console.error('❌ Session failed:', error);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (options.help) {
    showHelp();
    return;
  }
  
  if (options.version) {
    showVersion();
    return;
  }
  
  if (options.query) {
    await quickQuery(options.query);
    return;
  }
  
  // Default to interactive mode
  await startInteractiveMode();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ CLI failed:', error.message);
    process.exit(1);
  });
}
