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
                    .map((k) => `${k}: ${e.data[k]}`)
                    .join('\n')
            }
            </${e.data?.intent || e.type}>
        `);
  }

  awaitingHumanResponse(): boolean {
    const lastEvent = this.events[this.events.length - 1];
    return ['request_more_information', 'done_for_now'].includes(lastEvent.data.intent);
  }

  awaitingHumanApproval(): boolean {
    const lastEvent = this.events[this.events.length - 1];
    return lastEvent.data.intent === 'create_task';
  }
}
