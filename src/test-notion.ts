// src/test-notion.ts
import dotenv from 'dotenv';
import { NotionClient } from './clients/notion';

// 環境変数を読み込み
dotenv.config();

async function testNotionIntegration() {
  console.log('🚀 Testing Notion API integration...\n');

  try {
    // Notion クライアント初期化
    const notion = new NotionClient();
    console.log('✅ Notion client initialized\n');

    // 接続テスト
    console.log('🔗 Testing database connection...');
    const connectionTest = await notion.testConnection();
    
    if (!connectionTest) {
      console.log('❌ Database connection failed');
      console.log('📋 Check:');
      console.log('  - NOTION_API_KEY is correct');
      console.log('  - NOTION_TASKS_DATABASE_ID is correct');
      console.log('  - NOTION_PROJECTS_DATABASE_ID is correct');
      console.log('  - Integration has access to the databases');
      return;
    }
    
    console.log('✅ Database connection successful\n');

    // テスト1: タスク作成
    console.log('📝 Test 1: Creating a test task...');
    const testTask = {
      function: {
        name: 'create_task' as const,
        parameters: {
          title: 'Test Task from AI Agent',
          description: 'This task was created by the AI Agent for testing purposes.',
          task_type: 'Next Actions' as const,
          scheduled_date: new Date().toISOString().split('T')[0], // 今日の日付
        },
      },
    };

    const taskResult = await notion.createTask(testTask);
    console.log('Task created successfully:');
    console.log(`  - ID: ${taskResult.task_id}`);
    console.log(`  - Title: ${taskResult.title}`);
    console.log(`  - Created: ${taskResult.created_at.toLocaleString()}`);
    console.log(`  - URL: ${taskResult.notion_url || 'N/A'}\n`);

    // テスト2: プロジェクト作成
    console.log('📁 Test 2: Creating a test project...');
    const testProject = {
      function: {
        name: 'create_project' as const,
        parameters: {
          name: 'AI Agent Test Project',
          description: 'This project was created by the AI Agent for testing purposes.',
          importance: '⭐⭐⭐' as const,
          action_plan: 'Verify that AI Agent can successfully create projects and tasks.',
        },
      },
    };

    const projectResult = await notion.createProject(testProject);
    console.log('Project created successfully:');
    console.log(`  - ID: ${projectResult.project_id}`);
    console.log(`  - Name: ${projectResult.name}`);
    console.log(`  - Created: ${projectResult.created_at.toLocaleString()}`);
    console.log(`  - URL: ${projectResult.notion_url || 'N/A'}\n`);

    // テスト3: プロジェクトに関連付けられたタスク作成
    console.log('🔗 Test 3: Creating a task linked to the project...');
    const linkedTask = {
      function: {
        name: 'create_task' as const,
        parameters: {
          title: 'Linked Test Task',
          description: 'This task is linked to the test project.',
          task_type: 'Today' as const,
          project_id: projectResult.project_id,
        },
      },
    };

    const linkedTaskResult = await notion.createTask(linkedTask);
    console.log('Linked task created successfully:');
    console.log(`  - ID: ${linkedTaskResult.task_id}`);
    console.log(`  - Title: ${linkedTaskResult.title}`);
    console.log(`  - Project Link: ${projectResult.name}`);
    console.log(`  - URL: ${linkedTaskResult.notion_url || 'N/A'}\n`);

    console.log('🎉 All tests passed! Notion integration is working correctly.');
    console.log('\n📋 Next steps:');
    console.log('  1. Check your Notion databases to see the created items');
    console.log('  2. Verify that the task is properly linked to the project');
    console.log('  3. Ready to integrate with Claude API!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('unauthorized')) {
        console.log('\n🔑 Authorization error:');
        console.log('  - Check your NOTION_API_KEY');
        console.log('  - Ensure the integration has access to your databases');
      } else if (error.message.includes('not found')) {
        console.log('\n🔍 Database not found:');
        console.log('  - Check your database IDs');
        console.log('  - Ensure the databases exist');
      }
    }
  }
}

// メイン実行
if (require.main === module) {
  testNotionIntegration()
    .then(() => {
      console.log('\n✅ Test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}
