export interface Event {
  type: string;
  data: any;
}

export class Thread {
  events: Event[] = [];

  constructor(events: Event[]) {
    this.events = events;
  }

  serializeForLLM() {
    return this.events.map((e) => this.serializeOneEvent(e)).join('\n');
  }

  trimLeadingWhitespace(s: string) {
    return s.replace(/^[ \t]+/gm, '');
  }

  serializeOneEvent(e: Event) {
    return this.trimLeadingWhitespace(`
            <${e.data?.intent || e.type}>
            ${
              typeof e.data !== 'object'
                ? e.data
                : Object.keys(e.data)
                    .filter((k) => k !== 'intent')
                    .map((k) => `${k}: ${this.serializeValue(e.data[k])}`)
                    .join('\n')
            }
            </${e.data?.intent || e.type}>
        `);
  }

  private serializeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return String(value);
    }
    
    if (typeof value !== 'object') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      return `[${value.map(item => this.serializeValue(item)).join(', ')}]`;
    }
    
    const entries = Object.entries(value)
      .map(([key, val]) => `${key}: ${this.serializeValue(val)}`)
      .join(', ');
    
    return `{${entries}}`;
  }

  awaitingHumanResponse(): boolean {
    const lastEvent = this.events[this.events.length - 1];
    return ['request_more_information', 'done_for_now'].includes(lastEvent.data.intent);
  }

  awaitingHumanApproval(): boolean {
    const lastEvent = this.events[this.events.length - 1];
    return lastEvent.data.intent === 'delete_task';
  }
}
