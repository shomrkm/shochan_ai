/**
 * Event and Thread Classes for YAML-in-XML Context Management
 * Following 12-factor agents Factor 3 principles
 */
import type { EventType, EventTypeDataMap } from './types';
import { YamlUtils } from './yaml-utils';

// Type-safe Event class with EventType to data mapping
export class Event<K extends EventType = EventType> {
  constructor(
    public readonly type: K,
    public readonly data: EventTypeDataMap[K],
    public readonly timestamp: Date = new Date(),
    public readonly id: string = `event_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  ) {}

  toXML(): string {
    return YamlUtils.generateXMLTag(this.type, this.data);
  }
}

// Helper function for type-safe event creation
export function createEvent<K extends EventType>(
  type: K, 
  data: EventTypeDataMap[K]
): Event<K> {
  return new Event(type, data);
}

export class Thread {
  private events: Event[] = [];

  constructor(
    public readonly id: string = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    public readonly startTime: Date = new Date()
  ) {}

  addEvent<K extends EventType>(type: K, data: EventTypeDataMap[K]): Event<K> {
    const event = new Event(type, data);
    this.events.push(event);
    return event;
  }

  getEvents(): ReadonlyArray<Event> {
    return [...this.events];
  }

  getEventsByType<K extends EventType>(type: K): Event<K>[] {
    return this.events.filter((event): event is Event<K> => event.type === type);
  }

  getLastEvent(): Event | undefined {
    return this.events[this.events.length - 1];
  }

  getUserMessages(): Event<'user_message'>[] {
    return this.getEventsByType('user_message');
  }

  getCreateTaskEvents(): Event<'create_task'>[] {
    return this.getEventsByType('create_task');
  }

  toPrompt(): string {
    const sessionInfo = YamlUtils.formatToYaml({
      thread_id: this.id,
      start_time: this.startTime.toISOString(),
      event_count: this.events.length
    });

    const eventsXML = this.events
      .map(event => event.toXML())
      .join('\n\n');

    return `<conversation_context>
<session_info>
${sessionInfo}
</session_info>

${eventsXML}
</conversation_context>`;
  }
}