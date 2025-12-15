import IORedis, { Redis } from 'ioredis';
import { Queue, QueueEvents, Worker, Job, JobsOptions } from 'bullmq';
import { serverConfig } from '../../config';
import { logger } from '../../utils';

type QueueName = string;

interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: number;
}

type ProcessorFunction<T = any> = (job: Job<T>) => Promise<any>;

class QueueService {
  private static instance: QueueService;
  private connection: Redis | null = null;
  private queues: Map<QueueName, Queue> = new Map();
  private queueEvents: Map<QueueName, QueueEvents> = new Map();

  private constructor() {}

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  getConnection(): Redis {
    if (!this.connection) {
      this.connection = new IORedis(serverConfig.redis.uri, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.connection.on('connect', () =>
        logger.info('BullMQ Redis connected'),
      );
      this.connection.on('error', (err: Error) =>
        logger.error('BullMQ Redis error', { err }),
      );
      this.connection.on('end', () =>
        logger.warn('BullMQ Redis connection closed'),
      );
    }
    return this.connection;
  }

  getQueue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.getConnection() });
      this.queues.set(name, queue);

      const queueEvents = new QueueEvents(name, {
        connection: this.getConnection(),
      });
      queueEvents.on('completed', ({ jobId }: { jobId: string }) =>
        logger.info('Job completed', { queue: name, jobId }),
      );
      queueEvents.on(
        'failed',
        ({ jobId, failedReason }: { jobId: string; failedReason: string }) =>
          logger.error('Job failed', { queue: name, jobId, failedReason }),
      );
      this.queueEvents.set(name, queueEvents);
    }
    return queue;
  }

  createWorker<T = any>(
    name: QueueName,
    processor: ProcessorFunction<T>,
    options?: { concurrency?: number },
  ): Worker<T> {
    const worker = new Worker<T>(name, processor, {
      connection: this.getConnection(),
      concurrency: options?.concurrency,
    });

    worker.on('active', (job: Job<T>) =>
      logger.debug('Job active', { queue: name, jobId: job.id }),
    );
    worker.on('completed', (job: Job<T>) =>
      logger.info('Job completed', { queue: name, jobId: job.id }),
    );
    worker.on('failed', (job: Job<T> | undefined, err: Error) =>
      logger.error('Job failed', { queue: name, jobId: job?.id, err }),
    );

    return worker;
  }

  async enqueue<T = any>(
    name: QueueName,
    data: T,
    opts?: JobsOptions,
  ): Promise<string | undefined> {
    const queue = this.getQueue(name);
    const job = await queue.add('process', data, {
      removeOnComplete: 1000,
      removeOnFail: 1000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      ...opts,
    });
    return job.id;
  }

  async getQueueCounts(name: QueueName): Promise<QueueCounts> {
    const queue = this.getQueue(name);
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
      'paused',
    );
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      delayed: counts.delayed || 0,
      failed: counts.failed || 0,
      completed: counts.completed || 0,
      paused: counts.paused || 0,
    };
  }

  async closeAll(): Promise<void> {
    // Close all queue event listeners
    for (const [name, queueEvents] of this.queueEvents.entries()) {
      try {
        await queueEvents.close();
        logger.info('QueueEvents closed', { queue: name });
      } catch (err) {
        logger.error('Error closing QueueEvents', { queue: name, err });
      }
    }

    // Close all queues
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        logger.info('Queue closed', { queue: name });
      } catch (err) {
        logger.error('Error closing queue', { queue: name, err });
      }
    }

    // Close Redis connection
    if (this.connection && this.connection.status === 'ready') {
      try {
        await this.connection.quit();
        logger.info('BullMQ Redis connection closed');
      } catch (err) {
        logger.error('Error closing BullMQ Redis connection', { err });
      }
    }

    // Clear maps
    this.queueEvents.clear();
    this.queues.clear();
    this.connection = null;
  }
}

export default QueueService;
