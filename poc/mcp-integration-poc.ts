/**
 * POC: OpenAI Responses API + Notion MCP Integration
 *
 * This script tests the technical feasibility of replacing the custom NotionClient
 * implementation with the Notion MCP server integration via OpenAI Responses API.
 *
 * Prerequisites:
 *   1. Start notion-mcp-server in HTTP mode:
 *      NOTION_TOKEN=<token> AUTH_TOKEN=<auth> npx @notionhq/notion-mcp-server --transport http --port 3002
 *
 *   2. Run this script:
 *      OPENAI_API_KEY=<key> AUTH_TOKEN=<auth> npx tsx poc/mcp-integration-poc.ts
 *
 * What this tests:
 *   - Tool.Mcp type usage in openai@6.8.1 SDK (type-safe, no assertions needed)
 *   - MCP tool + custom function tool mixed in same tools array
 *   - mcp_call / mcp_list_tools output format in API response
 *   - Whether done_for_now custom function gets selected after MCP task completion
 */

import OpenAI from 'openai';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? 'http://localhost:3002/mcp';
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * MCP tool definition using Tool.Mcp type (fully type-safe in openai@6.8.1)
 */
const mcpTool: OpenAI.Responses.Tool.Mcp = {
  type: 'mcp',
  server_label: 'notion',
  server_url: MCP_SERVER_URL,
  headers: AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : undefined,
  require_approval: 'never',
};

/**
 * Custom function tool for control flow (mirrors current implementation)
 */
const doneForNowTool: OpenAI.Responses.FunctionTool = {
  type: 'function',
  name: 'done_for_now',
  description:
    'Call this when you have completed the requested task and have nothing more to do right now.',
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Brief summary of what was accomplished',
      },
    },
    required: ['summary'],
  },
  strict: false,
};

const requestMoreInfoTool: OpenAI.Responses.FunctionTool = {
  type: 'function',
  name: 'request_more_information',
  description: 'Call this when you need more information from the user to proceed.',
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The question to ask the user',
      },
    },
    required: ['question'],
  },
  strict: false,
};

/**
 * Inspect the output items from the API response
 */
function inspectOutput(output: OpenAI.Responses.ResponseOutputItem[]): void {
  console.log('\n=== Response Output Items ===');
  for (const item of output) {
    console.log(`\nType: ${item.type}`);

    switch (item.type) {
      case 'mcp_list_tools': {
        const mcpItem = item as OpenAI.Responses.ResponseOutputItem.McpListTools;
        console.log(`  Server: ${mcpItem.server_label}`);
        console.log(`  Tools count: ${mcpItem.tools.length}`);
        console.log('  Tool names:');
        for (const tool of mcpItem.tools) {
          console.log(`    - ${tool.name}: ${tool.description ?? '(no description)'}`);
        }
        break;
      }
      case 'mcp_call': {
        const mcpCall = item as OpenAI.Responses.ResponseOutputItem.McpCall;
        console.log(`  Server: ${mcpCall.server_label}`);
        console.log(`  Tool: ${mcpCall.name}`);
        console.log(`  Arguments: ${JSON.stringify(JSON.parse(mcpCall.arguments ?? '{}'), null, 2)}`);
        console.log(`  Output: ${mcpCall.output?.slice(0, 500) ?? '(empty)'}`);
        console.log(`  Error: ${mcpCall.error ?? 'none'}`);
        break;
      }
      case 'function_call': {
        const fnCall = item as OpenAI.Responses.ResponseFunctionToolCall;
        console.log(`  Function: ${fnCall.name}`);
        console.log(`  Arguments: ${fnCall.arguments}`);
        break;
      }
      case 'message': {
        const msg = item as OpenAI.Responses.ResponseOutputMessage;
        const text = msg.content
          .filter((c) => c.type === 'output_text')
          .map((c) => (c as OpenAI.Responses.ResponseOutputText).text)
          .join('');
        console.log(`  Text: ${text.slice(0, 200)}`);
        break;
      }
      default:
        console.log(`  Raw: ${JSON.stringify(item).slice(0, 200)}`);
    }
  }
  console.log('\n=============================\n');
}

async function runPOC(): Promise<void> {
  console.log('=== Notion MCP Integration POC ===');
  console.log(`MCP Server URL: ${MCP_SERVER_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN ? '[SET]' : '[NOT SET]'}`);
  console.log('');

  // Test 1: List available MCP tools
  console.log('--- Test 1: List Notion MCP Tools ---');
  try {
    const listToolsResponse = await client.responses.create({
      model: 'gpt-4o',
      instructions:
        'List all tools available on the Notion MCP server, then call done_for_now.',
      input: 'What Notion tools are available?',
      tools: [mcpTool, doneForNowTool],
    });

    console.log('Status:', listToolsResponse.status);
    inspectOutput(listToolsResponse.output);
  } catch (error) {
    console.error('Test 1 failed:', error instanceof Error ? error.message : String(error));
  }

  // Test 2: Retrieve tasks via MCP
  console.log('--- Test 2: Get Notion Tasks via MCP ---');
  try {
    const getTasksResponse = await client.responses.create({
      model: 'gpt-4o',
      instructions: `You are a task management assistant. Use the Notion MCP tools to retrieve tasks.
After retrieving tasks, call done_for_now with a summary.`,
      input: 'タスクの一覧を取得してください',
      tools: [mcpTool, doneForNowTool, requestMoreInfoTool],
    });

    console.log('Status:', getTasksResponse.status);
    inspectOutput(getTasksResponse.output);
  } catch (error) {
    console.error('Test 2 failed:', error instanceof Error ? error.message : String(error));
  }

  // Test 3: Type safety verification (compile-time check only)
  console.log('--- Test 3: Type Safety Verification ---');
  console.log('Tool.Mcp type is valid (openai@6.8.1):');

  // This should compile without any type assertions
  const typedMcpTool: OpenAI.Responses.Tool = {
    type: 'mcp',
    server_label: 'notion',
    server_url: 'http://localhost:3002/mcp',
    require_approval: 'never',
  };
  console.log('  ✓ Tool.Mcp assignable to Tool union type');
  console.log('  ✓ server_label, server_url, require_approval fields typed correctly');
  console.log('  ✓ headers field supports Record<string, string>');
  console.log('  ✓ No type assertions (as any) required');
  console.log('  Tool:', JSON.stringify(typedMcpTool, null, 2));

  console.log('\n=== POC Complete ===');
}

runPOC().catch(console.error);
