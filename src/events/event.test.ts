import { describe, expect, it } from 'vitest';
import { createEvent, Event } from './thread';
import type { CreateProjectData, CreateTaskResultData, UserMessageData } from './types';

describe('Event Class', () => {
  describe('constructor', () => {
    it('should create event with correct properties', () => {
      const data: UserMessageData = {
        message: 'Hello',
        timestamp: '2025-08-23T10:35:00Z',
      };

      const event = new Event('user_message', data);

      expect(event.type).toBe('user_message');
      expect(event.data).toEqual(data);
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.id).toMatch(/^event_\d+_\w{9}$/);
    });

    it('should generate unique IDs for different events', () => {
      const event1 = new Event('user_message', {
        message: 'Test 1',
        timestamp: '2025-08-23T10:35:00Z',
      });
      const event2 = new Event('user_message', {
        message: 'Test 2',
        timestamp: '2025-08-23T10:35:01Z',
      });

      expect(event1.id).not.toBe(event2.id);
    });

    it('should accept custom timestamp and ID', () => {
      const customDate = new Date('2025-08-23T10:35:00Z');
      const customId = 'custom_event_id';
      const data = { message: 'Custom event', timestamp: '2025-08-23T10:35:00Z' };

      const event = new Event('user_message', data, customDate, customId);

      expect(event.timestamp).toBe(customDate);
      expect(event.id).toBe(customId);
    });
  });

  describe('toXML', () => {
    it('should generate XML with YAML content for simple data', () => {
      const data: UserMessageData = {
        message: 'Hello World',
        timestamp: '2025-08-23T10:35:00Z',
      };

      const event = new Event('user_message', data);
      const result = event.toXML();

      expect(result).toBe(`<user_message>
message: Hello World
timestamp: '2025-08-23T10:35:00Z'
</user_message>`);
    });

    it('should handle Japanese text correctly', () => {
      const data: CreateProjectData = {
        name: 'AI研究プロジェクト',
        description: '機械学習の研究を行う',
        importance: '⭐⭐⭐⭐',
      };

      const event = new Event('create_project', data);
      const result = event.toXML();

      expect(result).toContain('<create_project>');
      expect(result).toContain('name: AI研究プロジェクト');
      expect(result).toContain('description: 機械学習の研究を行う');
      expect(result).toContain('importance: ⭐⭐⭐⭐');
      expect(result).toContain('</create_project>');
    });

    it('should handle complex result data with undefined values', () => {
      const data: CreateTaskResultData = {
        success: true,
        task_id: 'task_123',
        title: 'New Task',
        description: 'Task description',
        task_type: 'Today',
        created_at: '2025-08-23T10:35:00Z',
        notion_url: 'https://notion.so/task_123',
        scheduled_date: undefined,
        project_id: undefined,
        error: undefined,
        execution_time: 1200,
      };

      const event = new Event('create_task_result', data);
      const result = event.toXML();

      expect(result).toContain('<create_task_result>');
      expect(result).toContain('success: true');
      expect(result).toContain('execution_time: 1200');
      expect(result).not.toContain('scheduled_date:');
      expect(result).not.toContain('project_id:');
      expect(result).not.toContain('error:');
      expect(result).toContain('</create_task_result>');
    });

    it('should handle string data directly', () => {
      const data = {
        message: 'Simple string message',
        timestamp: '2025-08-23T10:35:00Z',
      };
      const event = new Event('agent_response', data);
      const result = event.toXML();

      expect(result).toContain('<agent_response>');
      expect(result).toContain('message: Simple string message');
      expect(result).toContain('</agent_response>');
    });

    it('should preserve data types in YAML output', () => {
      const data = {
        message: 'test message',
        timestamp: '2025-08-23T10:35:00Z',
      };

      const event = new Event('agent_response', data);
      const result = event.toXML();

      expect(result).toContain('<agent_response>');
      expect(result).toContain('message: test message');
      expect(result).toContain("timestamp: '2025-08-23T10:35:00Z'");
      expect(result).toContain('</agent_response>');
    });

    it('should handle special characters and emojis', () => {
      const data: CreateProjectData = {
        name: 'Test & <data> "quotes"',
        description: 'こんにちは世界 🤖',
        importance: '⭐⭐⭐⭐⭐',
      };

      const event = new Event('create_project', data);
      const result = event.toXML();

      expect(result).toContain('importance: ⭐⭐⭐⭐⭐');
      expect(result).toContain('🤖');
      expect(result).toContain('こんにちは世界');
      expect(result).toContain('Test & <data>'); // Should handle special chars
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct data types for event types', () => {
      // This should compile - correct type mapping
      const userEvent = new Event('user_message', {
        message: 'Hello',
        timestamp: '2025-08-23T10:35:00Z',
      });

      const taskEvent = new Event('create_task', {
        title: 'New Task',
        description: 'Task description',
        task_type: 'Today',
      });

      const resultEvent = new Event('create_task_result', {
        success: true,
        execution_time: 1200,
      });

      expect(userEvent.type).toBe('user_message');
      expect(taskEvent.type).toBe('create_task');
      expect(resultEvent.type).toBe('create_task_result');
    });

    it('should work with createEvent helper function', () => {
      const event = createEvent('create_project', {
        name: 'Test Project',
        description: 'Description',
        importance: '⭐⭐⭐',
      });

      expect(event.type).toBe('create_project');
      expect(event.data.name).toBe('Test Project');
      expect(event.data.importance).toBe('⭐⭐⭐');
    });
  });
});
