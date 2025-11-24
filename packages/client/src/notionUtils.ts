import type {
  BuildProjectPageParamsArgs,
  BuildTaskPageParamsArgs,
  BuildTaskUpdatePageParamsArgs,
  NotionCreatePageParams,
  NotionUpdatePageParams,
} from '@shochan_ai/core';

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
      task_type: {
        select: {
          name: task_type,
        },
      },
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
                content: description,
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

  const properties: Record<string, any> = {};

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
