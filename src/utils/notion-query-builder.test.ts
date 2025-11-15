import { describe, expect, it } from 'vitest';
import { NotionQueryBuilder } from './notion-query-builder';

describe('NotionQueryBuilder', () => {
  const builder = new NotionQueryBuilder();

  describe('buildTaskQuery', () => {
    describe('filter construction', () => {
      it('builds query with default completion filter when empty object is provided', () => {
        const result = builder.buildTaskQuery({});

        // By default, excludes completed tasks when include_completed is not specified
        expect(result.filter).toEqual({
          and: [
            {
              property: 'is_completed',
              formula: {
                checkbox: {
                  equals: false,
                },
              },
            },
          ],
        });
        expect(result.sorts).toBeUndefined();
      });

      it('builds filter for task_type', () => {
        const result = builder.buildTaskQuery({
          task_type: 'タスク',
          include_completed: true, // Explicitly include completed to avoid default filter
        });

        expect(result.filter).toEqual({
          and: [
            {
              property: 'task_type',
              select: { equals: 'タスク' },
            },
          ],
        });
      });

      it('builds filter for project_id', () => {
        const result = builder.buildTaskQuery({
          project_id: 'proj_123',
          include_completed: true, // Explicitly include completed to avoid default filter
        });

        expect(result.filter).toEqual({
          and: [
            {
              property: 'project',
              relation: { contains: 'proj_123' },
            },
          ],
        });
      });

      it('builds filter for search_title', () => {
        const result = builder.buildTaskQuery({
          search_title: 'テスト',
          include_completed: true, // Explicitly include completed to avoid default filter
        });

        expect(result.filter).toEqual({
          and: [
            {
              property: 'Name',
              title: { contains: 'テスト' },
            },
          ],
        });
      });

      it('builds filter to exclude completed tasks when include_completed is false', () => {
        const result = builder.buildTaskQuery({
          include_completed: false,
        });

        expect(result.filter).toEqual({
          and: [
            {
              property: 'is_completed',
              formula: {
                checkbox: {
                  equals: false,
                },
              },
            },
          ],
        });
      });

      it('does not add completion filter when include_completed is true', () => {
        const result = builder.buildTaskQuery({
          include_completed: true,
        });

        expect(result.filter).toBeUndefined();
      });

      it('builds combined filters when multiple filter parameters are provided', () => {
        const result = builder.buildTaskQuery({
          task_type: 'タスク',
          project_id: 'proj_456',
          search_title: '重要',
          include_completed: false,
        });

        expect(result.filter).toEqual({
          and: [
            {
              property: 'task_type',
              select: { equals: 'タスク' },
            },
            {
              property: 'project',
              relation: { contains: 'proj_456' },
            },
            {
              property: 'Name',
              title: { contains: '重要' },
            },
            {
              property: 'is_completed',
              formula: {
                checkbox: {
                  equals: false,
                },
              },
            },
          ],
        });
      });

      it('handles empty string values in filters (empty strings are falsy, no filter added)', () => {
        const result = builder.buildTaskQuery({
          task_type: '',
          search_title: '',
          include_completed: true, // Explicitly include completed to avoid default filter
        });

        // Empty strings are falsy in the if conditions, so no filters are added
        expect(result.filter).toBeUndefined();
      });
    });

    describe('sort construction', () => {
      it('builds sort by created_at with ascending order', () => {
        const result = builder.buildTaskQuery({
          sort_by: 'created_at',
          sort_order: 'asc',
        });

        expect(result.sorts).toEqual([
          {
            timestamp: 'created_time',
            direction: 'ascending',
          },
        ]);
      });

      it('builds sort by created_at with descending order', () => {
        const result = builder.buildTaskQuery({
          sort_by: 'created_at',
          sort_order: 'desc',
        });

        expect(result.sorts).toEqual([
          {
            timestamp: 'created_time',
            direction: 'descending',
          },
        ]);
      });

      it('builds sort by updated_at with ascending order', () => {
        const result = builder.buildTaskQuery({
          sort_by: 'updated_at',
          sort_order: 'asc',
        });

        expect(result.sorts).toEqual([
          {
            timestamp: 'last_edited_time',
            direction: 'ascending',
          },
        ]);
      });

      it('builds sort by updated_at with descending order', () => {
        const result = builder.buildTaskQuery({
          sort_by: 'updated_at',
          sort_order: 'desc',
        });

        expect(result.sorts).toEqual([
          {
            timestamp: 'last_edited_time',
            direction: 'descending',
          },
        ]);
      });

      it('builds sort by scheduled_date as property sort', () => {
        const result = builder.buildTaskQuery({
          sort_by: 'scheduled_date',
          sort_order: 'asc',
        });

        expect(result.sorts).toEqual([
          {
            property: 'due_date',
            direction: 'ascending',
          },
        ]);
      });

      it('defaults to descending when sort_order is not provided', () => {
        const result = builder.buildTaskQuery({
          sort_by: 'created_at',
        });

        expect(result.sorts).toEqual([
          {
            timestamp: 'created_time',
            direction: 'descending',
          },
        ]);
      });

      it('defaults to created_time timestamp sort when sort_by is unknown', () => {
        const result = builder.buildTaskQuery({
          sort_by: 'unknown_field',
          sort_order: 'asc',
        });

        expect(result.sorts).toEqual([
          {
            timestamp: 'created_time',
            direction: 'ascending',
          },
        ]);
      });

      it('does not add sorts when sort_by is not provided', () => {
        const result = builder.buildTaskQuery({
          sort_order: 'asc',
        });

        expect(result.sorts).toBeUndefined();
      });
    });

    describe('combined filters and sorts', () => {
      it('builds query with both filters and sorts', () => {
        const result = builder.buildTaskQuery({
          task_type: 'メモ',
          include_completed: false,
          sort_by: 'updated_at',
          sort_order: 'desc',
        });

        expect(result.filter).toEqual({
          and: [
            {
              property: 'task_type',
              select: { equals: 'メモ' },
            },
            {
              property: 'is_completed',
              formula: {
                checkbox: {
                  equals: false,
                },
              },
            },
          ],
        });

        expect(result.sorts).toEqual([
          {
            timestamp: 'last_edited_time',
            direction: 'descending',
          },
        ]);
      });

      it('builds complex query with all parameters', () => {
        const result = builder.buildTaskQuery({
          task_type: 'プロジェクト',
          project_id: 'proj_789',
          search_title: '優先',
          include_completed: false,
          sort_by: 'scheduled_date',
          sort_order: 'asc',
        });

        expect(result.filter?.and).toHaveLength(4);
        expect(result.sorts).toHaveLength(1);
        expect(result.sorts?.[0]).toMatchObject({
          property: 'due_date',
          direction: 'ascending',
        });
      });
    });

    describe('edge cases', () => {
      it('handles undefined values gracefully', () => {
        const result = builder.buildTaskQuery({
          task_type: undefined,
          project_id: undefined,
          search_title: undefined,
          include_completed: true, // Explicitly include completed to avoid default filter
        });

        expect(result.filter).toBeUndefined();
        expect(result.sorts).toBeUndefined();
      });

      it('handles null values as falsy (no filters added)', () => {
        // biome-ignore lint/suspicious/noExplicitAny: Testing null handling
        const result = builder.buildTaskQuery({
          task_type: null as any,
          project_id: null as any,
          include_completed: true, // Explicitly include completed to avoid default filter
        });

        expect(result.filter).toBeUndefined();
      });

      it('preserves special characters in filter values', () => {
        const result = builder.buildTaskQuery({
          search_title: '特殊文字 @#$%^&*()',
          include_completed: true, // Explicitly include completed to avoid default filter
        });

        expect(result.filter).toEqual({
          and: [
            {
              property: 'Name',
              title: { contains: '特殊文字 @#$%^&*()' },
            },
          ],
        });
      });
    });
  });
});
