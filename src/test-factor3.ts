import { config } from 'dotenv';
import { TaskCreatorAgent } from './agents/task-creator';

config();

/**
 * Factor 3: Interactive Context Window Management Demo
 * Allows manual testing of context optimization and token management
 */
async function main() {
  console.log('🚀 AI Agent - Factor 3: Interactive Context Window Management Demo\n');

  try {
    const agent = new TaskCreatorAgent();

    // Test connections first
    const connectionsOk = await agent.testConnections();
    if (!connectionsOk) {
      console.log('❌ Connection tests failed');
      return;
    }

    console.log('\n🎉 Factor 3: Own Your Context Window - Interactive Mode\n');
    console.log('💡 This demo will show context optimization in action.');
    console.log('📊 Watch for context statistics and token savings!\n');

    // Start with a fresh conversation
    console.log('🆕 Starting fresh conversation to demonstrate context management...\n');
    
    // Start an interactive conversation
    await agent.startConversation(
      'I want to create something for my work project'
    );

    console.log('\n🎊 Factor 3 interactive demo completed!');
    console.log('📈 Context window was automatically optimized for efficiency.');
    console.log('🔍 Notice how the system managed tokens and prioritized messages.');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

main().catch(console.error);