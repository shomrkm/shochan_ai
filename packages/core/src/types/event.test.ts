import { describe, expect, it } from 'vitest';
import type { Event } from './event';
import {
  isCompleteEvent,
  isErrorEvent,
  isTextChunkEvent,
  isThinkingChunkEvent,
  isToolCallEvent,
} from './event';

describe('isThinkingChunkEvent', () => {
  it('returns true for thinking_chunk type', () => {
    const event: Event = {
      type: 'thinking_chunk',
      timestamp: Date.now(),
      data: { content: 'ユーザーのリクエストを確認しています', messageId: 'msg-1' },
    };

    expect(isThinkingChunkEvent(event)).toBe(true);
  });

  it('returns false for text_chunk type', () => {
    const event: Event = {
      type: 'text_chunk',
      timestamp: Date.now(),
      data: { content: 'Hello', messageId: 'msg-2' },
    };

    expect(isThinkingChunkEvent(event)).toBe(false);
  });

  it('returns false for tool_call type', () => {
    const event: Event = {
      type: 'tool_call',
      timestamp: Date.now(),
      data: { intent: 'get_tasks', parameters: {} },
    };

    expect(isThinkingChunkEvent(event)).toBe(false);
  });

  it('returns false for complete type', () => {
    const event: Event = {
      type: 'complete',
      timestamp: Date.now(),
      data: { message: 'done' },
    };

    expect(isThinkingChunkEvent(event)).toBe(false);
  });

  it('returns false for error type', () => {
    const event: Event = {
      type: 'error',
      timestamp: Date.now(),
      data: { error: 'Something went wrong' },
    };

    expect(isThinkingChunkEvent(event)).toBe(false);
  });

  it('narrows type correctly when used as type guard', () => {
    const event: Event = {
      type: 'thinking_chunk',
      timestamp: 1234567890,
      data: { content: 'タスク一覧を取得します', messageId: 'msg-abc' },
    };

    if (isThinkingChunkEvent(event)) {
      expect(event.data.content).toBe('タスク一覧を取得します');
      expect(event.data.messageId).toBe('msg-abc');
      expect(event.timestamp).toBe(1234567890);
    }
  });

  it('distinguishes thinking_chunk from text_chunk in an array of events', () => {
    const events: Event[] = [
      { type: 'thinking_chunk', timestamp: 1, data: { content: 'thinking...', messageId: 'm1' } },
      { type: 'text_chunk', timestamp: 2, data: { content: 'response text', messageId: 'm2' } },
      { type: 'thinking_chunk', timestamp: 3, data: { content: 'more thinking', messageId: 'm3' } },
    ];

    const thinkingEvents = events.filter(isThinkingChunkEvent);
    const textEvents = events.filter(isTextChunkEvent);

    expect(thinkingEvents).toHaveLength(2);
    expect(textEvents).toHaveLength(1);
    expect(thinkingEvents[0].data.content).toBe('thinking...');
    expect(thinkingEvents[1].data.content).toBe('more thinking');
    expect(textEvents[0].data.content).toBe('response text');
  });
});

describe('isToolCallEvent', () => {
  it('returns true for tool_call type', () => {
    const event: Event = {
      type: 'tool_call',
      timestamp: Date.now(),
      data: { intent: 'create_task', parameters: { title: 'New Task', task_type: 'Today' } },
    };

    expect(isToolCallEvent(event)).toBe(true);
  });

  it('returns false for thinking_chunk type', () => {
    const event: Event = {
      type: 'thinking_chunk',
      timestamp: Date.now(),
      data: { content: 'thinking', messageId: 'm1' },
    };

    expect(isToolCallEvent(event)).toBe(false);
  });
});

describe('isCompleteEvent', () => {
  it('returns true for complete type', () => {
    const event: Event = {
      type: 'complete',
      timestamp: Date.now(),
      data: { message: 'Processing complete' },
    };

    expect(isCompleteEvent(event)).toBe(true);
  });

  it('returns false for thinking_chunk type', () => {
    const event: Event = {
      type: 'thinking_chunk',
      timestamp: Date.now(),
      data: { content: 'thinking', messageId: 'm1' },
    };

    expect(isCompleteEvent(event)).toBe(false);
  });
});

describe('isErrorEvent', () => {
  it('returns true for error type', () => {
    const event: Event = {
      type: 'error',
      timestamp: Date.now(),
      data: { error: 'Failed to fetch tasks', code: 'FETCH_ERROR' },
    };

    expect(isErrorEvent(event)).toBe(true);
  });

  it('narrows type to access error fields', () => {
    const event: Event = {
      type: 'error',
      timestamp: Date.now(),
      data: { error: 'API timeout', code: 'TIMEOUT' },
    };

    if (isErrorEvent(event)) {
      expect(event.data.error).toBe('API timeout');
      expect(event.data.code).toBe('TIMEOUT');
    }
  });
});
