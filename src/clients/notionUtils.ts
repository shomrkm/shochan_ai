import type {
  BuildProjectPageParamsArgs,
  BuildTaskPageParamsArgs,
  NotionCreatePageParams,
} from '../types/notion';

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
