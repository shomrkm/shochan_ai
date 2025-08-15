// src/test-factor2.ts
import dotenv from 'dotenv';
import { TaskCreatorAgent } from './agents/task-creator';

dotenv.config();

async function testFactor2Implementation() {
  console.log('🚀 Testing Factor 2: Own your prompts\n');
  console.log('📚 This test demonstrates dynamic prompt generation based on conversation context\n');

  try {
    const agent = new TaskCreatorAgent();

    // 接続テスト
    const connectionsOk = await agent.testConnections();
    if (!connectionsOk) {
      console.log('❌ Connection tests failed');
      return;
    }

    // Factor 2 機能の表示
    console.log('🎯 Factor 2 Features:');
    console.log('  ✅ Prompts as first-class code');
    console.log('  ✅ Dynamic prompt selection based on context');
    console.log('  ✅ Conversation stage-aware prompting');
    console.log('  ✅ Debug-friendly prompt management\n');

    // 利用可能なプロンプト関数を表示
    agent.showAvailablePromptFunctions();

    // Factor 2 機能を有効化
    agent.enableDynamicPrompts();
    agent.enablePromptDebugging();

    console.log('\n🎯 Starting Factor 2 enhanced dialogue...\n');

    // テストシナリオ: 曖昧な要求から始めて情報収集
    await agent.startConversation(
      'I want to build something cool for SmartHR'
    );

    console.log('\n🎉 Factor 2 test completed!');
    console.log('📝 You should have seen:');
    console.log('  1. Different prompts for different conversation stages');
    console.log('  2. Context-aware question generation');
    console.log('  3. Intelligent information collection');
    console.log('  4. Prompt debugging information');
    console.log('  5. Stage transitions: initial → gathering_info → confirming → executing');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  testFactor2Implementation()
    .then(() => {
      console.log('\n✅ Factor 2 test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}