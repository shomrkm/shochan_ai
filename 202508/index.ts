// src/index.ts
import dotenv from 'dotenv';
import { NotionTaskAgent } from './agents/notion-task-agent';

dotenv.config();

async function main() {
  console.log('🚀 AI Agent Task Creator - Factor 1 Demo\n');

  try {
    const agent = new NotionTaskAgent();

    // 接続テスト
    const connectionsOk = await agent.testConnections();
    if (!connectionsOk) {
      console.log('❌ Connection tests failed');
      return;
    }

    console.log('\n🎉 Testing Factor 1: Natural Language to Tool Calls\n');

    // テスト1: 明確なタスク作成要求
    console.log('=== Test 1: Clear Task Request ===');
    await agent.processMessage('Create a task to review the quarterly sales report by tomorrow');

    console.log('\n' + '='.repeat(50) + '\n');

    // テスト2: プロジェクト作成要求
    console.log('=== Test 2: Project Creation Request ===');
    await agent.processMessage(
      'Create a project to implement user review system with high priority'
    );

    console.log('\n' + '='.repeat(50) + '\n');

    // テスト3: 曖昧な要求（質問されるはず）
    console.log('=== Test 3: Vague Request (Should Ask Question) ===');
    await agent.processMessage('I want to develop something for SmartHR');

    console.log('\n🎊 Factor 1 demonstration completed!');
    console.log('📋 Check your Notion databases for created items.');
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

if (require.main === module) {
  main();
}
