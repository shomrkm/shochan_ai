/**
 * NotionQueryBuilder - Responsible for building Notion database queries
 *
 * This class handles the construction of Notion API query objects,
 * including filters, sorts, and property mappings.
 */

import type { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';

/**
 * Builds Notion database queries for task retrieval
 */
export class NotionQueryBuilder {
  /**
   * Build complete Notion query object with filters and sorts
   */
  buildTaskQuery(filters: TaskQueryFilters): Pick<QueryDatabaseParameters, 'filter' | 'sorts'> {
    const notionFilters: NotionFilter[] = [];

    // Task type filter
    if (filters.task_type) {
      notionFilters.push({
        property: 'task_type',
        select: { equals: filters.task_type },
      });
    }

    // Project filter
    if (filters.project_id) {
      notionFilters.push({
        property: 'project',
        relation: { contains: filters.project_id },
      });
    }

    // Completion status filter (using formula property with checkbox filter)
    if (!filters.include_completed) {
      notionFilters.push({
        property: 'is_completed',
        formula: {
          checkbox: {
            equals: false,
          },
        },
      });
    }

    // Build sorts
    const sorts: NotionSort[] = [];
    if (filters.sort_by) {
      const sortConfig = this.mapSortFieldToNotionProperty(filters.sort_by);
      const direction =
        filters.sort_order === 'asc' ? ('ascending' as const) : ('descending' as const);

      if (sortConfig.type === 'timestamp') {
        sorts.push({
          timestamp: sortConfig.name as 'created_time' | 'last_edited_time',
          direction,
        });
      } else {
        sorts.push({
          property: sortConfig.name,
          direction,
        });
      }
    }

    return {
      filter: notionFilters.length > 0 ? { and: notionFilters } : undefined,
      sorts: sorts.length > 0 ? sorts : undefined,
    };
  }

  /**
   * Map sort field to Notion property/timestamp name
   */
  private mapSortFieldToNotionProperty(sortField: string): SortMapping {
    const mapping: Record<string, SortMapping> = {
      created_at: { type: 'timestamp', name: 'created_time' },
      updated_at: { type: 'timestamp', name: 'last_edited_time' },
      scheduled_date: { type: 'property', name: 'due_date' },
    };

    return mapping[sortField] || { type: 'timestamp', name: 'created_time' };
  }
}

interface TaskQueryFilters {
  task_type?: string;
  project_id?: string;
  include_completed?: boolean;
  sort_by?: string;
  sort_order?: string;
}

// Extract filter types from official Notion API types
type ExtractFilterArray<T> = T extends { and: infer U } ? U : never;
type FilterArray = ExtractFilterArray<NonNullable<QueryDatabaseParameters['filter']>>;
type PropertyFilterType = FilterArray extends Array<infer U> ? U : never;

// Extract specific filter types using utility types
type SelectFilter = Extract<PropertyFilterType, { select: any }>;
type RelationFilter = Extract<PropertyFilterType, { relation: any }>;
type FormulaFilter = Extract<PropertyFilterType, { formula: any }>;

type NotionFilter = SelectFilter | RelationFilter | FormulaFilter;

// Use official Notion sort types
type NotionSort = NonNullable<QueryDatabaseParameters['sorts']>[number];

interface SortMapping {
  type: 'property' | 'timestamp';
  name: string;
}
