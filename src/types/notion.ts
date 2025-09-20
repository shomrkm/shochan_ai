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

export interface BuildTaskUpdatePageParamsArgs {
  pageId: string;
  title?: string;
  task_type?: string;
  scheduled_date?: string | null;
  project_id?: string | null;
  is_archived?: boolean;
}

export interface NotionCreatePageParams {
  parent: {
    database_id: string;
  };
  properties: Record<string, any>;
  children: Array<{
    object: 'block';
    type: 'paragraph';
    paragraph: {
      rich_text: Array<{
        type: 'text';
        text: {
          content: string;
        };
      }>;
    };
  }>;
}

export interface NotionUpdatePageParams {
  page_id: string;
  properties: Record<string, any>;
  archived?: boolean;
}
