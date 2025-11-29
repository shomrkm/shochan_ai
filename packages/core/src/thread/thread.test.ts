import { describe, expect, it } from 'vitest';
import type { Event, ToolCallEvent } from '../types/event';
import { Thread } from './thread';

describe('Thread', () => {
  describe('serializeForLLM', () => {
    it('serializes empty event array', () => {
      const thread = new Thread([]);
      const result = thread.serializeForLLM();

      expect(result).toBe('');
    });

    it('serializes single event with simple data', () => {
      const events: Event[] = [
        {
          type: 'tool_call',
          timestamp: Date.now(),
          data: { intent: 'create_task', parameters: { title: 'task title' } },
        },
      ];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output:
      //
      // <create_task>
      // parameters: {message: Create a new task}
      // </create_task>
      //
      expect(result).toBe('\n<create_task>\nparameters: {title: task title}\n</create_task>\n');
    });

    it('serializes multiple events', () => {
      const events: Event[] = [
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'create_task', parameters: { title: 'Task 1' } } },
        { type: 'tool_response', timestamp: Date.now(), data: { task_id: '123' } },
      ];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output (events joined with '\n'):
      //
      // <create_task>
      // parameters: {title: Task 1}
      // </create_task>
      //
      // <tool_response>
      // task_id: 123
      // </tool_response>
      //
      expect(result).toBe(
        '\n<create_task>\nparameters: {title: Task 1}\n</create_task>\n' +
          '\n' + // join separator
          '\n<tool_response>\ntask_id: 123\n</tool_response>\n',
      );
    });

    it('uses event type when intent is not present', () => {
      const events: Event[] = [{ type: 'user_input', timestamp: Date.now(), data: 'User message' }];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output (uses event.type instead of data.intent):
      //
      // <user_input>
      // User message
      // </user_input>
      //
      expect(result).toBe('\n<user_input>\nUser message\n</user_input>\n');
    });
  });

  describe('serializeOneEvent', () => {
    const thread = new Thread([]);

    it('serializes event with object data', () => {
      const event: ToolCallEvent = {
        type: 'tool_call',
        timestamp: Date.now(),
        data: { intent: 'test_intent', parameters: { key1: 'value1', key2: 'value2' } },
      };
      const result = thread.serializeOneEvent(event);

      // Expected output:
      //
      // <test_intent>
      // parameters: {key1: value1, key2: value2}
      // </test_intent>
      //
      expect(result).toBe('\n<test_intent>\nparameters: {key1: value1, key2: value2}\n</test_intent>\n');
    });

    it('serializes event with non-object data', () => {
      const event: Event = { type: 'user_input', timestamp: Date.now(), data: 'simple string' };
      const result = thread.serializeOneEvent(event);

      // Expected output:
      //
      // <user_input>
      // simple string
      // </user_input>
      //
      expect(result).toBe('\n<user_input>\nsimple string\n</user_input>\n');
    });

    it('filters out intent from serialized keys', () => {
      const event: ToolCallEvent = {
        type: 'tool_call',
        timestamp: Date.now(),
        data: { intent: 'my_intent', parameters: { field: 'value' } },
      };
      const result = thread.serializeOneEvent(event);

      // Expected output (intent is used as tag name but not serialized as field):
      //
      // <my_intent>
      // parameters: {field: value}
      // </my_intent>
      //
      expect(result).toBe('\n<my_intent>\nparameters: {field: value}\n</my_intent>\n');
      expect(result).not.toContain('intent:');
    });

    it('handles empty object data', () => {
      const event: Event = { type: 'tool_response', timestamp: Date.now(), data: {} };
      const result = thread.serializeOneEvent(event);

      // Expected output (empty content between tags):
      //
      // <tool_response>
      //
      // </tool_response>
      //
      expect(result).toBe('\n<tool_response>\n\n</tool_response>\n');
    });
  });

  describe('serializeValue', () => {
    const thread = new Thread([]);

    it('serializes null', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue'](null);
      expect(result).toBe('null');
    });

    it('serializes undefined', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue'](undefined);
      expect(result).toBe('undefined');
    });

    it('serializes string', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']('hello');
      expect(result).toBe('hello');
    });

    it('serializes number', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue'](42);
      expect(result).toBe('42');
    });

    it('serializes boolean', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue'](true);
      expect(result).toBe('true');
    });

    it('serializes empty array', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']([]);
      expect(result).toBe('[]');
    });

    it('serializes array of primitives', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']([1, 'two', true]);
      expect(result).toBe('[1, two, true]');
    });

    it('serializes nested arrays', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']([
        [1, 2],
        [3, 4],
      ]);
      expect(result).toBe('[[1, 2], [3, 4]]');
    });

    it('serializes empty object', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']({});
      expect(result).toBe('{}');
    });

    it('serializes simple object', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']({ a: 1, b: 'two' });
      expect(result).toBe('{a: 1, b: two}');
    });

    it('serializes nested object', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']({ outer: { inner: 'value' } });
      expect(result).toBe('{outer: {inner: value}}');
    });

    it('serializes array of objects', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']([{ id: 1 }, { id: 2 }]);
      expect(result).toBe('[{id: 1}, {id: 2}]');
    });

    it('serializes object with array values', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']({ items: [1, 2, 3] });
      expect(result).toBe('{items: [1, 2, 3]}');
    });

    it('handles complex nested structures', () => {
      // biome-ignore lint/complexity/useLiteralKeys: Testing private method via reflection
      const result = thread['serializeValue']({
        user: { name: 'Alice', tags: ['admin', 'user'] },
        count: 42,
      });
      expect(result).toBe('{user: {name: Alice, tags: [admin, user]}, count: 42}');
    });
  });

  describe('trimLeadingWhitespace', () => {
    const thread = new Thread([]);

    it('removes leading spaces from single line', () => {
      const result = thread.trimLeadingWhitespace('    hello');
      expect(result).toBe('hello');
    });

    it('removes leading tabs from single line', () => {
      const result = thread.trimLeadingWhitespace('\t\thello');
      expect(result).toBe('hello');
    });

    it('removes leading whitespace from multiple lines', () => {
      const input = '  line1\n    line2\n  line3';
      const result = thread.trimLeadingWhitespace(input);
      expect(result).toBe('line1\nline2\nline3');
    });

    it('preserves lines without leading whitespace', () => {
      const input = 'line1\nline2';
      const result = thread.trimLeadingWhitespace(input);
      expect(result).toBe('line1\nline2');
    });

    it('handles mixed spaces and tabs', () => {
      const input = '  \tline1\n\t  line2';
      const result = thread.trimLeadingWhitespace(input);
      expect(result).toBe('line1\nline2');
    });

    it('preserves trailing whitespace', () => {
      const input = '  hello  ';
      const result = thread.trimLeadingWhitespace(input);
      expect(result).toBe('hello  ');
    });

    it('preserves internal whitespace', () => {
      const input = '  hello   world  ';
      const result = thread.trimLeadingWhitespace(input);
      expect(result).toBe('hello   world  ');
    });
  });

  describe('awaitingHumanResponse', () => {
    it('returns true when last event is request_more_information', () => {
      const events: Event[] = [
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'some_intent', parameters: {} } },
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'request_more_information', parameters: {} } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanResponse()).toBe(true);
    });

    it('returns true when last event is done_for_now', () => {
      const events: Event[] = [
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'some_intent', parameters: {} } },
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'done_for_now', parameters: {} } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanResponse()).toBe(true);
    });

    it('returns false when last event is neither request_more_information nor done_for_now', () => {
      const events: Event[] = [
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'request_more_information', parameters: {} } },
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'create_task', parameters: {} } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanResponse()).toBe(false);
    });

    it('returns false when last event has different intent', () => {
      const events: Event[] = [{ type: 'tool_call', timestamp: Date.now(), data: { intent: 'other_intent', parameters: {} } }];
      const thread = new Thread(events);

      expect(thread.awaitingHumanResponse()).toBe(false);
    });
  });

  describe('awaitingHumanApproval', () => {
    it('returns true when last event is delete_task', () => {
      const events: Event[] = [
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'create_task', parameters: {} } },
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'delete_task', parameters: {} } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanApproval()).toBe(true);
    });

    it('returns false when last event is not delete_task', () => {
      const events: Event[] = [
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'delete_task', parameters: {} } },
        { type: 'tool_call', timestamp: Date.now(), data: { intent: 'create_task', parameters: {} } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanApproval()).toBe(false);
    });

    it('returns false when last event has different intent', () => {
      const events: Event[] = [{ type: 'tool_call', timestamp: Date.now(), data: { intent: 'update_task', parameters: {} } }];
      const thread = new Thread(events);

      expect(thread.awaitingHumanApproval()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles event with special characters in data', () => {
      const events: Event[] = [
        {
          type: 'tool_call',
          timestamp: Date.now(),
          data: { intent: 'test', parameters: { message: 'Special: <>&"\'\\n\\t' } },
        },
      ];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output (special characters are preserved as-is):
      //
      // <test>
      // parameters: {message: Special: <>&"'\n\t}
      // </test>
      //
      expect(result).toBe('\n<test>\nparameters: {message: Special: <>&"\'\\n\\t}\n</test>\n');
    });

    it('handles event with very long data', () => {
      const longString = 'a'.repeat(10000);
      const events: Event[] = [{
        type: 'tool_call',
        timestamp: Date.now(),
        data: { intent: 'test', parameters: { content: longString } }
      }];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      expect(result).toBe(`\n<test>\nparameters: {content: ${longString}}\n</test>\n`);
    });

    it('handles event with numeric type', () => {
      const events: Event[] = [{
        type: 'error',
        timestamp: Date.now(),
        data: { error: '42', code: '42' }
      }];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output:
      //
      // <error>
      // error: 42
      // code: 42
      // </error>
      //
      expect(result).toBe('\n<error>\nerror: 42\ncode: 42\n</error>\n');
    });

    it('handles deeply nested object structures', () => {
      const events: Event[] = [
        {
          type: 'tool_call',
          timestamp: Date.now(),
          data: {
            intent: 'test',
            parameters: {
              level1: {
                level2: {
                  level3: {
                    level4: 'deep value',
                  },
                },
              },
            },
          },
        },
      ];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output (nested objects are serialized inline):
      //
      // <test>
      // parameters: {level1: {level2: {level3: {level4: deep value}}}}
      // </test>
      //
      expect(result).toBe(
        '\n<test>\nparameters: {level1: {level2: {level3: {level4: deep value}}}}\n</test>\n',
      );
    });
  });
});
