import type { AgentThread } from '../types/thread-types';
import { isCheckpointCreatedEvent, isErrorOccurredEvent } from '../types/thread-types';
import { AgentThreadManager } from './agent-thread';
import type { ThreadStorage } from './thread-storage';
import { ThreadSerializer } from './thread-serializer';

/**
 * Recovery strategy for handling different failure scenarios
 */
export type RecoveryStrategy = 
  | 'restart_from_beginning'    // Start completely fresh
  | 'resume_from_last_event'    // Continue from last successful event
  | 'rollback_to_checkpoint'    // Go back to a specific checkpoint
  | 'fork_and_retry'           // Create a fork and retry from there
  | 'manual_intervention';     // Require human intervention

/**
 * Recovery context containing information about the failure
 */
export interface RecoveryContext {
  threadId: string;
  failureReason: string;
  failureTimestamp: Date;
  lastSuccessfulEventIndex?: number;
  checkpointEventIndex?: number;
  suggestedStrategy: RecoveryStrategy;
  retryCount: number;
  maxRetries: number;
}

/**
 * Recovery result after attempting to restore a thread
 */
export interface RecoveryResult {
  success: boolean;
  restoredThread?: AgentThreadManager;
  strategy: RecoveryStrategy;
  message: string;
  newThreadId?: string; // For fork scenarios
  eventsRestored: number;
  eventsSkipped: number;
}

/**
 * ThreadRecoveryManager: Handles thread recovery, resumption, and failure scenarios
 * 
 * Factor 5 principle: Enable easy recovery and forking from any point in the thread
 */
export class ThreadRecoveryManager {
  constructor(
    private storage: ThreadStorage,
    private maxRetries: number = 3
  ) {}

  /**
   * Attempt to recover a failed thread
   */
  async recoverThread(
    threadId: string, 
    strategy: RecoveryStrategy = 'resume_from_last_event'
  ): Promise<RecoveryResult> {
    try {
      // Load the failed thread
      const failedThread = await this.storage.load(threadId);
      
      // Validate thread integrity
      const validation = ThreadSerializer.validateThread(failedThread);
      if (!validation.isValid) {
        return {
          success: false,
          strategy,
          message: `Thread validation failed: ${validation.errors.join(', ')}`,
          eventsRestored: 0,
          eventsSkipped: 0,
        };
      }

      // Apply recovery strategy
      return await this.applyRecoveryStrategy(failedThread, strategy);
      
    } catch (error) {
      return {
        success: false,
        strategy,
        message: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        eventsRestored: 0,
        eventsSkipped: 0,
      };
    }
  }

  /**
   * Resume a paused or failed thread from a specific point
   */
  async resumeThread(
    threadId: string,
    fromEventIndex?: number
  ): Promise<RecoveryResult> {
    try {
      const thread = await this.storage.load(threadId);
      
      // Determine resume point
      const resumeIndex = fromEventIndex ?? thread.events.length;
      
      // Create new thread manager with restored state
      const restoredThread = this.createThreadFromEvents(thread, resumeIndex);
      
      // Mark as resumed
      restoredThread.resume();
      
      return {
        success: true,
        restoredThread,
        strategy: 'resume_from_last_event',
        message: `Thread resumed from event ${resumeIndex}`,
        eventsRestored: resumeIndex,
        eventsSkipped: thread.events.length - resumeIndex,
      };
      
    } catch (error) {
      return {
        success: false,
        strategy: 'resume_from_last_event',
        message: `Resume failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        eventsRestored: 0,
        eventsSkipped: 0,
      };
    }
  }

  /**
   * Create a checkpoint for potential rollback
   */
  async createCheckpoint(threadManager: AgentThreadManager, label?: string): Promise<string> {
    const thread = threadManager.getThread();
    const checkpointId = `${thread.threadId}_checkpoint_${Date.now()}_${label || 'auto'}`;
    
    // Save current state as checkpoint
    await this.storage.save(checkpointId, {
      ...thread,
      threadId: checkpointId,
    });
    
    // Add checkpoint event to main thread
    threadManager.addCheckpoint(checkpointId, label, thread.events.length);
    
    return checkpointId;
  }

  /**
   * Rollback to a specific checkpoint
   */
  async rollbackToCheckpoint(
    threadId: string,
    checkpointId: string
  ): Promise<RecoveryResult> {
    try {
      // Load checkpoint
      const checkpointThread = await this.storage.load(checkpointId);
      
      // Restore original thread ID
      const restoredThread = {
        ...checkpointThread,
        threadId,
        updatedAt: new Date(),
      };
      
      // Save restored state
      await this.storage.save(threadId, restoredThread);
      
      // Create thread manager
      const threadManager = this.createThreadFromEvents(restoredThread, restoredThread.events.length);
      
      return {
        success: true,
        restoredThread: threadManager,
        strategy: 'rollback_to_checkpoint',
        message: `Rolled back to checkpoint ${checkpointId}`,
        eventsRestored: restoredThread.events.length,
        eventsSkipped: 0,
      };
      
    } catch (error) {
      return {
        success: false,
        strategy: 'rollback_to_checkpoint',
        message: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        eventsRestored: 0,
        eventsSkipped: 0,
      };
    }
  }

  /**
   * Fork a thread at a specific point for alternative execution
   */
  async forkThread(
    originalThreadId: string,
    fromEventIndex?: number,
    forkLabel?: string
  ): Promise<RecoveryResult> {
    try {
      const originalThread = await this.storage.load(originalThreadId);
      
      // Create forked thread
      const forkedThread = ThreadSerializer.forkThread(originalThread, fromEventIndex);
      
      // Add label to fork ID if provided
      if (forkLabel) {
        forkedThread.threadId = `${originalThread.threadId}_fork_${forkLabel}_${Date.now()}`;
      }
      
      // Save forked thread
      await this.storage.save(forkedThread.threadId, forkedThread);
      
      // Create thread manager for fork
      const threadManager = this.createThreadFromEvents(forkedThread, forkedThread.events.length);
      threadManager.resume(); // Forks start as resumed
      
      return {
        success: true,
        restoredThread: threadManager,
        newThreadId: forkedThread.threadId,
        strategy: 'fork_and_retry',
        message: `Forked thread at event ${fromEventIndex || 'end'}`,
        eventsRestored: forkedThread.events.length,
        eventsSkipped: originalThread.events.length - forkedThread.events.length,
      };
      
    } catch (error) {
      return {
        success: false,
        strategy: 'fork_and_retry',
        message: `Fork failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        eventsRestored: 0,
        eventsSkipped: 0,
      };
    }
  }

