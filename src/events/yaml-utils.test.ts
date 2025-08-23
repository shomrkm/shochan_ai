import { describe, it, expect } from 'vitest';
import { YamlUtils } from './yaml-utils';
import type { CreateProjectData, CreateTaskData, UserMessageData } from './types';

describe('YamlUtils', () => {
  describe('formatToYaml', () => {
    it('should format simple object to YAML with correct indentation', () => {
      const data: UserMessageData = {
        message: 'Hello World',
        timestamp: '2025-08-23T10:35:00Z'
      };

      const result = YamlUtils.formatToYaml(data);
      
      expect(result).toBe(`message: Hello World
timestamp: '2025-08-23T10:35:00Z'`);
    });

    it('should handle Japanese text correctly', () => {
      const data: CreateTaskData = {
        title: '新しいタスク',
        description: 'タスクの説明です',
        task_type: 'Today'
      };

      const result = YamlUtils.formatToYaml(data);
      
      expect(result).toContain('title: 新しいタスク');
      expect(result).toContain('description: タスクの説明です');
      expect(result).toContain('task_type: Today');
    });

    it('should handle null values correctly', () => {
      const data: CreateProjectData = {
        name: 'Test Project',
        description: 'A test project',
        importance: '⭐⭐⭐',
        action_plan: null as any
      };

      const result = YamlUtils.formatToYaml(data);
      
      expect(result).toContain('action_plan: null');
    });

    it('should handle star characters in importance field', () => {
      const data: CreateProjectData = {
        name: 'AI Project',
        description: 'AI research project',
        importance: '⭐⭐⭐⭐⭐'
      };

      const result = YamlUtils.formatToYaml(data);
      
      expect(result).toContain('importance: ⭐⭐⭐⭐⭐');
    });

    it('should preserve data types correctly', () => {
      const data = {
        success: true,
        execution_time: 1200,
        task_id: 'task_123',
        count: 0
      };

      const result = YamlUtils.formatToYaml(data);
      
      expect(result).toContain('success: true');
      expect(result).toContain('execution_time: 1200');
      expect(result).toContain('task_id: task_123');
      expect(result).toContain('count: 0');
    });

    it('should handle string input directly', () => {
      const data = 'Simple string data';

      const result = YamlUtils.formatToYaml(data);
      
      expect(result).toBe('Simple string data');
    });
  });

  describe('generateXMLTag', () => {
    it('should generate XML tag with YAML content', () => {
      const tagName = 'create_project';
      const data: CreateProjectData = {
        name: 'Test Project',
        description: 'Project description',
        importance: '⭐⭐⭐'
      };

      const result = YamlUtils.generateXMLTag(tagName, data);
      
      expect(result).toBe(`<create_project>
name: Test Project
description: Project description
importance: ⭐⭐⭐
</create_project>`);
    });

    it('should handle empty data', () => {
      const emptyData: Record<string, never> = {};
      const result = YamlUtils.generateXMLTag('empty_event', emptyData);
      
      expect(result).toBe(`<empty_event>
{}
</empty_event>`);
    });
  });
});