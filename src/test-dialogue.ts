import dotenv from 'dotenv';
import { TaskCreatorAgent } from './agents/task-creator';

dotenv.config();

async function testContinuousDialogue() {
  console.log('🚀 Testing Factor 7: Continuous Interactive Dialogue\n');

  try {
    const agent = new TaskCreatorAgent();

    // test connections
    const connectionsOk = await agent.testConnections();
    if (!connectionsOk) {
      console.log('❌ Connection tests failed');
      return;
    }

    console.log('🎯 Starting continuous dialogue test...\n');

    // start continuous dialogue
    await agent.startConversation(
      'I want to create a new project for SmartHR'
    );

    console.log('🎉 Continuous dialogue test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  testContinuousDialogue()
    .then(() => {
      console.log('\n✅ Dialogue test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}
