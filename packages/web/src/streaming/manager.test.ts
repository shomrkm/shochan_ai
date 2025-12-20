import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamManager } from './manager';
import type { Session } from 'better-sse';
import type { Event } from '@shochan_ai/core';

describe('StreamManager', () => {
	let manager: StreamManager;
	let mockSession: Session;

	beforeEach(() => {
		manager = new StreamManager();

		mockSession = {
			push: vi.fn(),
		} as unknown as Session;
	});

	it('should register a session', () => {
		const conversationId = 'conv_123';

		manager.register(conversationId, mockSession);

		expect(manager.hasSession(conversationId)).toBe(true);
		expect(manager.getActiveSessionCount()).toBe(1);
		expect(manager.getActiveConversationIds()).toContain(conversationId);
	});

	it('should send event to registered session', () => {
		const conversationId = 'conv_123';
		const event: Event = {
			type: 'user_input',
			timestamp: Date.now(),
			data: 'Hello',
		};

		manager.register(conversationId, mockSession);
		manager.send(conversationId, event);

		expect(mockSession.push).toHaveBeenCalledWith(event, 'user_input');
		expect(mockSession.push).toHaveBeenCalledTimes(1);
	});

	it('should not throw when sending to non-existent session', () => {
		const conversationId = 'non_existent';
		const event: Event = {
			type: 'user_input',
			timestamp: Date.now(),
			data: 'Hello',
		};

		// Should not throw
		expect(() => manager.send(conversationId, event)).not.toThrow();
		expect(mockSession.push).not.toHaveBeenCalled();
	});

	it('should unregister a session', () => {
		const conversationId = 'conv_123';

		manager.register(conversationId, mockSession);
		expect(manager.hasSession(conversationId)).toBe(true);

		manager.unregister(conversationId);
		expect(manager.hasSession(conversationId)).toBe(false);
		expect(manager.getActiveSessionCount()).toBe(0);
	});

	it('should handle multiple sessions', () => {
		const conv1 = 'conv_1';
		const conv2 = 'conv_2';
		const conv3 = 'conv_3';

		const mockSession1 = { push: vi.fn() } as unknown as Session;
		const mockSession2 = { push: vi.fn() } as unknown as Session;
		const mockSession3 = { push: vi.fn() } as unknown as Session;

		manager.register(conv1, mockSession1);
		manager.register(conv2, mockSession2);
		manager.register(conv3, mockSession3);

		expect(manager.getActiveSessionCount()).toBe(3);
		expect(manager.getActiveConversationIds()).toEqual([conv1, conv2, conv3]);

		const event: Event = {
			type: 'user_input',
			timestamp: Date.now(),
			data: 'Test',
		};

		manager.send(conv2, event);

		expect(mockSession1.push).not.toHaveBeenCalled();
		expect(mockSession2.push).toHaveBeenCalledWith(event, 'user_input');
		expect(mockSession3.push).not.toHaveBeenCalled();
	});

	it('should close all sessions', () => {
		const conv1 = 'conv_1';
		const conv2 = 'conv_2';

		manager.register(conv1, mockSession);
		manager.register(conv2, mockSession);

		expect(manager.getActiveSessionCount()).toBe(2);

		manager.closeAll();

		expect(manager.getActiveSessionCount()).toBe(0);
		expect(manager.getActiveConversationIds()).toHaveLength(0);
	});

	it('should handle session push errors gracefully', () => {
		const conversationId = 'conv_123';
		const brokenSession = {
			push: vi.fn(() => {
				throw new Error('Connection lost');
			}),
		} as unknown as Session;

		manager.register(conversationId, brokenSession);

		const event: Event = {
			type: 'user_input',
			timestamp: Date.now(),
			data: 'Test',
		};

		// Should not throw, but should unregister the broken session
		expect(() => manager.send(conversationId, event)).not.toThrow();
		expect(manager.hasSession(conversationId)).toBe(false);
	});

	it('should send different event types correctly', () => {
		const conversationId = 'conv_123';
		manager.register(conversationId, mockSession);

		const events: Event[] = [
			{
				type: 'user_input',
				timestamp: Date.now(),
				data: 'Hello',
			},
			{
				type: 'tool_call',
				timestamp: Date.now(),
				data: {
					intent: 'create_task',
					parameters: { title: 'Test' },
				},
			},
			{
				type: 'tool_response',
				timestamp: Date.now(),
				data: { success: true },
			},
			{
				type: 'error',
				timestamp: Date.now(),
				data: { error: 'Something went wrong' },
			},
		];

		for (const event of events) {
			manager.send(conversationId, event);
		}

		expect(mockSession.push).toHaveBeenCalledTimes(4);
		expect(mockSession.push).toHaveBeenNthCalledWith(1, events[0], 'user_input');
		expect(mockSession.push).toHaveBeenNthCalledWith(2, events[1], 'tool_call');
		expect(mockSession.push).toHaveBeenNthCalledWith(
			3,
			events[2],
			'tool_response',
		);
		expect(mockSession.push).toHaveBeenNthCalledWith(4, events[3], 'error');
	});
});
