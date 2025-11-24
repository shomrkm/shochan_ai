import { describe, expect, it } from 'vitest';
import {
  buildProjectCreatePageParams,
  buildTaskCreatePageParams,
  buildTaskUpdatePageParams,
} from './notionUtils';

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
        task_type: { select: { name: '種類A' } },
      });
      expect(params.children?.[0]).toMatchObject({
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: 'Desc' } }] },
      });
      expect(params.properties).not.toHaveProperty('due_date');
      expect(params.properties).not.toHaveProperty('project');
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
        due_date: { date: { start: '2025-01-01' } },
        project: { relation: [{ id: 'proj_123' }] },
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
        name: { title: [{ text: { content: 'P1' } }] },
        importance: { select: { name: 'High' } },
        status: { status: { name: 'Not started' } },
      });
      expect(params.children?.[0]).toMatchObject({
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: 'Project desc' } }] },
      });
      expect(params.properties).not.toHaveProperty('action_plan');
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
        action_plan: { rich_text: [{ text: { content: 'Do X then Y' } }] },
      });
    });
  });

  describe('buildTaskUpdatePageParams', () => {
    it('builds params with only pageId when no updates provided', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
      });

      expect(params.page_id).toBe('page_123');
      expect(params.properties).toEqual({});
    });

    it('updates title when provided', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        title: 'Updated Title',
      });

      expect(params.properties).toMatchObject({
        Name: { title: [{ text: { content: 'Updated Title' } }] },
      });
    });

    it('updates task_type when provided', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        task_type: 'Next Actions',
      });

      expect(params.properties).toMatchObject({
        task_type: { select: { name: 'Next Actions' } },
      });
    });

    it('updates scheduled_date when provided', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        scheduled_date: '2025-02-01',
      });

      expect(params.properties).toMatchObject({
        due_date: { date: { start: '2025-02-01' } },
      });
    });

    it('clears scheduled_date when null is provided', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        scheduled_date: null,
      });

      expect(params.properties.due_date).toBeNull();
    });

    it('updates project_id when provided', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        project_id: 'proj_456',
      });

      expect(params.properties).toMatchObject({
        project: { relation: [{ id: 'proj_456' }] },
      });
    });

    it('clears project relation when null is provided', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        project_id: null,
      });

      expect(params.properties).toMatchObject({
        project: { relation: [] },
      });
    });

    it('updates is_archived when provided', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        is_archived: true,
      });

      expect(params.properties).toMatchObject({
        is_archived: { checkbox: true },
      });
    });

    it('sets is_archived to false when explicitly provided', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        is_archived: false,
      });

      expect(params.properties).toMatchObject({
        is_archived: { checkbox: false },
      });
    });

    it('updates multiple fields simultaneously', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        title: 'Multi Update',
        task_type: 'Today',
        scheduled_date: '2025-03-15',
        project_id: 'proj_789',
        is_archived: false,
      });

      expect(params.page_id).toBe('page_123');
      expect(params.properties).toMatchObject({
        Name: { title: [{ text: { content: 'Multi Update' } }] },
        task_type: { select: { name: 'Today' } },
        due_date: { date: { start: '2025-03-15' } },
        project: { relation: [{ id: 'proj_789' }] },
        is_archived: { checkbox: false },
      });
    });

    it('handles partial updates with some null values', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        title: 'Partial Update',
        scheduled_date: null,
        project_id: null,
      });

      expect(params.properties).toMatchObject({
        Name: { title: [{ text: { content: 'Partial Update' } }] },
        project: { relation: [] },
      });
      expect(params.properties.due_date).toBeNull();
    });

    it('does not include undefined fields in properties', () => {
      const params = buildTaskUpdatePageParams({
        pageId: 'page_123',
        title: 'Only Title',
        task_type: undefined,
        scheduled_date: undefined,
      });

      expect(params.properties).toHaveProperty('Name');
      expect(params.properties).not.toHaveProperty('task_type');
      expect(params.properties).not.toHaveProperty('due_date');
      expect(params.properties).not.toHaveProperty('project');
    });
  });
});
