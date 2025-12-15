/**
 * Queue management module
 *
 * Central export point for all queue-related functionality:
 * - QueueService: Singleton for managing BullMQ queues, workers, and Redis connection
 * - Domain queues: Hibarr CRM etc.
 */

export { default as QueueService } from '../services/third-party/queue.service';

// Domain-specific queues
export * from './crm';
