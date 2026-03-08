import type {
  BuildProjectPageParamsArgs,
  BuildTaskPageParamsArgs,
  BuildTaskUpdatePageParamsArgs,
  NotionCreatePageParams,
  NotionUpdatePageParams,
  ProjectInfo,
} from '@shochan_ai/core';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

type NotionPropertyUpdates = NotionUpdatePageParams['properties'];

export function buildTaskCreatePageParams(args: BuildTaskPageParamsArgs): NotionCreatePageParams {
  const { databaseId, title, description, task_type, scheduled_date, project_id } = args;

  return {
    parent: {
      database_id: databaseId,
    },
    properties: {
      Name: {
        title: [
          {
            text: {
              content: title,
            },
          },
        ],
      },
      ...(task_type
        ? {
            task_type: {
              select: {
                name: task_type,
              },
            },
          }
        : {}),
      ...(scheduled_date
        ? {
            due_date: {
              date: {
                start: scheduled_date,
              },
            },
          }
        : {}),
      ...(project_id
        ? {
            project: {
              relation: [
                {
                  id: project_id,
                },
              ],
            },
          }
        : {}),
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: description || '',
              },
            },
          ],
        },
      },
    ],
  };
}

export function buildProjectCreatePageParams(
  args: BuildProjectPageParamsArgs
): NotionCreatePageParams {
  const { databaseId, name, description, importance, action_plan } = args;

  return {
    parent: {
      database_id: databaseId,
    },
    properties: {
      name: {
        title: [
          {
            text: {
              content: name,
            },
          },
        ],
      },
      importance: {
        select: {
          name: importance,
        },
      },
      status: {
        status: {
          name: 'Not started',
        },
      },
      ...(action_plan
        ? {
            action_plan: {
              rich_text: [
                {
                  text: {
                    content: action_plan,
                  },
                },
              ],
            },
          }
        : {}),
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: description,
              },
            },
          ],
        },
      },
    ],
  };
}

export function buildTaskUpdatePageParams(
  args: BuildTaskUpdatePageParamsArgs
): NotionUpdatePageParams {
  const { pageId, title, task_type, scheduled_date, project_id, is_archived } = args;

  const properties: NotionPropertyUpdates = {};

  if (title !== undefined) {
    properties.Name = {
      title: [
        {
          text: {
            content: title,
          },
        },
      ],
    };
  }

  if (task_type !== undefined) {
    properties.task_type = {
      select: {
        name: task_type,
      },
    };
  }

  if (scheduled_date !== undefined) {
    if (scheduled_date === null) {
      properties.due_date = null;
    } else {
      properties.due_date = {
        date: {
          start: scheduled_date,
        },
      };
    }
  }

  if (project_id !== undefined) {
    if (project_id === null) {
      properties.project = {
        relation: [],
      };
    } else {
      properties.project = {
        relation: [
          {
            id: project_id,
          },
        ],
      };
    }
  }

  if (is_archived !== undefined) {
    properties.is_archived = {
      checkbox: is_archived,
    };
  }

  return {
    page_id: pageId,
    properties,
  };
}

/**
 * Parse a Notion page response into a ProjectInfo object.
 */
export function parseProjectFromNotionPage(page: PageObjectResponse): ProjectInfo {
  const properties = page.properties;

  const name = extractTextFromProperty(properties, 'name') || 'Untitled Project';
  const description = extractRichTextFromProperty(properties, 'description');
  const importance = extractSelectFromProperty(properties, 'importance');
  const status = extractStatusFromProperty(properties, 'status');
  const action_plan = extractRichTextFromProperty(properties, 'action_plan');

  return {
    project_id: page.id,
    name,
    description,
    importance,
    status,
    action_plan,
    notion_url: page.url,
    created_at: new Date(page.created_time),
    updated_at: new Date(page.last_edited_time),
  };
}

// ===== Private helper functions for property extraction =====

function extractTextFromProperty(
  properties: PageObjectResponse['properties'],
  propertyName: string
): string | undefined {
  const prop = properties[propertyName];
  if (!prop) return undefined;

  if (prop.type === 'title' && prop.title.length > 0) {
    return prop.title[0].plain_text;
  }

  return undefined;
}

function extractRichTextFromProperty(
  properties: PageObjectResponse['properties'],
  propertyName: string
): string | undefined {
  const prop = properties[propertyName];
  if (!prop) return undefined;

  if (prop.type === 'rich_text' && prop.rich_text.length > 0) {
    return prop.rich_text[0].plain_text;
  }

  return undefined;
}

function extractSelectFromProperty(
  properties: PageObjectResponse['properties'],
  propertyName: string
): string | undefined {
  const prop = properties[propertyName];
  if (!prop || prop.type !== 'select') return undefined;

  return prop.select?.name;
}

function extractStatusFromProperty(
  properties: PageObjectResponse['properties'],
  propertyName: string
): string | undefined {
  const prop = properties[propertyName];
  if (!prop || prop.type !== 'status') return undefined;

  return prop.status?.name;
}
