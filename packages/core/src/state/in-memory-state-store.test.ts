import { describe, expect, it } from 'vitest';
import { InMemoryStateStore } from './in-memory-state-store';
import { Thread } from '../thread/thread';
import type { Event } from '../types/event';

describe('InMemoryStateStore', () => {
  describe('constructor', () => {
    it('initializes with the provided state', () => {
      const initialThread = new Thread([
        { type: 'user_input', timestamp: Date.now(), data: 'Hello' },
      ]);
      const store = new InMemoryStateStore(initialThread);

      expect(store.getState()).toBe(initialThread);
    });

    it('initializes with custom state type', () => {
      interface CustomState {
        count: number;
        message: string;
      }

      const initialState: CustomState = { count: 0, message: 'initial' };
      const store = new InMemoryStateStore<CustomState>(initialState);

      expect(store.getState()).toEqual({ count: 0, message: 'initial' });
    });
  });

  describe('getState', () => {
    it('returns the current state', () => {
      const events: Event[] = [
        { type: 'user_input', timestamp: Date.now(), data: 'Test' },
      ];
      const thread = new Thread(events);
      const store = new InMemoryStateStore(thread);

      const state = store.getState();

      expect(state).toBe(thread);
      expect(state.events).toEqual(events);
    });

    it('returns the same reference until setState is called', () => {
      const initialThread = new Thread([]);
      const store = new InMemoryStateStore(initialThread);

      const state1 = store.getState();
      const state2 = store.getState();

      expect(state1).toBe(state2);
      expect(state1).toBe(initialThread);
    });
  });

  describe('setState', () => {
    it('updates the state', () => {
      const initialThread = new Thread([
        { type: 'user_input', timestamp: Date.now(), data: 'Initial' },
      ]);
      const store = new InMemoryStateStore(initialThread);

      const newThread = new Thread([
        { type: 'user_input', timestamp: Date.now(), data: 'Updated' },
      ]);
      store.setState(newThread);

      expect(store.getState()).toBe(newThread);
      expect(store.getState().events[0].data).toBe('Updated');
    });

    it('completely replaces the state (no merging)', () => {
      const initialThread = new Thread([
        { type: 'user_input', timestamp: Date.now(), data: 'Event 1' },
        { type: 'user_input', timestamp: Date.now(), data: 'Event 2' },
      ]);
      const store = new InMemoryStateStore(initialThread);

      const newThread = new Thread([
        { type: 'user_input', timestamp: Date.now(), data: 'Event 3' },
      ]);
      store.setState(newThread);

      const state = store.getState();
      expect(state.events).toHaveLength(1);
      expect(state.events[0].data).toBe('Event 3');
    });

    it('allows setting state multiple times', () => {
      const store = new InMemoryStateStore(new Thread([]));

      const thread1 = new Thread([
        { type: 'user_input', timestamp: Date.now(), data: 'First' },
      ]);
      store.setState(thread1);
      expect(store.getState().events).toHaveLength(1);

      const thread2 = new Thread([
        { type: 'user_input', timestamp: Date.now(), data: 'Second' },
        { type: 'user_input', timestamp: Date.now(), data: 'Third' },
      ]);
      store.setState(thread2);
      expect(store.getState().events).toHaveLength(2);
    });
  });

  describe('type safety', () => {
    it('maintains type safety with custom state types', () => {
      interface AppState {
        user: { id: string; name: string };
        settings: { theme: 'light' | 'dark' };
      }

      const initialState: AppState = {
        user: { id: '123', name: 'John' },
        settings: { theme: 'light' },
      };

      const store = new InMemoryStateStore<AppState>(initialState);

      // TypeScript should enforce the correct type
      const state = store.getState();
      expect(state.user.name).toBe('John');
      expect(state.settings.theme).toBe('light');

      const newState: AppState = {
        user: { id: '456', name: 'Jane' },
        settings: { theme: 'dark' },
      };
      store.setState(newState);

      expect(store.getState().user.name).toBe('Jane');
      expect(store.getState().settings.theme).toBe('dark');
    });
  });

  describe('immutability', () => {
    it('does not protect against mutations (caller responsibility)', () => {
      const events: Event[] = [
        { type: 'user_input', timestamp: Date.now(), data: 'Original' },
      ];
      const thread = new Thread(events);
      const store = new InMemoryStateStore(thread);

      // This mutation affects the stored state (intentional design)
      const state = store.getState();
      state.events.push({
        type: 'user_input',
        timestamp: Date.now(),
        data: 'Mutated',
      });

      expect(store.getState().events).toHaveLength(2);
      expect(store.getState().events[1].data).toBe('Mutated');
    });
  });
});
