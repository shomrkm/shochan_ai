// src/test-dialogue.ts
import dotenv from 'dotenv';
import { TaskCreatorAgent } from './agents/task-creator';

dotenv.config();

async function testDialogueFeature() {
  console.log('🚀 Testing Factor 7: Contact humans with tool calls\n');

  try {
    const agent = new TaskCreatorAgent();

    // 接続テスト
    const connectionsOk = await agent.testConnections();
    if (!connectionsOk) {
      console.log('❌ Connection tests failed');
      return;
    }

    console.log('🎯 Testing interactive dialogue flow...\n');

    // テスト1: 曖昧なリクエスト（質問されるはず）
    console.log('=== Test: Vague Request (Should Trigger Questions) ===');
    console.log('👤 Sending vague request to agent...\n');
    
    await agent.processMessage(
      'I want to create something for SmartHR'
    );

    console.log('\n🎉 Interactive dialogue test completed!');
    console.log('📝 The agent should have asked you for clarification.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  testDialogueFeature()
    .then(() => {
      console.log('\n✅ Dialogue test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}
