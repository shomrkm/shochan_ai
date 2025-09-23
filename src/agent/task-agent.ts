import { builPrompt } from '../prompts/system-prompt';
import { ClaudeClient } from '../clients/claude';
import { NotionClient } from '../clients/notion';
import { Thread } from '../thread/thread';

import type { ToolCall } from '../types/tools';
export class TaskAgent {
  private claude: ClaudeClient;
  private notion: NotionClient;

  constructor() {
    this.claude = new ClaudeClient();
    this.notion = new NotionClient();
  }

  async agetnLoop(thread: Thread): Promise<Thread> {
    while (true) {
      let nextStep: ToolCall | null = null;
      try {
        nextStep = await this.determineNextStep(thread);
      } catch (error) {
        thread.events.push({
          type: 'error',
          data: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        continue;
      }
      if (!nextStep) return thread;

      thread.events.push({
        type: 'tool_call',
        data: nextStep,
      });

      switch (nextStep.intent) {
        case 'done_for_now':
        case 'request_more_information':
          return thread;
        case 'delete_task':
          return thread; // Stop and wait for human approval
        case 'create_task':
        case 'create_project':
        case 'update_task':
        case 'get_tasks':
        case 'get_task_details':
          await this.handleNextStep(nextStep, thread);
          continue;
      }
    }
  }

  private async determineNextStep(thread: Thread) {
    return await this.claude.generateToolCall({
      systemPrompt: 'You are a helpful assistant that can help with Notion GTD system management.',
      userMessage: builPrompt(thread.serializeForLLM()),
      tools: [
        {
          name: 'create_task',
          description: 'Create a new task in the GTD system',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Task description' },
              task_type: {
                type: 'string',
                enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin'],
                description: 'Type of task in GTD system',
              },
              scheduled_date: { type: 'string', description: 'Scheduled date in ISO format' },
              project_id: { type: 'string', description: 'Related project ID' },
            },
            required: ['title', 'description', 'task_type'],
          },
        },
        {
          name: 'create_project',
          description: 'Create a new project',
          input_schema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Project name' },
              description: { type: 'string', description: 'Project description' },
              importance: {
                type: 'string',
                enum: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'],
                description: 'Project importance level',
              },
              action_plan: { type: 'string', description: 'Action plan' },
            },
            required: ['name', 'description', 'importance'],
          },
        },
        {
          name: 'get_tasks',
          description: 'Retrieve tasks with optional filtering and sorting',
          input_schema: {
            type: 'object',
            properties: {
              task_type: {
                type: 'string',
                enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin'],
                description: 'Filter by task type',
              },
              project_id: {
                type: 'string',
                description: 'Filter by project ID',
              },
              search_title: {
                type: 'string',
                description: 'Search tasks by title/name (partial match)',
              },
              limit: {
                type: 'number',
                minimum: 1,
                maximum: 100,
                description: 'Maximum number of tasks to return (default: 10)',
              },
              include_completed: {
                type: 'boolean',
                description: 'Whether to include completed tasks (default: false)',
              },
              sort_by: {
                type: 'string',
                enum: ['created_at', 'updated_at', 'scheduled_date'],
                description: 'Field to sort by (default: created_at)',
              },
              sort_order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Sort order (default: desc)',
              },
            },
            required: [],
          },
        },
        {
          name: 'request_more_information',
          description: 'Request more information from the user',
          input_schema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Message to request more information' },
            },
            required: ['message'],
          },
        },
        {
          name: 'delete_task',
          description: 'Delete a task from the GTD system',
          input_schema: {
            type: 'object',
            properties: {
              task_id: { type: 'string', description: 'ID of the task to delete' },
              reason: { type: 'string', description: 'Reason for deletion (optional)' },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'update_task',
          description: 'Update an existing task in the GTD system',
          input_schema: {
            type: 'object',
            properties: {
              task_id: { type: 'string', description: 'ID of the task to update' },
              title: { type: 'string', description: 'New task title' },
              task_type: {
                type: 'string',
                enum: ['Today', 'Next Actions', 'Someday / Maybe', 'Wait for', 'Routin'],
                description: 'New type of task in GTD system',
              },
              scheduled_date: {
                type: ['string', 'null'],
                description: 'New scheduled date in ISO format, or null to remove'
              },
              project_id: {
                type: ['string', 'null'],
                description: 'New related project ID, or null to remove'
              },
              is_archived: {
                type: 'boolean',
                description: 'New task archived status',
              },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'get_task_details',
          description: 'Get detailed information about a specific task by its ID',
          input_schema: {
            type: 'object',
            properties: {
              task_id: { type: 'string', description: 'ID of the task to retrieve details for' },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'done_for_now',
          description:
            'Complete conversation with natural response for now, return the result of the tool you used',
          input_schema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Natural language response to user',
              },
            },
            required: ['message'],
          },
        },
      ],
    });
  }

  async handleNextStep(nextStep: ToolCall, thread: Thread): Promise<Thread> {
    switch (nextStep.intent) {
      case 'get_tasks': {
        const result = await this.notion.getTasks(nextStep);
        thread.events.push({
          type: 'tool_response',
          data: result,
        });
        return thread;
      }
      case 'create_task': {
        const result = await this.notion.createTask(nextStep);
        thread.events.push({
          type: 'tool_response',
          data: result,
        });
        return thread;
      }
      case 'create_project': {
        const result = await this.notion.createProject(nextStep);
        thread.events.push({
          type: 'tool_response',
          data: result,
        });
        return thread;
      }
      case 'delete_task': {
        const result = await this.notion.deleteTask(nextStep);
        thread.events.push({
          type: 'tool_response',
          data: result,
        });
        return thread;
      }
      case 'update_task': {
        const result = await this.notion.updateTask(nextStep);
        thread.events.push({
          type: 'tool_response',
          data: result,
        });
        return thread;
      }
      case 'get_task_details': {
        const result = await this.notion.getTaskDetails(nextStep);
        thread.events.push({
          type: 'tool_response',
          data: result,
        });
        return thread;
      }
    }
    throw new Error(`Unknown next step: ${nextStep.intent}`);
  }
}
