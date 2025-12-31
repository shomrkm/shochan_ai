import { createClient, type RedisClientType } from 'redis';
import { Thread } from '@shochan_ai/core';

/**
 * Redis-based state store for Web API.
 * Stores Thread state by conversationId with TTL (Time To Live).
 */
export class RedisStateStore {
	private client: RedisClientType;
	private readonly keyPrefix: string;
	private readonly ttlSeconds = 3600; // 1 hour

	constructor(redisUrl?: string, keyPrefix?: string) {
		this.client = createClient({
			url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
		});

		this.keyPrefix = keyPrefix || 'shochan_ai:conversation:';

		this.client.on('error', (err) => {
			console.error('Redis Client Error:', err);
		});
	}

	/**
	 * Connect to Redis server.
	 * Must be called before using get/set/delete operations.
	 */
	async connect(): Promise<void> {
		if (!this.client.isOpen) {
			await this.client.connect();
			console.log('✅ Connected to Redis');
		}
	}

	/**
	 * Disconnect from Redis server.
	 */
	async disconnect(): Promise<void> {
		if (this.client.isOpen) {
			await this.client.disconnect();
			console.log('👋 Disconnected from Redis');
		}
	}

	/**
	 * Get Thread state by conversationId.
	 * Returns null if not found or expired.
	 */
	async get(conversationId: string): Promise<Thread | null> {
		const key = this.getKey(conversationId);
		const data = await this.client.get(key);

		if (!data) {
			return null;
		}

		try {
			const parsed = JSON.parse(data)
			return new Thread(parsed.events || []);
		} catch (error) {
			console.error(`Failed to parse Thread for ${conversationId}:`, error);
			return null;
		}
	}

	/**
	 * Set Thread state by conversationId with TTL.
	 */
	async set(conversationId: string, thread: Thread): Promise<void> {
		const key = this.getKey(conversationId);
		const data = JSON.stringify({
			events: thread.events,
			timestamp: Date.now(),
		});

		await this.client.set(key, data, {
			EX: this.ttlSeconds,
		});
	}

	/**
	 * Delete Thread state by conversationId.
	 */
	async delete(conversationId: string): Promise<void> {
		const key = this.getKey(conversationId);
		await this.client.del(key);
	}

	/**
	 * Clear all Thread states.
	 */
	async clear(): Promise<void> {
		const pattern = `${this.keyPrefix}*`;
		const keys = await this.client.keys(pattern);
		if (keys.length > 0) {
			await this.client.del(keys);
		}
	}

	/**
	 * List all conversation IDs.
	 * Warning: This scans all keys with the prefix, which can be slow for large datasets.
	 */
	async list(): Promise<string[]> {
		const pattern = `${this.keyPrefix}*`;
		const keys = await this.client.keys(pattern);
		return keys.map((key) => key.replace(this.keyPrefix, ''));
	}

	/**
	 * Check if Redis is connected.
	 */
	isConnected(): boolean {
		return this.client.isOpen;
	}

	private getKey(conversationId: string): string {
		return `${this.keyPrefix}${conversationId}`;
	}
}
