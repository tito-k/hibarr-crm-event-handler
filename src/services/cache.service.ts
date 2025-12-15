import { logger } from '../utils';
import { RedisService } from './third-party';

export class CacheService {
  private memory = new Map<string, { value: string; expires: number }>();
  private redis = RedisService.getInstance();

  private async tryRedis<T>(
    fn: () => Promise<T>,
    fallback: () => T,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      logger.warn('Falling back to in-memory cache due to Redis error', {
        err,
      });
      return fallback();
    }
  }

  async get(key: string): Promise<string | null> {
    return this.tryRedis(
      async () => (await this.redis.get(key)) ?? null,
      () => {
        const item = this.memory.get(key);
        if (!item) return null;
        if (item.expires < Date.now()) {
          this.memory.delete(key);
          return null;
        }
        return item.value;
      },
    );
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    return this.tryRedis(
      async () => {
        await this.redis.setex(key, seconds, value);
      },
      () => {
        this.memory.set(key, { value, expires: Date.now() + seconds * 1000 });
      },
    );
  }

  async del(key: string): Promise<void> {
    return this.tryRedis(
      async () => {
        await this.redis.del(key);
      },
      () => {
        this.memory.delete(key);
      },
    );
  }
}
