import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { describe, expect, it, vi } from 'vitest';
import { NotionTaskParser } from './notion-task-parser';

describe('NotionTaskParser', () => {
  const parser = new NotionTaskParser();

  // Helper function to create mock Notion page response
  const createMockPageResponse = (overrides?: Partial<PageObjectResponse>): PageObjectResponse => {
    const base: PageObjectResponse = {
      object: 'page',
      id: 'test-page-id',
      created_time: '2025-01-01T00:00:00.000Z',
      last_edited_time: '2025-01-02T00:00:00.000Z',
      created_by: { object: 'user', id: 'user-id' },
      last_edited_by: { object: 'user', id: 'user-id' },
      cover: null,
      icon: null,
      parent: { type: 'database_id', database_id: 'db-id' },
      archived: false,
      in_trash: false,
      properties: {
        Name: {
          id: 'title',
          type: 'title',
          title: [
            {
              type: 'text',
              text: { content: 'Test Task', link: null },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default',
              },
              plain_text: 'Test Task',
              href: null,
            },
          ],
        },
        Description: {
          id: 'desc',
          type: 'rich_text',
          rich_text: [
            {
              type: 'text',
              text: { content: 'Test description', link: null },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default',
              },
              plain_text: 'Test description',
              href: null,
            },
          ],
        },
        task_type: {
          id: 'task-type',
          type: 'select',
          select: { id: 'opt-1', name: 'Today', color: 'blue' },
        },
        due_date: {
          id: 'due',
          type: 'date',
          date: { start: '2025-01-15', end: null, time_zone: null },
        },
        project: {
          id: 'proj',
          type: 'relation',
          relation: [{ id: 'project-123' }],
        },
        'Project Name': {
          id: 'proj-name',
          type: 'rich_text',
          rich_text: [
            {
              type: 'text',
              text: { content: 'My Project', link: null },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default',
              },
              plain_text: 'My Project',
              href: null,
            },
          ],
        },
        is_completed: {
          id: 'completed',
          type: 'formula',
          formula: { type: 'boolean', boolean: false },
        },
      },
      url: 'https://notion.so/test-page-id',
      public_url: null,
    };

    return { ...base, ...overrides };
  };

  describe('parseTaskFromNotionPage', () => {
    it('parses a complete Notion page response into TaskInfo', () => {
      const mockPage = createMockPageResponse();
      const result = parser.parseTaskFromNotionPage(mockPage);

      expect(result).toEqual({
        task_id: 'test-page-id',
        title: 'Test Task',
        description: 'Test description',
        task_type: 'Today',
        scheduled_date: '2025-01-15',
        project_id: 'project-123',
        project_name: 'My Project',
        created_at: new Date('2025-01-01T00:00:00.000Z'),
        updated_at: new Date('2025-01-02T00:00:00.000Z'),
        notion_url: 'https://notion.so/test-page-id',
        status: 'active',
      });
    });

    it('handles task with completed status', () => {
      const mockPage = createMockPageResponse({
        properties: {
          ...createMockPageResponse().properties,
          is_completed: {
            id: 'completed',
            type: 'formula',
            formula: { type: 'boolean', boolean: true },
          },
        },
      });

      const result = parser.parseTaskFromNotionPage(mockPage);

      expect(result.status).toBe('completed');
    });

    it('uses default value "Untitled Task" when Name property is missing', () => {
      const mockPage = createMockPageResponse({
        properties: {
          ...createMockPageResponse().properties,
          Name: {
            id: 'title',
            type: 'title',
            title: [],
          },
        },
      });

      const result = parser.parseTaskFromNotionPage(mockPage);

      expect(result.title).toBe('Untitled Task');
    });

    it('uses empty string for description when Description property is missing', () => {
      const mockPage = createMockPageResponse({
        properties: {
          ...createMockPageResponse().properties,
          Description: {
            id: 'desc',
            type: 'rich_text',
            rich_text: [],
          },
        },
      });

      const result = parser.parseTaskFromNotionPage(mockPage);

      expect(result.description).toBe('');
    });

    it('handles missing optional properties gracefully', () => {
      const mockPage = createMockPageResponse({
        properties: {
          Name: {
            id: 'title',
            type: 'title',
            title: [
              {
                type: 'text',
                text: { content: 'Minimal Task', link: null },
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: 'default',
                },
                plain_text: 'Minimal Task',
                href: null,
              },
            ],
          },
          Description: {
            id: 'desc',
            type: 'rich_text',
            rich_text: [],
          },
          task_type: {
            id: 'task-type',
            type: 'select',
            select: null,
          },
          due_date: {
            id: 'due',
            type: 'date',
            date: null,
          },
          project: {
            id: 'proj',
            type: 'relation',
            relation: [],
          },
          is_completed: {
            id: 'completed',
            type: 'formula',
            formula: { type: 'boolean', boolean: false },
          },
        },
      });

      const result = parser.parseTaskFromNotionPage(mockPage);

      expect(result.scheduled_date).toBeUndefined();
      expect(result.project_id).toBeUndefined();
      expect(result.project_name).toBeUndefined();
    });
  });

  describe('parseTasksFromNotionResponse', () => {
    it('parses multiple valid page responses', async () => {
      const mockPages = [
        createMockPageResponse({ id: 'page-1' }),
        createMockPageResponse({ id: 'page-2' }),
        createMockPageResponse({ id: 'page-3' }),
      ];

      const results = await parser.parseTasksFromNotionResponse(mockPages);

      expect(results).toHaveLength(3);
      expect(results[0].task_id).toBe('page-1');
      expect(results[1].task_id).toBe('page-2');
      expect(results[2].task_id).toBe('page-3');
    });

    it('filters out partial page responses', async () => {
      const mockPages = [
        createMockPageResponse({ id: 'full-page-1' }),
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid data
        { object: 'page', id: 'partial-page' } as any, // Partial response without required fields
        createMockPageResponse({ id: 'full-page-2' }),
      ];

      const results = await parser.parseTasksFromNotionResponse(mockPages);

      expect(results).toHaveLength(2);
      expect(results[0].task_id).toBe('full-page-1');
      expect(results[1].task_id).toBe('full-page-2');
    });

    it('continues parsing even when one task fails', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockPages = [
        createMockPageResponse({ id: 'valid-page-1' }),
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid data
        { object: 'page', id: 'invalid-page', properties: null } as any, // This will be filtered out by isFullPageResponse
        createMockPageResponse({ id: 'valid-page-2' }),
      ];

      const results = await parser.parseTasksFromNotionResponse(mockPages);

      // Invalid page is filtered out by isFullPageResponse, so only 2 valid pages remain
      expect(results).toHaveLength(2);
      expect(results[0].task_id).toBe('valid-page-1');
      expect(results[1].task_id).toBe('valid-page-2');
      // Since invalid page is filtered before parsing, warn is not called
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('returns empty array when no valid pages are provided', async () => {
      const results = await parser.parseTasksFromNotionResponse([]);

      expect(results).toEqual([]);
    });
  });

  describe('isFullPageResponse', () => {
    it('returns true for valid full page response', () => {
      const mockPage = createMockPageResponse();

      expect(parser.isFullPageResponse(mockPage)).toBe(true);
    });

    it('returns false for partial page response', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid data
      const partialPage = { object: 'page', id: 'test-id' } as any;

      expect(parser.isFullPageResponse(partialPage)).toBe(false);
    });

    it('returns false for non-page objects', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid data
      const nonPage = { object: 'database', id: 'db-id' } as any;

      expect(parser.isFullPageResponse(nonPage)).toBe(false);
    });

    it('returns false for null or undefined', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid data
      expect(parser.isFullPageResponse(null as any)).toBe(false);
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid data
      expect(parser.isFullPageResponse(undefined as any)).toBe(false);
    });

    it('returns false when missing required fields', () => {
      const missingCreatedTime = {
        object: 'page',
        id: 'test-id',
        url: 'https://notion.so/test',
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid data
      } as any;

      expect(parser.isFullPageResponse(missingCreatedTime)).toBe(false);
    });
  });

  describe('parseContentFromBlocks', () => {
    it('parses paragraph blocks with rich_text', () => {
      const blocks = [
        {
          object: 'block',
          id: 'block-1',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'First paragraph' }, { plain_text: ' continued' }],
          },
        },
        {
          object: 'block',
          id: 'block-2',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'Second paragraph' }],
          },
        },
      ];

      const result = parser.parseContentFromBlocks(blocks);

      expect(result).toBe('First paragraph continued\nSecond paragraph');
    });

    it('parses heading blocks', () => {
      const blocks = [
        {
          object: 'block',
          id: 'block-1',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ plain_text: 'Main Title' }],
          },
        },
        {
          object: 'block',
          id: 'block-2',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ plain_text: 'Subtitle' }],
          },
        },
      ];

      const result = parser.parseContentFromBlocks(blocks);

      expect(result).toBe('Main Title\nSubtitle');
    });

    it('parses bulleted list items', () => {
      const blocks = [
        {
          object: 'block',
          id: 'block-1',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ plain_text: 'First item' }],
          },
        },
        {
          object: 'block',
          id: 'block-2',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ plain_text: 'Second item' }],
          },
        },
      ];

      const result = parser.parseContentFromBlocks(blocks);

      expect(result).toBe('First item\nSecond item');
    });

    it('handles blocks with text property instead of rich_text', () => {
      const blocks = [
        {
          object: 'block',
          id: 'block-1',
          type: 'code',
          code: {
            text: [{ plain_text: 'console.log("hello");' }],
          },
        },
      ];

      const result = parser.parseContentFromBlocks(blocks);

      expect(result).toBe('console.log("hello");');
    });

    it('handles blocks with caption property', () => {
      const blocks = [
        {
          object: 'block',
          id: 'block-1',
          type: 'image',
          image: {
            caption: [{ plain_text: 'Image caption' }],
          },
        },
      ];

      const result = parser.parseContentFromBlocks(blocks);

      expect(result).toBe('Image caption');
    });

    it('skips blocks with no extractable text', () => {
      const blocks = [
        {
          object: 'block',
          id: 'block-1',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'Valid text' }],
          },
        },
        {
          object: 'block',
          id: 'block-2',
          type: 'divider',
          divider: {},
        },
        {
          object: 'block',
          id: 'block-3',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'More valid text' }],
          },
        },
      ];

      const result = parser.parseContentFromBlocks(blocks);

      expect(result).toBe('Valid text\nMore valid text');
    });

    it('handles empty blocks array', () => {
      const result = parser.parseContentFromBlocks([]);

      expect(result).toBe('');
    });

    it('continues parsing when a block fails', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const blocks = [
        {
          object: 'block',
          id: 'block-1',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'Valid block' }],
          },
        },
        { id: 'invalid-block' }, // Invalid block - will be filtered by isValidBlock
        {
          object: 'block',
          id: 'block-3',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'Another valid block' }],
          },
        },
      ];

      const result = parser.parseContentFromBlocks(blocks);

      expect(result).toBe('Valid block\nAnother valid block');
      // Invalid block is filtered by isValidBlock, so warn is not called
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('handles blocks with empty rich_text arrays', () => {
      const blocks = [
        {
          object: 'block',
          id: 'block-1',
          type: 'paragraph',
          paragraph: {
            rich_text: [],
          },
        },
      ];

      const result = parser.parseContentFromBlocks(blocks);

      expect(result).toBe('');
    });

    it('handles mixed content types correctly', () => {
      const blocks = [
        {
          object: 'block',
          id: 'block-1',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ plain_text: 'Title' }],
          },
        },
        {
          object: 'block',
          id: 'block-2',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'Some text' }],
          },
        },
        {
          object: 'block',
          id: 'block-3',
          type: 'code',
          code: {
            text: [{ plain_text: 'const x = 1;' }],
          },
        },
        {
          object: 'block',
          id: 'block-4',
          type: 'image',
          image: {
            caption: [{ plain_text: 'Figure 1' }],
          },
        },
      ];

      const result = parser.parseContentFromBlocks(blocks);

      expect(result).toBe('Title\nSome text\nconst x = 1;\nFigure 1');
    });
  });

  describe('edge cases', () => {
    it('handles special characters in text content', () => {
      const mockPage = createMockPageResponse({
        properties: {
          ...createMockPageResponse().properties,
          Name: {
            id: 'title',
            type: 'title',
            title: [
              {
                type: 'text',
                text: { content: '特殊文字 @#$%^&*()', link: null },
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: 'default',
                },
                plain_text: '特殊文字 @#$%^&*()',
                href: null,
              },
            ],
          },
        },
      });

      const result = parser.parseTaskFromNotionPage(mockPage);

      expect(result.title).toBe('特殊文字 @#$%^&*()');
    });

    it('handles very long text content', () => {
      const longText = 'a'.repeat(10000);
      const mockPage = createMockPageResponse({
        properties: {
          ...createMockPageResponse().properties,
          Name: {
            id: 'title',
            type: 'title',
            title: [
              {
                type: 'text',
                text: { content: longText, link: null },
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: 'default',
                },
                plain_text: longText,
                href: null,
              },
            ],
          },
        },
      });

      const result = parser.parseTaskFromNotionPage(mockPage);

      expect(result.title).toBe(longText);
      expect(result.title.length).toBe(10000);
    });

    it('handles Date objects correctly', () => {
      const mockPage = createMockPageResponse({
        created_time: '2025-12-31T23:59:59.999Z',
        last_edited_time: '2025-12-31T23:59:59.999Z',
      });

      const result = parser.parseTaskFromNotionPage(mockPage);

      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.created_at.toISOString()).toBe('2025-12-31T23:59:59.999Z');
    });
  });
});
