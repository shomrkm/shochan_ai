import { builPrompt } from '../prompts/system-prompt';
import { OpenAIClient } from '../clients/openai';
import { NotionClient } from '../clients/notion';
import type { Thread } from '../thread/thread';
import { taskAgentTools } from './task-agent-tools';

import type { ToolCall } from '../types/tools';
export class TaskAgent {
  private openai: OpenAIClient;
  private notion: NotionClient;

  constructor() {
    this.openai = new OpenAIClient();
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
    const { toolCall } = await this.openai.generateToolCall({
      systemPrompt: 'You are a helpful assistant that can help with Notion GTD system management.',
      inputMessages: [{ role: 'user', content: builPrompt(thread.serializeForLLM()) }],
      tools: taskAgentTools,
    });

    return toolCall;
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
