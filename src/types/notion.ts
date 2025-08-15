// Types for building Notion client.pages.create parameters in a type-safe way
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';

export type NotionCreatePageParams = CreatePageParameters;

export interface BuildTaskPageParamsArgs {
  databaseId: string;
  title: string;
  description: string;
  task_type: string;
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
