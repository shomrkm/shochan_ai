import type { PromptContext } from '../types/prompt-types';

// Unified System Prompt
export const buildSystemPrompt = (context: PromptContext) => `
You are a Notion GTD system task creation assistant.

## Available Tools

1. **create_task** - Create a new task when you have sufficient information
   - title: Task title (required)
   - description: Detailed description (required)
   - task_type: "Today" | "Next Actions" | "Someday / Maybe" | "Wait for" | "Routin"
   - scheduled_date: Scheduled date (ISO format, optional)
   - project_id: Related project ID (optional)

2. **user_input** - Request input from user when you need more information
   - message: Clear explanation of what information you need and why
   - context: Context of what you are trying to accomplish

3. **create_project** - Create a new project when you have sufficient information
   - name: Project name (required)
   - description: Project description (required)
   - importance: "⭐" | "⭐⭐" | "⭐⭐⭐" | "⭐⭐⭐⭐" | "⭐⭐⭐⭐⭐"
   - action_plan: Action plan (optional)

## Current Context
- Current user message: "${context.userMessage}"
- Conversation history: ${context.conversationHistory.length} previous messages
${buildContextualInformation(context)}

## Your Goal
Help the user create a task or project by gathering the essential information:
- **For tasks**: title + description (minimum needed)
- **For projects**: name + description (minimum needed)

## Strategy
1. **If request is clear and has enough info** → Create task/project immediately
2. **If request is vague or missing key details** → Use user_input to ask for clarification
3. **Keep questions focused** → Ask for one piece of information at a time
4. **Don't over-ask** → Create as soon as you have title + description

## Examples of when to create immediately:
- "Create a task to review the quarterly report" → Has title + description
- "I need a project for redesigning the website" → Has name + description

## Examples of when to ask for input:
- "I want to build something" → Too vague, ask what specifically
- "Create a task for tomorrow" → Missing the actual task content

## Decision Logic
1. **If you have enough information** → Create task/project directly
2. **If you need more information** → Use user_input to ask for it
3. **Always be clear about what you need** → Explain why you're asking
4. **Avoid over-asking** → Don't ask for optional details if you have the essentials
5. **One tool call at a time** → Execute only one tool per response

Remember: Be helpful but efficient. Don't make users answer unnecessary questions.
`;

/**
 * Build contextual information from conversation history including tool execution results
 */
const buildContextualInformation = (context: PromptContext): string => {
  const toolExecutions = extractToolExecutions(context.conversationHistory);
  
  if (toolExecutions.length === 0) {
    return '';
  }

  let contextInfo = '\n## Previous Tool Executions\n';
  
  toolExecutions.forEach((execution, index) => {
    contextInfo += `\n${index + 1}. **${execution.toolName}** (${execution.status})\n`;
    
    if (execution.success) {
      switch (execution.toolName) {
        case 'create_task':
          if (execution.taskId) {
            contextInfo += `   ✅ Created task: "${execution.taskTitle}" (ID: ${execution.taskId})\n`;
          }
          break;
        case 'create_project':
          if (execution.projectId) {
            contextInfo += `   ✅ Created project: "${execution.projectName}" (ID: ${execution.projectId})\n`;
          }
          break;
        case 'user_input':
          if (execution.userResponse) {
            contextInfo += `   📝 User provided: "${execution.userResponse}"\n`;
          }
          break;
      }
    } else {
      contextInfo += `   ❌ Failed: ${execution.error?.message || 'Unknown error'}\n`;
    }
    
    contextInfo += `   ⏱️ Execution time: ${execution.executionTime}\n`;
  });

  return contextInfo;
};

/**
 * Extract tool execution information from conversation history
 */
const extractToolExecutions = (history: any[]): Array<{
  toolName: string;
  status: string;
  success: boolean;
  executionTime: string;
  taskId?: string;
  taskTitle?: string;
  projectId?: string;
  projectName?: string;
  userResponse?: string;
  error?: { message: string };
}> => {
  const executions: any[] = [];
  
  for (let i = 0; i < history.length - 1; i++) {
    const message = history[i];
    const nextMessage = history[i + 1];
    
    // Look for tool_use messages followed by tool_result messages
    if (
      message.role === 'assistant' &&
      Array.isArray(message.content) &&
      message.content[0]?.type === 'tool_use' &&
      nextMessage?.role === 'user' &&
      Array.isArray(nextMessage.content) &&
      nextMessage.content[0]?.type === 'tool_result'
    ) {
      const toolUse = message.content[0];
      const toolResult = nextMessage.content[0];
      
      try {
        const resultData = JSON.parse(toolResult.content);
        executions.push({
          toolName: toolUse.name,
          status: resultData.status || 'unknown',
          success: resultData.success || false,
          executionTime: resultData.executionTime || 'unknown',
          taskId: resultData.taskId,
          taskTitle: resultData.taskTitle,
          projectId: resultData.projectId,
          projectName: resultData.projectName,
          userResponse: resultData.userResponse,
          error: resultData.error,
        });
      } catch (error) {
        // Skip malformed tool results
        console.warn('Failed to parse tool result:', error);
      }
    }
  }
  
  return executions;
};
