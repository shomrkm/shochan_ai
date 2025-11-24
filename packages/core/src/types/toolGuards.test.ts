import { describe, expect, it } from 'vitest';
import {
  isCreateProjectTool,
  isCreateTaskTool,
  isDeleteTaskTool,
  isGetTaskDetailsTool,
  isGetTasksTool,
  isUpdateTaskTool,
} from './toolGuards';
import type { ToolCall } from './tools';

describe('toolGuards', () => {
  describe('isCreateTaskTool', () => {
    it('returns true for create_task intent', () => {
      const tool: ToolCall = {
        intent: 'create_task',
        parameters: {
          title: 'Test Task',
          description: 'Description',
          task_type: 'Today',
        },
      };

      expect(isCreateTaskTool(tool)).toBe(true);
    });

    it('returns false for other intents', () => {
      const tool: ToolCall = {
        intent: 'create_project',
        parameters: {},
      };

      expect(isCreateTaskTool(tool)).toBe(false);
    });

    it('returns false for get_tasks intent', () => {
      const tool: ToolCall = {
        intent: 'get_tasks',
        parameters: {},
      };

      expect(isCreateTaskTool(tool)).toBe(false);
    });

    it('narrows type correctly when used as type guard', () => {
      const tool: ToolCall = {
        intent: 'create_task',
        parameters: {
          title: 'Task',
          description: 'Desc',
          task_type: 'Today',
        },
      };

      if (isCreateTaskTool(tool)) {
        // Type should be narrowed to CreateTaskTool
        expect(tool.parameters.title).toBe('Task');
        expect(tool.parameters.description).toBe('Desc');
        expect(tool.parameters.task_type).toBe('Today');
      }
    });
  });

  describe('isCreateProjectTool', () => {
    it('returns true for create_project intent', () => {
      const tool: ToolCall = {
        intent: 'create_project',
        parameters: {
          name: 'Project',
          description: 'Description',
          importance: '⭐⭐⭐',
        },
      };

      expect(isCreateProjectTool(tool)).toBe(true);
    });

    it('returns false for other intents', () => {
      const tool: ToolCall = {
        intent: 'create_task',
        parameters: {},
      };

      expect(isCreateProjectTool(tool)).toBe(false);
    });

    it('narrows type correctly when used as type guard', () => {
      const tool: ToolCall = {
        intent: 'create_project',
        parameters: {
          name: 'My Project',
          description: 'Project description',
          importance: '⭐⭐⭐⭐⭐',
        },
      };

      if (isCreateProjectTool(tool)) {
        // Type should be narrowed to CreateProjectTool
        expect(tool.parameters.name).toBe('My Project');
        expect(tool.parameters.importance).toBe('⭐⭐⭐⭐⭐');
      }
    });
  });

  describe('isGetTasksTool', () => {
    it('returns true for get_tasks intent', () => {
      const tool: ToolCall = {
        intent: 'get_tasks',
        parameters: {
          task_type: 'Today',
          limit: 10,
        },
      };

      expect(isGetTasksTool(tool)).toBe(true);
    });

    it('returns false for other intents', () => {
      const tool: ToolCall = {
        intent: 'update_task',
        parameters: {},
      };

      expect(isGetTasksTool(tool)).toBe(false);
    });

    it('narrows type correctly when used as type guard', () => {
      const tool: ToolCall = {
        intent: 'get_tasks',
        parameters: {
          task_type: 'Next Actions',
          include_completed: false,
          sort_by: 'created_at',
        },
      };

      if (isGetTasksTool(tool)) {
        // Type should be narrowed to GetTasksTool
        expect(tool.parameters.task_type).toBe('Next Actions');
        expect(tool.parameters.include_completed).toBe(false);
        expect(tool.parameters.sort_by).toBe('created_at');
      }
    });
  });

  describe('isDeleteTaskTool', () => {
    it('returns true for delete_task intent', () => {
      const tool: ToolCall = {
        intent: 'delete_task',
        parameters: {
          task_id: 'task_123',
          reason: 'No longer needed',
        },
      };

      expect(isDeleteTaskTool(tool)).toBe(true);
    });

    it('returns false for other intents', () => {
      const tool: ToolCall = {
        intent: 'get_task_details',
        parameters: {},
      };

      expect(isDeleteTaskTool(tool)).toBe(false);
    });

    it('narrows type correctly when used as type guard', () => {
      const tool: ToolCall = {
        intent: 'delete_task',
        parameters: {
          task_id: 'task_456',
          reason: 'Duplicate task',
        },
      };

      if (isDeleteTaskTool(tool)) {
        // Type should be narrowed to DeleteTaskTool
        expect(tool.parameters.task_id).toBe('task_456');
        expect(tool.parameters.reason).toBe('Duplicate task');
      }
    });
  });

  describe('isUpdateTaskTool', () => {
    it('returns true for update_task intent', () => {
      const tool: ToolCall = {
        intent: 'update_task',
        parameters: {
          task_id: 'task_789',
          title: 'Updated Title',
        },
      };

      expect(isUpdateTaskTool(tool)).toBe(true);
    });

    it('returns false for other intents', () => {
      const tool: ToolCall = {
        intent: 'create_task',
        parameters: {},
      };

      expect(isUpdateTaskTool(tool)).toBe(false);
    });

    it('narrows type correctly when used as type guard', () => {
      const tool: ToolCall = {
        intent: 'update_task',
        parameters: {
          task_id: 'task_999',
          task_type: 'Someday / Maybe',
          is_archived: true,
        },
      };

      if (isUpdateTaskTool(tool)) {
        // Type should be narrowed to UpdateTaskTool
        expect(tool.parameters.task_id).toBe('task_999');
        expect(tool.parameters.task_type).toBe('Someday / Maybe');
        expect(tool.parameters.is_archived).toBe(true);
      }
    });
  });

  describe('isGetTaskDetailsTool', () => {
    it('returns true for get_task_details intent', () => {
      const tool: ToolCall = {
        intent: 'get_task_details',
        parameters: {
          task_id: 'task_abc',
        },
      };

      expect(isGetTaskDetailsTool(tool)).toBe(true);
    });

    it('returns false for other intents', () => {
      const tool: ToolCall = {
        intent: 'get_tasks',
        parameters: {},
      };

      expect(isGetTaskDetailsTool(tool)).toBe(false);
    });

    it('narrows type correctly when used as type guard', () => {
      const tool: ToolCall = {
        intent: 'get_task_details',
        parameters: {
          task_id: 'task_xyz',
        },
      };

      if (isGetTaskDetailsTool(tool)) {
        // Type should be narrowed to GetTaskDetailsTool
        expect(tool.parameters.task_id).toBe('task_xyz');
      }
    });
  });

  describe('type narrowing in switch statement', () => {
    it('correctly narrows types in exhaustive switch', () => {
      const tools: ToolCall[] = [
        {
          intent: 'create_task',
          parameters: { title: 'T1', description: 'D1', task_type: 'Today' },
        },
        {
          intent: 'create_project',
          parameters: { name: 'P1', description: 'PD1', importance: '⭐⭐' },
        },
        { intent: 'get_tasks', parameters: { limit: 5 } },
        { intent: 'delete_task', parameters: { task_id: 'del_1' } },
        { intent: 'update_task', parameters: { task_id: 'upd_1', title: 'New' } },
        { intent: 'get_task_details', parameters: { task_id: 'det_1' } },
      ];

      const results: string[] = [];

      for (const tool of tools) {
        if (isCreateTaskTool(tool)) {
          results.push(`create_task: ${tool.parameters.title}`);
        } else if (isCreateProjectTool(tool)) {
          results.push(`create_project: ${tool.parameters.name}`);
        } else if (isGetTasksTool(tool)) {
          results.push(`get_tasks: limit=${tool.parameters.limit ?? 'default'}`);
        } else if (isDeleteTaskTool(tool)) {
          results.push(`delete_task: ${tool.parameters.task_id}`);
        } else if (isUpdateTaskTool(tool)) {
          results.push(`update_task: ${tool.parameters.task_id}`);
        } else if (isGetTaskDetailsTool(tool)) {
          results.push(`get_task_details: ${tool.parameters.task_id}`);
        }
      }

      expect(results).toEqual([
        'create_task: T1',
        'create_project: P1',
        'get_tasks: limit=5',
        'delete_task: del_1',
        'update_task: upd_1',
        'get_task_details: det_1',
      ]);
    });
  });

  describe('edge cases', () => {
    it('handles empty intent string', () => {
      const tool: ToolCall = {
        intent: '',
        parameters: {},
      };

      expect(isCreateTaskTool(tool)).toBe(false);
      expect(isCreateProjectTool(tool)).toBe(false);
      expect(isGetTasksTool(tool)).toBe(false);
      expect(isDeleteTaskTool(tool)).toBe(false);
      expect(isUpdateTaskTool(tool)).toBe(false);
      expect(isGetTaskDetailsTool(tool)).toBe(false);
    });

    it('handles unknown intent', () => {
      const tool: ToolCall = {
        intent: 'unknown_intent',
        parameters: {},
      };

      expect(isCreateTaskTool(tool)).toBe(false);
      expect(isCreateProjectTool(tool)).toBe(false);
      expect(isGetTasksTool(tool)).toBe(false);
      expect(isDeleteTaskTool(tool)).toBe(false);
      expect(isUpdateTaskTool(tool)).toBe(false);
      expect(isGetTaskDetailsTool(tool)).toBe(false);
    });

    it('handles intent with extra whitespace', () => {
      const tool: ToolCall = {
        intent: ' create_task ',
        parameters: {},
      };

      // Should return false because intent is exactly compared (no trimming)
      expect(isCreateTaskTool(tool)).toBe(false);
    });

    it('handles case-sensitive intent comparison', () => {
      const tool: ToolCall = {
        intent: 'CREATE_TASK',
        parameters: {},
      };

      // Should return false because comparison is case-sensitive
      expect(isCreateTaskTool(tool)).toBe(false);
    });

    it('handles empty parameters object', () => {
      const tool: ToolCall = {
        intent: 'get_tasks',
        parameters: {},
      };

      expect(isGetTasksTool(tool)).toBe(true);
    });
  });
});
