import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { RedisStateStore } from './redis-store';
import { Thread } from '@shochan_ai/core';
import type { Event } from '@shochan_ai/core';

describe('RedisStateStore', () => {
	let store: RedisStateStore;
	const testConversationId = 'test_conv_123';

	beforeAll(async () => {
		// Use unique key prefix for this test file to enable parallel execution
		store = new RedisStateStore('redis://localhost:6379', 'test:redis-store:');
		await store.connect();
	});

	afterAll(async () => {
		await store.disconnect();
	});

	beforeEach(async () => {
		await store.clear();
	});

	it('should connect to Redis successfully', () => {
		expect(store.isConnected()).toBe(true);
	});

	it('should return null for non-existent conversation', async () => {
		const result = await store.get('non_existent_id');
		expect(result).toBeNull();
	});

	it('should store and retrieve Thread', async () => {
		const events: Event[] = [
			{
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Hello',
			},
		];
		const thread = new Thread(events);

		await store.set(testConversationId, thread);
		const retrieved = await store.get(testConversationId);

		expect(retrieved).not.toBeNull();
		expect(retrieved?.events).toHaveLength(1);
		expect(retrieved?.events[0].type).toBe('user_input');
		expect(retrieved?.events[0].data).toBe('Hello');
	});

	it('should update existing Thread', async () => {
		const initialEvents: Event[] = [
			{
				type: 'user_input',
				timestamp: Date.now(),
				data: 'First message',
			},
		];
		const initialThread = new Thread(initialEvents);
		await store.set(testConversationId, initialThread);

    await new Promise((resolve) => setTimeout(resolve, 100));

		// Update with new event
		const updatedEvents: Event[] = [
			...initialEvents,
			{
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Second message',
			},
		];
		const updatedThread = new Thread(updatedEvents);
		await store.set(testConversationId, updatedThread);

		const retrieved = await store.get(testConversationId);
		expect(retrieved?.events).toHaveLength(2);
		expect(retrieved?.events[1].data).toBe('Second message');
	});

	it('should delete Thread', async () => {
		const thread = new Thread([
			{
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Test',
			},
		]);

		await store.set(testConversationId, thread);
		expect(await store.get(testConversationId)).not.toBeNull();

		await store.delete(testConversationId);
		expect(await store.get(testConversationId)).toBeNull();
	});

	it('should list conversation IDs', async () => {
		const ids = ['test_conv_1', 'test_conv_2', 'test_conv_3'];

		for (const id of ids) {
			await store.set(
				id,
				new Thread([
					{
						type: 'user_input',
						timestamp: Date.now(),
						data: `Message for ${id}`,
					},
				]),
			);
		}

		const listedIds = await store.list();
		for (const id of ids) {
			expect(listedIds).toContain(id);
		}
	});

	it('should handle complex Thread with multiple event types', async () => {
		const events: Event[] = [
			{
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Create a task',
			},
			{
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'create_task',
					parameters: {
						title: 'Test Task',
						project_id: 'Test Project',
					},
				},
			},
			{
				type: 'tool_response',
				timestamp: Date.now(),
				data: {
					success: true,
					taskId: '123',
				},
			},
		];

		const thread = new Thread(events);
		await store.set(testConversationId, thread);

		const retrieved = await store.get(testConversationId);
		expect(retrieved?.events).toHaveLength(3);
		expect(retrieved?.events[0].type).toBe('user_input');
		expect(retrieved?.events[1].type).toBe('tool_call');
		expect(retrieved?.events[2].type).toBe('tool_response');
	});

	it('should clear all Thread states', async () => {
		const ids = ['test_clear_1', 'test_clear_2', 'test_clear_3'];
		for (const id of ids) {
			await store.set(
				id,
				new Thread([{ type: 'user_input', timestamp: Date.now(), data: `Message for ${id}` }]),
			);
		}

		// Verify data exists before clear
		const beforeClear = await store.list();
		expect(beforeClear.length).toBeGreaterThanOrEqual(ids.length);

		await store.clear();

		expect(await store.list()).toHaveLength(0);
	});

	it('should handle clear on empty store', async () => {
		// Ensure store is empty by deleting all entries
		const allIds = await store.list();
		for (const id of allIds) {
			await store.delete(id);
		}

		// Verify store is empty
		expect(await store.list()).toHaveLength(0);

		// clear() should not throw on empty store
		await store.clear();

		expect(await store.list()).toHaveLength(0);
	});
});
