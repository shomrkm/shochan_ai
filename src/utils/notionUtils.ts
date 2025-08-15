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
      タスク種別: {
        select: {
          name: task_type,
        },
      },
      ...(scheduled_date
        ? {
            実施予定日: {
              date: {
                start: scheduled_date,
              },
            },
          }
        : {}),
      ...(project_id
        ? {
            プロジェクト: {
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
      名前: {
        title: [
          {
            text: {
              content: name,
            },
          },
        ],
      },
      重要度: {
        select: {
          name: importance,
        },
      },
      ステータス: {
        status: {
          name: 'Not started',
        },
      },
      ...(action_plan
        ? {
            アクションプラン: {
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
