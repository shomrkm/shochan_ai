/**
 * Tool definitions for TaskAgent
 *
 * This module exports the tool definitions used by the TaskAgent to interact
 * with the Notion GTD system through OpenAI's Responses API.
 */

import type OpenAI from 'openai';

/**
 * Tool definitions for TaskAgent operations
 *
 * Available tools:
 * - create_task: Create a new task in the GTD system
 * - create_project: Create a new project
 * - get_tasks: Retrieve tasks with filtering and sorting
 * - update_task: Update an existing task
 * - delete_task: Delete a task (requires human approval)
 * - get_task_details: Get detailed information about a specific task
 * - request_more_information: Request additional information from the user
 * - done_for_now: Complete conversation with natural response
 */
export const taskAgentTools: OpenAI.Responses.FunctionTool[] = [
  {
    type: 'function',
    name: 'create_task',
    description: 'Create a new task in the GTD system',
    strict: null,
    parameters: {
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
      required: ['title'],
    },
  },
  {
    type: 'function',
    name: 'create_project',
    description: 'Create a new project',
    strict: null,
    parameters: {
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
    type: 'function',
    name: 'get_tasks',
    description: 'Retrieve tasks with optional filtering and sorting',
    strict: null,
    parameters: {
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
    type: 'function',
    name: 'request_more_information',
    description: 'Request more information from the user',
    strict: null,
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to request more information' },
      },
      required: ['message'],
    },
  },
  {
    type: 'function',
    name: 'delete_task',
    description: 'Delete a task from the GTD system',
    strict: null,
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'ID of the task to delete' },
        reason: { type: 'string', description: 'Reason for deletion (optional)' },
      },
      required: ['task_id'],
    },
  },
  {
    type: 'function',
    name: 'update_task',
    description: 'Update an existing task in the GTD system',
    strict: null,
    parameters: {
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
          anyOf: [
            { type: 'string', description: 'New scheduled date in ISO format' },
            { type: 'null', description: 'Remove scheduled date' }
          ],
          description: 'New scheduled date in ISO format, or null to remove',
        },
        project_id: {
          type: ['string', 'null'],
          description: 'New related project ID, or null to remove',
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
    type: 'function',
    name: 'get_task_details',
    description: 'Get detailed information about a specific task by its ID',
    strict: null,
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'ID of the task to retrieve details for' },
      },
      required: ['task_id'],
    },
  },
  {
    type: 'function',
    name: 'done_for_now',
    description:
      'Complete conversation with natural response for now, return the result of the tool you used',
    strict: null,
    parameters: {
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
];
