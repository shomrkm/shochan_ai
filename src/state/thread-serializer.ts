import type { 
  AgentThread, 
  ThreadSnapshot
} from '../types/thread-types';

/**
 * ThreadSerializer: Handles serialization and deserialization of AgentThreads
 * 
 * Factor 5 principle: Make threads trivially serializable/deserializable
 * for easy persistence, forking, and recovery.
 */
export class ThreadSerializer {
  private static readonly VERSION = '1.0.0';

  /**
   * Serialize an AgentThread to JSON string
   */
  static serialize(thread: AgentThread): string {
    try {
      const snapshot: ThreadSnapshot = {
        thread: this.prepareForSerialization(thread),
        serializedAt: new Date(),
        version: this.VERSION,
      };

      return JSON.stringify(snapshot, this.replacer, 2);
    } catch (error) {
      throw new Error(`Failed to serialize thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deserialize JSON string to AgentThread
   */
  static deserialize(serializedData: string): AgentThread {
    try {
      const snapshot: ThreadSnapshot = JSON.parse(serializedData, this.reviver);
      
      // Version compatibility check
      if (!this.isCompatibleVersion(snapshot.version)) {
        throw new Error(`Incompatible thread version: ${snapshot.version}. Current version: ${this.VERSION}`);
      }

      return this.restoreFromSerialization(snapshot.thread);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON format in serialized thread data');
      }
      throw new Error(`Failed to deserialize thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a minimal snapshot for quick storage
   */
  static createMinimalSnapshot(thread: AgentThread): Omit<ThreadSnapshot, 'thread'> & { 
    threadId: string; 
    status: string; 
    eventCount: number;
    lastUpdated: Date;
  } {
    return {
      threadId: thread.threadId,
      status: thread.status,
      eventCount: thread.events.length,
      lastUpdated: thread.updatedAt,
      serializedAt: new Date(),
      version: this.VERSION,
    };
  }

  /**
   * Validate thread structure before operations
   */
  static validateThread(thread: AgentThread): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!thread.threadId) errors.push('Missing threadId');
    if (!thread.createdAt) errors.push('Missing createdAt');
    if (!thread.updatedAt) errors.push('Missing updatedAt');
    if (!thread.status) errors.push('Missing status');
    if (!Array.isArray(thread.events)) errors.push('Events must be an array');

    // Events validation
    thread.events.forEach((event, index) => {
      if (!event.id) errors.push(`Event ${index}: Missing id`);
      if (!event.timestamp) errors.push(`Event ${index}: Missing timestamp`);
      if (!event.type) errors.push(`Event ${index}: Missing type`);
      if (event.data === undefined) errors.push(`Event ${index}: Missing data`);
    });

    // Chronological order validation
    for (let i = 1; i < thread.events.length; i++) {
      const prevTime = new Date(thread.events[i - 1].timestamp).getTime();
      const currTime = new Date(thread.events[i].timestamp).getTime();
      if (currTime < prevTime) {
        errors.push(`Event ${i}: Timestamp is out of chronological order`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate thread statistics for monitoring
   */
  static getThreadStatistics(thread: AgentThread) {
    const events = thread.events;
    const duration = thread.updatedAt.getTime() - thread.createdAt.getTime();
    
    return {
      threadId: thread.threadId,
      status: thread.status,
      totalEvents: events.length,
      durationMs: duration,
      durationMinutes: Math.round(duration / 60000 * 100) / 100,
      eventsPerMinute: duration > 0 ? Math.round((events.length / (duration / 60000)) * 100) / 100 : 0,
      eventsByType: events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      memoryFootprint: this.estimateMemoryFootprint(thread),
    };
  }

  /**
   * Create a fork of a thread at a specific event
   */
  static forkThread(originalThread: AgentThread, upToEventIndex?: number): AgentThread {
    const endIndex = upToEventIndex !== undefined ? upToEventIndex + 1 : originalThread.events.length;
    const forkedEvents = originalThread.events.slice(0, endIndex);
    
    const forkedThread: AgentThread = {
      threadId: `${originalThread.threadId}_fork_${Date.now()}`,
      createdAt: originalThread.createdAt,
      updatedAt: endIndex < originalThread.events.length 
        ? forkedEvents[forkedEvents.length - 1].timestamp 
        : originalThread.updatedAt,
      status: 'paused', // Forked threads start paused
      events: forkedEvents,
    };

    return forkedThread;
  }

  /**
   * Prepare thread for serialization (handle special types)
   */
  private static prepareForSerialization(thread: AgentThread): AgentThread {
    return {
      ...thread,
      events: thread.events.map(event => ({
        ...event,
        timestamp: event.timestamp, // Date objects will be handled by replacer
      })),
    };
  }

  /**
   * Restore thread from serialization (handle special types)
   */
  private static restoreFromSerialization(thread: AgentThread): AgentThread {
    return {
      ...thread,
      createdAt: new Date(thread.createdAt),
      updatedAt: new Date(thread.updatedAt),
      events: thread.events.map(event => ({
        ...event,
        timestamp: new Date(event.timestamp),
      })),
    };
  }

  /**
   * JSON replacer function for serialization
   */
  private static replacer(_key: string, value: any): any {
    // Convert Dates to ISO strings for serialization
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  /**
   * JSON reviver function for deserialization
   */
  private static reviver(_key: string, value: any): any {
    // Restore Dates from serialized format
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }

  /**
   * Check if thread version is compatible
   */
  private static isCompatibleVersion(version: string): boolean {
    const [major] = version.split('.').map(Number);
    const [currentMajor] = this.VERSION.split('.').map(Number);
    
    // Same major version is compatible
    return major === currentMajor;
  }

  /**
   * Estimate memory footprint of a thread
   */
  private static estimateMemoryFootprint(thread: AgentThread): string {
    const serialized = JSON.stringify(thread);
    const bytes = new Blob([serialized]).size;
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024 * 100) / 100} KB`;
    return `${Math.round(bytes / (1024 * 1024) * 100) / 100} MB`;
  }
}