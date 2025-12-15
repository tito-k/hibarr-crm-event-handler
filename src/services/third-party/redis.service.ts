import IORedis, { Redis } from 'ioredis';
import { serverConfig } from '../../config';
import { logger } from '../../utils';

class RedisService {
  private static instance: RedisService;
  private client: Redis | null = null;
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;

  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private getClient(): Redis {
    if (!this.client) {
      this.client = new IORedis(serverConfig.redis.uri, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: false,
      });

      this.client.on('error', (err) => logger.error('Redis error', { err }));
      this.client.on('reconnecting', () =>
        logger.warn('Redis reconnecting to server...'),
      );
      this.client.on('connect', () =>
        logger.info('Redis connected successfully.'),
      );
      this.client.on('end', () => logger.warn('Redis connection closed'));
    }

    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.getClient().setex(key, seconds, value);
  }

  async del(key: string): Promise<number> {
    return this.getClient().del(key);
  }

  async quit(): Promise<void> {
    if (this.client && this.client.status === 'ready') {
      await this.client.quit();
    }
    if (this.publisher && this.publisher.status === 'ready') {
      await this.publisher.quit();
    }
    if (this.subscriber && this.subscriber.status === 'ready') {
      await this.subscriber.quit();
    }
  }

  /** Quick health probe: returns true if PING succeeds, false otherwise */
  async ping(timeoutMs = 1000): Promise<boolean> {
    try {
      const client = this.getClient();
      const pingPromise = client.ping();
      const result = await Promise.race<string | symbol>([
        pingPromise,
        new Promise<symbol>((resolve) =>
          setTimeout(() => resolve(Symbol('timeout')), timeoutMs),
        ),
      ]);
      return result === 'PONG';
    } catch (err) {
      logger.warn('Redis ping failed', { err });
      return false;
    }
  }

  isOpen(): boolean {
    return !!this.client && this.client.status === 'ready';
  }

  // Pub/Sub for Socket.IO cross-process communication
  getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = new IORedis(serverConfig.redis.uri);
      this.publisher.on('error', (err) =>
        logger.error('Redis publisher error', { err }),
      );
    }
    return this.publisher;
  }

  getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = new IORedis(serverConfig.redis.uri);
      this.subscriber.on('error', (err) =>
        logger.error('Redis subscriber error', { err }),
      );
    }
    return this.subscriber;
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.getPublisher().publish(channel, message);
  }

  async subscribe(channel: string): Promise<void> {
    await this.getSubscriber().subscribe(channel);
  }

  onMessage(callback: (channel: string, message: string) => void): void {
    this.getSubscriber().on('message', callback);
  }
}

export default RedisService;
