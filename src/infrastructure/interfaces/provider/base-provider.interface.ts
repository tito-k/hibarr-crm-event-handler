/**
 * Configuration for rate limiting
 */
export interface IRateLimitConfig {
  dailyLimit: number;
  keyPrefix: string;
}

/**
 * Configuration for caching
 */
export interface ICacheConfig {
  tokenTTL?: number; // Token cache time-to-live in seconds
  dataTTL?: number; // Data cache time-to-live in seconds
  refreshBuffer?: number; // Buffer time in ms before token expiry to trigger refresh
}

/**
 * Base provider configuration
 */
export interface IBaseProviderConfig {
  baseURL: string;
  redisKeyPrefix?: string;
  cacheConfig?: ICacheConfig;
  rateLimitConfig?: IRateLimitConfig;
  timeout?: number;
}

/**
 * Response structure for entity queries
 */
export interface IEntityResponse<T> {
  d?: T | { results?: T[] } | T[];
}

/**
 * Rate limit status information
 */
export interface IRateLimitStatus {
  currentCount: number;
  dailyLimit: number;
  remainingCalls: number;
  resetTime: string;
  isLimitReached: boolean;
}

/**
 * Cache entry with expiration
 */
export interface ICacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * HTTP methods supported by providers
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Request options for provider HTTP calls
 */
export interface IProviderRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  data?: any;
  params?: Record<string, any>;
  timeout?: number;
  bypassRateLimit?: boolean; // Internal use only - bypass rate limit check
  useCache?: boolean; // Whether to use cache for this request
  cacheTTL?: number; // Custom TTL for this request's cache
}

/**
 * Options for entity retrieval with caching
 */
export interface IEntityCacheOptions {
  useCache?: boolean;
  cacheTTL?: number;
  idParamName?: 'guid' | 'id' | 'filter';
}

/**
 * Options for collection retrieval with caching
 */
export interface ICollectionCacheOptions {
  cacheKey?: string;
  cacheTTL?: number;
  filter?: string;
}
