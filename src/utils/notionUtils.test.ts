import { describe, expect, it } from 'vitest';
import { buildProjectCreatePageParams, buildTaskCreatePageParams } from './notionUtils';

describe('notionUtils', () => {
  describe('buildTaskCreatePageParams', () => {
    it('builds params with required fields only', () => {
      const params = buildTaskCreatePageParams({
        databaseId: 'db_tasks',
        title: 'T1',
        description: 'Desc',
        task_type: '種類A',
      });

      expect(params.parent).toEqual({ database_id: 'db_tasks' });
      expect(params.properties).toMatchObject({
        Name: { title: [{ text: { content: 'T1' } }] },
        タスク種別: { select: { name: '種類A' } },
      });
      expect(params.children?.[0]).toMatchObject({
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: 'Desc' } }] },
      });
      expect(params.properties).not.toHaveProperty('実施予定日');
      expect(params.properties).not.toHaveProperty('プロジェクト');
    });

    it('includes optional scheduled_date and project_id when provided', () => {
      const params = buildTaskCreatePageParams({
        databaseId: 'db_tasks',
        title: 'T2',
        description: 'Body',
        task_type: '種類B',
        scheduled_date: '2025-01-01',
        project_id: 'proj_123',
      });

      expect(params.properties).toMatchObject({
        実施予定日: { date: { start: '2025-01-01' } },
        プロジェクト: { relation: [{ id: 'proj_123' }] },
      });
    });
  });

  describe('buildProjectCreatePageParams', () => {
    it('builds params with required fields only', () => {
      const params = buildProjectCreatePageParams({
        databaseId: 'db_projects',
        name: 'P1',
        description: 'Project desc',
        importance: 'High',
      });

      expect(params.parent).toEqual({ database_id: 'db_projects' });
      expect(params.properties).toMatchObject({
        名前: { title: [{ text: { content: 'P1' } }] },
        重要度: { select: { name: 'High' } },
        ステータス: { status: { name: 'Not started' } },
      });
      expect(params.children?.[0]).toMatchObject({
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: 'Project desc' } }] },
      });
      expect(params.properties).not.toHaveProperty('アクションプラン');
    });

    it('includes optional action_plan when provided', () => {
      const params = buildProjectCreatePageParams({
        databaseId: 'db_projects',
        name: 'P2',
        description: 'With plan',
        importance: 'Medium',
        action_plan: 'Do X then Y',
      });

      expect(params.properties).toMatchObject({
        アクションプラン: { rich_text: [{ text: { content: 'Do X then Y' } }] },
      });
    });
  });
});
