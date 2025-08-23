import { describe, it, expect, beforeEach } from 'vitest';
import { Thread } from './thread';
import type { UserMessageData, CreateTaskData, CreateProjectResultData } from './types';

describe('Thread Class', () => {
  let thread: Thread;

  beforeEach(() => {
    thread = new Thread();
  });

  describe('constructor', () => {
    it('should initialize with correct thread ID and timestamp', () => {
      expect(thread.id).toMatch(/^thread_\d+_\w{9}$/);
      expect(thread.startTime).toBeInstanceOf(Date);
      expect(thread.getEvents()).toHaveLength(0);
    });

    it('should accept custom ID and start time', () => {
      const customDate = new Date('2025-08-23T10:35:00Z');
      const customId = 'custom_thread_123';

      const customThread = new Thread(customId, customDate);

      expect(customThread.id).toBe(customId);
      expect(customThread.startTime).toBe(customDate);
    });

    it('should generate unique IDs for different threads', () => {
      const thread1 = new Thread();
      const thread2 = new Thread();

      expect(thread1.id).not.toBe(thread2.id);
    });
  });

  describe('addEvent', () => {
    it('should add events and maintain order', () => {
      const userData: UserMessageData = {
        message: 'Hello',
        timestamp: '2025-08-23T10:35:00Z'
      };

      const taskData: CreateTaskData = {
        title: 'New Task',
        description: 'Task description',
        task_type: 'Today'
      };

      const userEvent = thread.addEvent('user_message', userData);
      const taskEvent = thread.addEvent('create_task', taskData);

      const events = thread.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBe(userEvent);
      expect(events[1]).toBe(taskEvent);
      expect(events[0].type).toBe('user_message');
      expect(events[1].type).toBe('create_task');
    });

    it('should return type-safe events', () => {
      const taskData: CreateTaskData = {
        title: 'Test Task',
        description: 'Description',
        task_type: 'Next Actions'
      };

      const event = thread.addEvent('create_task', taskData);

      expect(event.type).toBe('create_task');
      expect(event.data.title).toBe('Test Task');
      expect(event.data.task_type).toBe('Next Actions');
    });

    it('should handle multiple events of the same type', () => {
      const userData1: UserMessageData = {
        message: 'First message',
        timestamp: '2025-08-23T10:35:00Z'
      };

      const userData2: UserMessageData = {
        message: 'Second message', 
        timestamp: '2025-08-23T10:36:00Z'
      };

      thread.addEvent('user_message', userData1);
      thread.addEvent('user_message', userData2);

      const events = thread.getEvents();
      const userMessages = thread.getUserMessages();
      expect(events).toHaveLength(2);
      expect(userMessages).toHaveLength(2);
      expect(userMessages[0].data.message).toBe('First message');
      expect(userMessages[1].data.message).toBe('Second message');
    });
  });

  describe('getEvents', () => {
    it('should return readonly array of events', () => {
      const userData: UserMessageData = {
        message: 'Test',
        timestamp: '2025-08-23T10:35:00Z'
      };

      thread.addEvent('user_message', userData);
      const events = thread.getEvents();
      const userMessages = thread.getUserMessages();

      expect(events).toHaveLength(1);
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].data.message).toBe('Test');
      
      // Should be readonly - this is tested by TypeScript, not runtime
      expect(Array.isArray(events)).toBe(true);
    });

    it('should handle empty thread gracefully', () => {
      const events = thread.getEvents();
      
      expect(events).toHaveLength(0);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('toPrompt', () => {
    it('should generate valid XML context with session info', () => {
      const result = thread.toPrompt();

      expect(result).toContain('<conversation_context>');
      expect(result).toContain('<session_info>');
      expect(result).toContain(`thread_id: ${thread.id}`);
      expect(result).toContain('event_count: 0');
      expect(result).toContain('</session_info>');
      expect(result).toContain('</conversation_context>');
    });

    it('should include events in XML format', () => {
      const userData: UserMessageData = {
        message: 'Hello World',
        timestamp: '2025-08-23T10:35:00Z'
      };

      const resultData: CreateProjectResultData = {
        success: true,
        project_id: 'proj_123',
        name: 'AI Project',
        description: 'AI research project',
        importance: '⭐⭐⭐',
        created_at: '2025-08-23T10:35:00Z',
        notion_url: 'https://notion.so/proj_123',
        action_plan: null as any,
        error: null as any,
        execution_time: 1200
      };

      thread.addEvent('user_message', userData);
      thread.addEvent('create_project_result', resultData);

      const result = thread.toPrompt();

      expect(result).toContain('event_count: 2');
      expect(result).toContain('<user_message>');
      expect(result).toContain('message: Hello World');
      expect(result).toContain('</user_message>');
      expect(result).toContain('<create_project_result>');
      expect(result).toContain('success: true');
      expect(result).toContain('project_id: proj_123');
      expect(result).toContain('execution_time: 1200');
      expect(result).toContain('</create_project_result>');
    });

    it('should handle complex conversation flow', () => {
      // Simulate a full conversation
      thread.addEvent('user_message', {
        message: 'プロジェクトを作成したい',
        timestamp: '2025-08-23T10:35:00Z'
      });

      thread.addEvent('user_input', {
        message: 'プロジェクトの詳細を教えてください',
        context: 'project_creation'
      });

      thread.addEvent('user_input_result', {
        success: true,
        user_response: 'AIに関する研究プロジェクト',
        execution_time: 245
      });

      thread.addEvent('create_project', {
        name: 'AI研究プロジェクト',
        description: '機械学習の研究を行う',
        importance: '⭐⭐⭐⭐'
      });

      thread.addEvent('create_project_result', {
        success: true,
        project_id: 'proj_456',
        name: 'AI研究プロジェクト',
        description: '機械学習の研究を行う',
        importance: '⭐⭐⭐⭐',
        created_at: '2025-08-23T10:35:00Z',
        notion_url: 'https://notion.so/proj_456',
        action_plan: null as any,
        error: null as any,
        execution_time: 1200
      });

      const result = thread.toPrompt();

      expect(result).toContain('event_count: 5');
      expect(result).toContain('プロジェクトを作成したい');
      expect(result).toContain('AIに関する研究プロジェクト');
      expect(result).toContain('importance: ⭐⭐⭐⭐');
      expect(result).toMatch(/<user_message>[\s\S]*?<\/user_message>/);
      expect(result).toMatch(/<user_input>[\s\S]*?<\/user_input>/);
      expect(result).toMatch(/<user_input_result>[\s\S]*?<\/user_input_result>/);
      expect(result).toMatch(/<create_project>[\s\S]*?<\/create_project>/);
      expect(result).toMatch(/<create_project_result>[\s\S]*?<\/create_project_result>/);
    });

    it('should format session info as YAML', () => {
      const result = thread.toPrompt();
      
      // Session info should be in YAML format
      expect(result).toMatch(/thread_id: thread_\d+_\w{9}/);
      expect(result).toMatch(/start_time: '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z'/);
      expect(result).toContain('event_count: 0');
    });
  });
});