  /**
   * Analyze thread for potential recovery strategies
   */
  async analyzeFailure(threadId: string): Promise<RecoveryContext> {
    try {
      const thread = await this.storage.load(threadId);
      const lastEvent = thread.events[thread.events.length - 1];
      
      // Determine failure characteristics
      const hasErrors = thread.events.some(e => e.type === 'error_occurred');
      const isStuck = thread.status === 'active' && 
        (Date.now() - thread.updatedAt.getTime()) > 5 * 60 * 1000; // 5 minutes
      
      // Find last successful event
      const lastSuccessfulIndex = this.findLastSuccessfulEvent(thread);
      
      // Find nearest checkpoint
      const checkpointIndex = this.findNearestCheckpoint(thread);
      
      // Suggest recovery strategy
      let suggestedStrategy: RecoveryStrategy;
      if (hasErrors && lastSuccessfulIndex !== -1) {
        suggestedStrategy = 'rollback_to_checkpoint';
      } else if (isStuck) {
        suggestedStrategy = 'fork_and_retry';
      } else {
        suggestedStrategy = 'resume_from_last_event';
      }
      
      return {
        threadId,
        failureReason: this.determineFailureReason(thread),
        failureTimestamp: lastEvent?.timestamp || thread.updatedAt,
        lastSuccessfulEventIndex: lastSuccessfulIndex !== -1 ? lastSuccessfulIndex : undefined,
        checkpointEventIndex: checkpointIndex !== -1 ? checkpointIndex : undefined,
        suggestedStrategy,
        retryCount: this.countRetries(thread),
        maxRetries: this.maxRetries,
      };
      
    } catch (error) {
      throw new Error(`Failed to analyze thread failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recovery recommendations based on thread analysis
   */
  async getRecoveryRecommendations(threadId: string): Promise<{
    primary: RecoveryStrategy;
    alternatives: RecoveryStrategy[];
    reasoning: string;
  }> {
    const context = await this.analyzeFailure(threadId);
    
    const alternatives: RecoveryStrategy[] = [];
    let reasoning = '';
    
    switch (context.suggestedStrategy) {
      case 'resume_from_last_event':
        alternatives.push('rollback_to_checkpoint', 'fork_and_retry');
        reasoning = 'Thread appears recoverable from last event';
        break;
        
      case 'rollback_to_checkpoint':
        alternatives.push('fork_and_retry', 'restart_from_beginning');
        reasoning = 'Errors detected, rollback recommended';
        break;
        
      case 'fork_and_retry':
        alternatives.push('restart_from_beginning', 'manual_intervention');
        reasoning = 'Thread appears stuck, fork suggested';
        break;
        
      default:
        alternatives.push('restart_from_beginning', 'manual_intervention');
        reasoning = 'Complex failure, manual review needed';
    }
    
    if (context.retryCount >= context.maxRetries) {
      alternatives.unshift('manual_intervention');
      reasoning += ' (Max retries exceeded)';
    }
    
    return {
      primary: context.suggestedStrategy,
      alternatives,
      reasoning,
    };
  }

  /**
   * Apply the selected recovery strategy
   */
  private async applyRecoveryStrategy(
    thread: AgentThread,
    strategy: RecoveryStrategy
  ): Promise<RecoveryResult> {
    switch (strategy) {
      case 'restart_from_beginning':
        return this.restartFromBeginning(thread);
        
      case 'resume_from_last_event':
        return this.resumeFromLastEvent(thread);
        
      case 'rollback_to_checkpoint':
        return this.rollbackToLastCheckpoint(thread);
        
      case 'fork_and_retry':
        return this.forkAndRetry(thread);
        
      case 'manual_intervention':
        return this.requireManualIntervention(thread);
        
      default:
        throw new Error(`Unknown recovery strategy: ${strategy}`);
    }
  }

  /**
   * Create a thread manager from events up to a specific index
   */
  private createThreadFromEvents(thread: AgentThread, upToIndex: number): AgentThreadManager {
    const limitedThread = {
      ...thread,
      events: thread.events.slice(0, upToIndex),
      updatedAt: upToIndex > 0 ? thread.events[upToIndex - 1].timestamp : thread.createdAt,
    };
    
    // Create new thread manager with existing thread ID
    const manager = new AgentThreadManager(limitedThread.threadId);
    
    // Manually set the internal thread state
    // Note: This bypasses the normal construction flow for recovery purposes
    Object.defineProperty(manager, 'thread', {
      value: limitedThread,
      writable: true,
      configurable: true
    });
    
    // Call updateDerivedState to compute derived properties
    (manager as any).updateDerivedState();
    
    return manager;
  }

  // Recovery strategy implementations
  private async restartFromBeginning(thread: AgentThread): Promise<RecoveryResult> {
    const newManager = new AgentThreadManager();
    return {
      success: true,
      restoredThread: newManager,
      strategy: 'restart_from_beginning',
      message: 'Started fresh thread',
      eventsRestored: 0,
      eventsSkipped: thread.events.length,
    };
  }

  private async resumeFromLastEvent(thread: AgentThread): Promise<RecoveryResult> {
    const manager = this.createThreadFromEvents(thread, thread.events.length);
    manager.resume();
    
    return {
      success: true,
      restoredThread: manager,
      strategy: 'resume_from_last_event',
      message: 'Resumed from last event',
      eventsRestored: thread.events.length,
      eventsSkipped: 0,
    };
  }

  private async rollbackToLastCheckpoint(thread: AgentThread): Promise<RecoveryResult> {
    const checkpointIndex = this.findNearestCheckpoint(thread);
    
    if (checkpointIndex === -1) {
      return this.restartFromBeginning(thread);
    }
    
    const manager = this.createThreadFromEvents(thread, checkpointIndex);
    manager.resume();
    
    return {
      success: true,
      restoredThread: manager,
      strategy: 'rollback_to_checkpoint',
      message: `Rolled back to checkpoint at event ${checkpointIndex}`,
      eventsRestored: checkpointIndex,
      eventsSkipped: thread.events.length - checkpointIndex,
    };
  }

  private async forkAndRetry(thread: AgentThread): Promise<RecoveryResult> {
    const forkedThread = ThreadSerializer.forkThread(thread);
    const manager = this.createThreadFromEvents(forkedThread, forkedThread.events.length);
    manager.resume();
    
    return {
      success: true,
      restoredThread: manager,
      newThreadId: forkedThread.threadId,
      strategy: 'fork_and_retry',
      message: 'Created fork for retry',
      eventsRestored: forkedThread.events.length,
      eventsSkipped: 0,
    };
  }

  private async requireManualIntervention(thread: AgentThread): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: 'manual_intervention',
      message: 'Manual intervention required - thread state is too complex to auto-recover',
      eventsRestored: 0,
      eventsSkipped: thread.events.length,
    };
  }

  // Helper methods
  private findLastSuccessfulEvent(thread: AgentThread): number {
    for (let i = thread.events.length - 1; i >= 0; i--) {
      const event = thread.events[i];
      if (event.type !== 'error_occurred' && 
          !event.type.includes('failed')) {
        return i;
      }
    }
    return -1;
  }

  private findNearestCheckpoint(thread: AgentThread): number {
    for (let i = thread.events.length - 1; i >= 0; i--) {
      const event = thread.events[i];
      if (isCheckpointCreatedEvent(event)) {
        return i;
      }
    }
    return -1;
  }

  private determineFailureReason(thread: AgentThread): string {
    const errorEvents = thread.events.filter(isErrorOccurredEvent);
    if (errorEvents.length > 0) {
      return `Error: ${errorEvents[errorEvents.length - 1].data.error}`;
    }
    
    if (thread.status === 'failed') {
      return 'Thread marked as failed';
    }
    
    const timeSinceUpdate = Date.now() - thread.updatedAt.getTime();
    if (timeSinceUpdate > 5 * 60 * 1000) {
      return 'Thread appears stuck (no updates for >5 minutes)';
    }
    
    return 'Unknown failure reason';
  }

  private countRetries(thread: AgentThread): number {
    return thread.events.filter(e => 
      e.metadata?.retryCount !== undefined
    ).reduce((sum, e) => sum + (e.metadata?.retryCount || 0), 0);
  }
}