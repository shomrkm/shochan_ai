// src/interactive.ts
import dotenv from 'dotenv';
import { NotionTaskAgent } from './agents/notion-task-agent';
import { InputHelper } from './utils/input-helper';

dotenv.config();

async function startInteractiveSession() {
  console.log('🚀 AI Task Creator - Interactive Mode\n');
  console.log('✨ Create tasks and projects with natural language');
  console.log('🛑 Press Ctrl+C anytime to exit\n');

  // Set up graceful shutdown
  let isShuttingDown = false;
  const gracefulShutdown = () => {
    if (!isShuttingDown) {
      isShuttingDown = true;
      console.log('\n\n👋 Shutting down gracefully...');
      console.log('🙏 Thank you for using AI Task Creator!');
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

    console.log('🔗 All connections successful!\n');

    // Get initial user message
    const inputHelper = InputHelper.getInstance();

    console.log('='.repeat(60));
    console.log('💬 What would you like to create?');
    console.log('='.repeat(60));
    console.log('Examples:');
    console.log('  • "Create a task to review Q3 reports"');
    console.log('  • "I need a project for mobile app redesign"');
    console.log('  • "Help me organize my weekend tasks"');
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

if (require.main === module) {
  startInteractiveSession();
}
