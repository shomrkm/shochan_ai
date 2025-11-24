import { describe, expect, it } from 'vitest';
import { type Event, Thread } from './thread';

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
          type: 'user_message',
          data: { intent: 'create_task', message: 'Create a new task' },
        },
      ];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output:
      //
      // <create_task>
      // message: Create a new task
      // </create_task>
      //
      expect(result).toBe('\n<create_task>\nmessage: Create a new task\n</create_task>\n');
    });

    it('serializes multiple events', () => {
      const events: Event[] = [
        { type: 'user_message', data: { intent: 'create_task', title: 'Task 1' } },
        { type: 'assistant_response', data: { intent: 'task_created', task_id: '123' } },
      ];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output (events joined with '\n'):
      //
      // <create_task>
      // title: Task 1
      // </create_task>
      //
      // <task_created>
      // task_id: 123
      // </task_created>
      //
      expect(result).toBe(
        '\n<create_task>\ntitle: Task 1\n</create_task>\n' +
          '\n' + // join separator
          '\n<task_created>\ntask_id: 123\n</task_created>\n',
      );
    });

    it('uses event type when intent is not present', () => {
      const events: Event[] = [{ type: 'custom_event', data: { value: 42 } }];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output (uses event.type instead of data.intent):
      //
      // <custom_event>
      // value: 42
      // </custom_event>
      //
      expect(result).toBe('\n<custom_event>\nvalue: 42\n</custom_event>\n');
    });
  });

  describe('serializeOneEvent', () => {
    const thread = new Thread([]);

    it('serializes event with object data', () => {
      const event: Event = {
        type: 'test',
        data: { intent: 'test_intent', key1: 'value1', key2: 'value2' },
      };
      const result = thread.serializeOneEvent(event);

      // Expected output:
      //
      // <test_intent>
      // key1: value1
      // key2: value2
      // </test_intent>
      //
      expect(result).toBe('\n<test_intent>\nkey1: value1\nkey2: value2\n</test_intent>\n');
    });

    it('serializes event with non-object data', () => {
      const event: Event = { type: 'test', data: 'simple string' };
      const result = thread.serializeOneEvent(event);

      // Expected output:
      //
      // <test>
      // simple string
      // </test>
      //
      expect(result).toBe('\n<test>\nsimple string\n</test>\n');
    });

    it('filters out intent from serialized keys', () => {
      const event: Event = {
        type: 'test',
        data: { intent: 'my_intent', field: 'value' },
      };
      const result = thread.serializeOneEvent(event);

      // Expected output (intent is used as tag name but not serialized as field):
      //
      // <my_intent>
      // field: value
      // </my_intent>
      //
      expect(result).toBe('\n<my_intent>\nfield: value\n</my_intent>\n');
      expect(result).not.toContain('intent:');
    });

    it('handles empty object data', () => {
      const event: Event = { type: 'test', data: {} };
      const result = thread.serializeOneEvent(event);

      // Expected output (empty content between tags):
      //
      // <test>
      //
      // </test>
      //
      expect(result).toBe('\n<test>\n\n</test>\n');
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
        { type: 'event1', data: { intent: 'some_intent' } },
        { type: 'event2', data: { intent: 'request_more_information' } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanResponse()).toBe(true);
    });

    it('returns true when last event is done_for_now', () => {
      const events: Event[] = [
        { type: 'event1', data: { intent: 'some_intent' } },
        { type: 'event2', data: { intent: 'done_for_now' } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanResponse()).toBe(true);
    });

    it('returns false when last event is neither request_more_information nor done_for_now', () => {
      const events: Event[] = [
        { type: 'event1', data: { intent: 'request_more_information' } },
        { type: 'event2', data: { intent: 'create_task' } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanResponse()).toBe(false);
    });

    it('returns false when last event has different intent', () => {
      const events: Event[] = [{ type: 'event', data: { intent: 'other_intent' } }];
      const thread = new Thread(events);

      expect(thread.awaitingHumanResponse()).toBe(false);
    });
  });

  describe('awaitingHumanApproval', () => {
    it('returns true when last event is delete_task', () => {
      const events: Event[] = [
        { type: 'event1', data: { intent: 'create_task' } },
        { type: 'event2', data: { intent: 'delete_task' } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanApproval()).toBe(true);
    });

    it('returns false when last event is not delete_task', () => {
      const events: Event[] = [
        { type: 'event1', data: { intent: 'delete_task' } },
        { type: 'event2', data: { intent: 'create_task' } },
      ];
      const thread = new Thread(events);

      expect(thread.awaitingHumanApproval()).toBe(false);
    });

    it('returns false when last event has different intent', () => {
      const events: Event[] = [{ type: 'event', data: { intent: 'update_task' } }];
      const thread = new Thread(events);

      expect(thread.awaitingHumanApproval()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles event with special characters in data', () => {
      const events: Event[] = [
        {
          type: 'test',
          data: { intent: 'test', message: 'Special: <>&"\'\\n\\t' },
        },
      ];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output (special characters are preserved as-is):
      //
      // <test>
      // message: Special: <>&"'\n\t
      // </test>
      //
      expect(result).toBe('\n<test>\nmessage: Special: <>&"\'\\n\\t\n</test>\n');
    });

    it('handles event with very long data', () => {
      const longString = 'a'.repeat(10000);
      const events: Event[] = [{ type: 'test', data: { intent: 'test', content: longString } }];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      expect(result).toBe(`\n<test>\ncontent: ${longString}\n</test>\n`);
    });

    it('handles event with numeric type', () => {
      const events: Event[] = [{ type: 'test', data: 42 }];
      const thread = new Thread(events);
      const result = thread.serializeForLLM();

      // Expected output:
      //
      // <test>
      // 42
      // </test>
      //
      expect(result).toBe('\n<test>\n42\n</test>\n');
    });

    it('handles event with null data throws error (known limitation)', () => {
      const events: Event[] = [{ type: 'test', data: null }];
      const thread = new Thread(events);

      // Current implementation has a bug: typeof null === 'object' but Object.keys(null) throws
      expect(() => thread.serializeForLLM()).toThrow('Cannot convert undefined or null to object');
    });

    it('handles deeply nested object structures', () => {
      const events: Event[] = [
        {
          type: 'test',
          data: {
            intent: 'test',
            level1: {
              level2: {
                level3: {
                  level4: 'deep value',
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
      // level1: {level2: {level3: {level4: deep value}}}
      // </test>
      //
      expect(result).toBe(
        '\n<test>\nlevel1: {level2: {level3: {level4: deep value}}}\n</test>\n',
      );
    });
  });
});
