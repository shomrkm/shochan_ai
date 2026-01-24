import type {
  CreatePageParameters,
  UpdatePageParameters,
} from '@notionhq/client/build/src/api-endpoints';

export interface BuildTaskPageParamsArgs {
  databaseId: string;
  title: string;
  description?: string;
  task_type?: string;
  scheduled_date?: string;
  project_id?: string;
}

export interface BuildProjectPageParamsArgs {
  databaseId: string;
  name: string;
  description: string;
  importance: string;
  action_plan?: string;
}

export interface BuildTaskUpdatePageParamsArgs {
  pageId: string;
  title?: string;
  task_type?: string;
  scheduled_date?: string | null;
  project_id?: string | null;
  is_archived?: boolean;
}

/**
 * Parameters for creating a Notion page.
 * Uses official Notion SDK types for type safety.
 */
export type NotionCreatePageParams = CreatePageParameters;

/**
 * Type for individual Notion property values.
 * Extracted from official SDK UpdatePageParameters.
 */
type NotionPropertyValue = NonNullable<UpdatePageParameters['properties']>[string];

export interface NotionUpdatePageParams {
  page_id: string;
  properties: Record<string, NotionPropertyValue | null>;
  archived?: boolean;
}
