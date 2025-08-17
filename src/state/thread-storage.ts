import fs from 'fs/promises';
import path from 'path';
import type { AgentThread } from '../types/thread-types';
import { ThreadSerializer } from './thread-serializer';

/**
 * Storage interface for different persistence backends
 */
export interface ThreadStorage {
  save(threadId: string, thread: AgentThread): Promise<void>;
  load(threadId: string): Promise<AgentThread>;
  delete(threadId: string): Promise<void>;
  list(): Promise<string[]>;
  exists(threadId: string): Promise<boolean>;
}

/**
 * File system based thread storage implementation
 */
export class FileSystemThreadStorage implements ThreadStorage {
  private storageDir: string;

  constructor(storageDir: string = './threads') {
    this.storageDir = storageDir;
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to initialize storage directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save thread to file system
   */
  async save(threadId: string, thread: AgentThread): Promise<void> {
    await this.initialize();
    
    const validation = ThreadSerializer.validateThread(thread);
    if (!validation.isValid) {
      throw new Error(`Invalid thread structure: ${validation.errors.join(', ')}`);
    }

    try {
      const serializedData = ThreadSerializer.serialize(thread);
      const filePath = this.getThreadFilePath(threadId);
      
      await fs.writeFile(filePath, serializedData, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save thread ${threadId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load thread from file system
   */
  async load(threadId: string): Promise<AgentThread> {
    try {
      const filePath = this.getThreadFilePath(threadId);
      const serializedData = await fs.readFile(filePath, 'utf-8');
      
      return ThreadSerializer.deserialize(serializedData);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Thread ${threadId} not found`);
      }
      throw new Error(`Failed to load thread ${threadId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete thread from file system
   */
  async delete(threadId: string): Promise<void> {
    try {
      const filePath = this.getThreadFilePath(threadId);
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return; // Already deleted, no error
      }
      throw new Error(`Failed to delete thread ${threadId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all stored thread IDs
   */
  async list(): Promise<string[]> {
    try {
      await this.initialize();
      const files = await fs.readdir(this.storageDir);
      
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      throw new Error(`Failed to list threads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if thread exists
   */
  async exists(threadId: string): Promise<boolean> {
    try {
      const filePath = this.getThreadFilePath(threadId);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file path for thread
   */
  private getThreadFilePath(threadId: string): string {
    // Sanitize threadId for file system
    const sanitizedId = threadId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `${sanitizedId}.json`);
  }
}

/**
 * In-memory thread storage for testing
 */
export class InMemoryThreadStorage implements ThreadStorage {
  private threads = new Map<string, string>();

  async save(threadId: string, thread: AgentThread): Promise<void> {
    const validation = ThreadSerializer.validateThread(thread);
    if (!validation.isValid) {
      throw new Error(`Invalid thread structure: ${validation.errors.join(', ')}`);
    }

    try {
      const serializedData = ThreadSerializer.serialize(thread);
      this.threads.set(threadId, serializedData);
    } catch (error) {
      throw new Error(`Failed to save thread ${threadId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async load(threadId: string): Promise<AgentThread> {
    const serializedData = this.threads.get(threadId);
    if (!serializedData) {
      throw new Error(`Thread ${threadId} not found`);
    }

    try {
      return ThreadSerializer.deserialize(serializedData);
    } catch (error) {
      throw new Error(`Failed to load thread ${threadId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async delete(threadId: string): Promise<void> {
    this.threads.delete(threadId);
  }

  async list(): Promise<string[]> {
    return Array.from(this.threads.keys());
  }

  async exists(threadId: string): Promise<boolean> {
    return this.threads.has(threadId);
  }

  /**
   * Clear all threads (for testing)
   */
  clear(): void {
    this.threads.clear();
  }
}

/**
 * Thread storage manager with automatic backup and recovery
 */
export class ThreadStorageManager {
  constructor(
    private storage: ThreadStorage,
    private backupStorage?: ThreadStorage
  ) {}

  /**
   * Save thread with optional backup
   */
  async saveThread(thread: AgentThread): Promise<void> {
    try {
      // Save to primary storage
      await this.storage.save(thread.threadId, thread);
      
      // Save to backup if available
      if (this.backupStorage) {
        try {
          await this.backupStorage.save(thread.threadId, thread);
        } catch (error) {
          console.warn(`Backup save failed for thread ${thread.threadId}:`, error);
        }
      }
    } catch (error) {
      throw new Error(`Failed to save thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load thread with fallback to backup
   */
  async loadThread(threadId: string): Promise<AgentThread> {
    try {
      return await this.storage.load(threadId);
    } catch (error) {
      // Try backup storage if primary fails
      if (this.backupStorage) {
        try {
          console.warn(`Primary storage failed, trying backup for thread ${threadId}`);
          return await this.backupStorage.load(threadId);
        } catch (backupError) {
          throw new Error(`Thread ${threadId} not found in primary or backup storage`);
        }
      }
      throw error;
    }
  }

  /**
   * Delete thread from both storages
   */
  async deleteThread(threadId: string): Promise<void> {
    await this.storage.delete(threadId);
    
    if (this.backupStorage) {
      try {
        await this.backupStorage.delete(threadId);
      } catch (error) {
        console.warn(`Backup delete failed for thread ${threadId}:`, error);
      }
    }
  }

  /**
   * List threads from primary storage
   */
  async listThreads(): Promise<string[]> {
    return await this.storage.list();
  }

  /**
   * Check if thread exists in primary storage
   */
  async threadExists(threadId: string): Promise<boolean> {
    return await this.storage.exists(threadId);
  }

  /**
   * Get thread metadata without loading full thread
   */
  async getThreadMetadata(threadId: string) {
    const thread = await this.loadThread(threadId);
    return ThreadSerializer.getThreadStatistics(thread);
  }
}