import { z } from 'zod';

/**
 * Zod schemas for tool call validation.
 * Types are inferred from schemas (Single Source of Truth).
 */

// Shared enums
export const taskTypeSchema = z.enum([
	'Today',
	'Next Actions',
	'Someday / Maybe',
	'Wait for',
	'Routin',
]);

export const importanceSchema = z.enum([
	'⭐',
	'⭐⭐',
	'⭐⭐⭐',
	'⭐⭐⭐⭐',
	'⭐⭐⭐⭐⭐',
]);

// Individual tool schemas
export const createTaskSchema = z.object({
	intent: z.literal('create_task'),
	parameters: z.object({
		title: z.string(),
		description: z.string().optional(),
		task_type: taskTypeSchema.optional(),
		scheduled_date: z.string().optional(),
		project_id: z.string().optional(),
	}),
});

export const createProjectSchema = z.object({
	intent: z.literal('create_project'),
	parameters: z.object({
		name: z.string(),
		description: z.string(),
		importance: importanceSchema,
		action_plan: z.string().optional(),
	}),
});

export const getTasksSchema = z.object({
	intent: z.literal('get_tasks'),
	parameters: z.object({
		task_type: taskTypeSchema.optional(),
		project_id: z.string().optional(),
		search_title: z.string().optional(),
		limit: z.number().optional(),
		include_completed: z.boolean().optional(),
		sort_by: z.enum(['created_at', 'updated_at', 'scheduled_date']).optional(),
		sort_order: z.enum(['asc', 'desc']).optional(),
	}),
});

export const deleteTaskSchema = z.object({
	intent: z.literal('delete_task'),
	parameters: z.object({
		task_id: z.string(),
		reason: z.string().optional(),
	}),
});

export const updateTaskSchema = z.object({
	intent: z.literal('update_task'),
	parameters: z.object({
		task_id: z.string(),
		title: z.string().optional(),
		task_type: taskTypeSchema.optional(),
		scheduled_date: z.string().nullable().optional(),
		project_id: z.string().nullable().optional(),
		is_archived: z.boolean().optional(),
	}),
});

export const getTaskDetailsSchema = z.object({
	intent: z.literal('get_task_details'),
	parameters: z.object({
		task_id: z.string(),
	}),
});

export const requestMoreInformationSchema = z.object({
	intent: z.literal('request_more_information'),
	parameters: z.object({
		message: z.string(),
	}),
});

export const doneForNowSchema = z.object({
	intent: z.literal('done_for_now'),
	parameters: z.object({
		message: z.string(),
	}),
});

/**
 * Discriminated union schema for all ToolCall types.
 * Uses intent field as discriminator.
 */
export const toolCallSchema = z.discriminatedUnion('intent', [
	createTaskSchema,
	createProjectSchema,
	getTasksSchema,
	deleteTaskSchema,
	updateTaskSchema,
	getTaskDetailsSchema,
	requestMoreInformationSchema,
	doneForNowSchema,
]);

// Types inferred from schemas (Single Source of Truth)
export type TaskType = z.infer<typeof taskTypeSchema>;
export type Importance = z.infer<typeof importanceSchema>;

export type CreateTaskTool = z.infer<typeof createTaskSchema>;
export type CreateProjectTool = z.infer<typeof createProjectSchema>;
export type GetTasksTool = z.infer<typeof getTasksSchema>;
export type DeleteTaskTool = z.infer<typeof deleteTaskSchema>;
export type UpdateTaskTool = z.infer<typeof updateTaskSchema>;
export type GetTaskDetailsTool = z.infer<typeof getTaskDetailsSchema>;
export type RequestMoreInformationTool = z.infer<typeof requestMoreInformationSchema>;
export type DoneForNowTool = z.infer<typeof doneForNowSchema>;

/**
 * Union type of all available tool calls.
 * Inferred from zod schema for type safety.
 */
export type ToolCall = z.infer<typeof toolCallSchema>;
