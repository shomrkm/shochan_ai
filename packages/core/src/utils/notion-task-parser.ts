/**
 * NotionTaskParser - Responsible for parsing Notion API responses into TaskInfo objects
 *
 * This class handles the conversion of raw Notion page responses to structured TaskInfo objects,
 * including property extraction and data transformation.
 */

import type {
  PageObjectResponse,
  CreatePageResponse,
  QueryDatabaseResponse,
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import type { TaskInfo } from '../types/task';

type NotionPageResponse = QueryDatabaseResponse['results'][number];

/**
 * Parses Notion API responses into TaskInfo objects
 */
export class NotionTaskParser {
  /**
   * Parse multiple tasks from Notion query response
   */
  async parseTasksFromNotionResponse(results: NotionPageResponse[]): Promise<TaskInfo[]> {
    const tasks: TaskInfo[] = [];

    for (const result of results) {
      if (!this.isFullPageResponse(result)) continue;

      try {
        const task = this.parseTaskFromNotionPage(result);
        tasks.push(task);
      } catch (error) {
        console.warn(`Failed to parse task ${result.id}:`, error);
        // Continue processing other tasks
      }
    }

    return tasks;
  }

  /**
   * Parse single task from Notion page response
   */
  parseTaskFromNotionPage(page: PageObjectResponse): TaskInfo {
    const properties = page.properties;

    // Extract basic task information
    const title = this.extractTextFromProperty(properties, 'Name') || 'Untitled Task';
    const description = this.extractTextFromProperty(properties, 'Description') || '';
    const task_type = this.extractSelectFromProperty(properties, 'task_type') || '';

    // Extract dates
    const scheduled_date = this.extractDateFromProperty(properties, 'due_date');

    // Extract project information
    const project_id = this.extractRelationFromProperty(properties, 'project');
    const project_name = this.extractTextFromProperty(properties, 'Project Name'); // If available

    // Extract status from formula property
    const completed = this.extractFormulaFromProperty(properties, 'is_completed') || false;

    return {
      task_id: page.id,
      title,
      description,
      task_type: task_type as TaskInfo['task_type'],
      scheduled_date,
      project_id,
      project_name,
      created_at: new Date(page.created_time),
      updated_at: new Date(page.last_edited_time),
      notion_url: page.url,
      status: completed ? 'completed' : 'active',
    };
  }

  /**
   * Parse content from Notion blocks array
   */
  parseContentFromBlocks(blocks: any[]): string {
    const content: string[] = [];

    for (const block of blocks) {
      try {
        const text = this.extractTextFromBlock(block);
        if (text) {
          content.push(text);
        }
      } catch (error) {
        console.warn(`Failed to parse block ${block.id}:`, error);
      }
    }

    return content.join('\n');
  }

  /**
   * Type guard to check if response is a full page response
   */
  isFullPageResponse(response: NotionPageResponse): response is PageObjectResponse {
    return (
      typeof response === 'object' &&
      response !== null &&
      'object' in response &&
      response.object === 'page' &&
      'created_time' in response &&
      'url' in response
    );
  }

  // ===== Private Property Extraction Methods =====

  private extractTextFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop) return undefined;

    if (prop.type === 'title' && prop.title.length > 0) {
      return prop.title[0].plain_text;
    }
    if (prop.type === 'rich_text' && prop.rich_text.length > 0) {
      return prop.rich_text[0].plain_text;
    }

    return undefined;
  }

  private extractSelectFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'select') return undefined;

    return prop.select?.name;
  }

  private extractDateFromProperty(properties: any, propertyName: string): string | undefined {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'date') return undefined;

    return prop.date?.start;
  }

  private extractRelationFromProperty(
    properties: PageObjectResponse['properties'],
    propertyName: string
  ): string | undefined {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'relation') return undefined;

    return prop.relation.length > 0 ? prop.relation[0].id : undefined;
  }

  private extractFormulaFromProperty(properties: any, propertyName: string): boolean {
    const prop = properties[propertyName];
    if (!prop || prop.type !== 'formula') return false;

    return prop.formula?.boolean || false;
  }

  private extractTextFromBlock(
    block: BlockObjectResponse | PartialBlockObjectResponse
  ): string | null {
    if (!this.isValidBlock(block)) return null;

    const blockType = block.type;
    const blockData = this.getBlockData(block, blockType);

    if (!blockData || typeof blockData !== 'object') return null;

    if (this.hasRichText(blockData)) {
      return blockData.rich_text
        .map((text: { plain_text?: string }) => text.plain_text || '')
        .join('');
    }

    if (this.hasText(blockData)) {
      return blockData.text.map((text: { plain_text?: string }) => text.plain_text || '').join('');
    }

    if (this.hasCaption(blockData)) {
      return blockData.caption
        .map((text: { plain_text?: string }) => text.plain_text || '')
        .join('');
    }

    return null;
  }

  private isValidBlock(block: unknown): block is { type: string } {
    return (
      typeof block === 'object' &&
      block !== null &&
      'type' in block &&
      typeof (block as { type: unknown }).type === 'string'
    );
  }

  private getBlockData(block: { type: string }, blockType: string): unknown {
    return (block as Record<string, unknown>)[blockType];
  }

  private hasRichText(
    blockData: object
  ): blockData is { rich_text: Array<{ plain_text?: string }> } {
    return (
      'rich_text' in blockData && Array.isArray((blockData as { rich_text: unknown }).rich_text)
    );
  }

  private hasText(blockData: object): blockData is { text: Array<{ plain_text?: string }> } {
    return 'text' in blockData && Array.isArray((blockData as { text: unknown }).text);
  }

  private hasCaption(blockData: object): blockData is { caption: Array<{ plain_text?: string }> } {
    return 'caption' in blockData && Array.isArray((blockData as { caption: unknown }).caption);
  }
}
