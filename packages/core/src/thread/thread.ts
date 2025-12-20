import type { Event } from '../types/event';
import { isToolCallEvent } from '../types/event';

export class Thread {
  readonly events: readonly Event[];

  constructor(events: readonly Event[]) {
    this.events = [...events];
  }

  serializeForLLM() {
    return this.events.map((e) => this.serializeOneEvent(e)).join('\n');
  }

  trimLeadingWhitespace(s: string) {
    return s.replace(/^[ \t]+/gm, '');
  }

  serializeOneEvent(e: Event) {
    // Extract tag name - for tool calls, use the intent field
    const tagName = isToolCallEvent(e) ? e.data.intent : e.type;
    const content = this.serializeEventData(e.data);

    return this.trimLeadingWhitespace(`
            <${tagName}>
            ${content}
            </${tagName}>
        `);
  }

  private serializeEventData(data: unknown): string {
    if (data === null || data === undefined) {
      return '';
    }

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'object') {
      const dataObj = data as Record<string, unknown>;
      const filteredKeys = Object.keys(dataObj).filter((k) => k !== 'intent');
      return filteredKeys
        .map((k) => `${k}: ${this.serializeValue(dataObj[k])}`)
        .join('\n');
    }

    return String(data);
  }

  private serializeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return String(value);
    }

    if (typeof value !== 'object') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.serializeValue(item)).join(', ')}]`;
    }

    const entries = Object.entries(value)
      .map(([key, val]) => `${key}: ${this.serializeValue(val)}`)
      .join(', ');

    return `{${entries}}`;
  }
}
