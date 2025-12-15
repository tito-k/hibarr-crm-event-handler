import { Router, Request, Response } from 'express';

import {
  register,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

import { serverConfig } from '../config';

import db from '../db';
import { logger } from '../utils';
import { RedisService } from '../services';
import { QueueService, CRM_WEBHOOK_QUEUE } from '../queues';

/**
 * Metrics endpoint for monitoring
 * Exposes Prometheus metrics for application monitoring
 */
class MetricsRouter {
  public router: Router;

  // Prometheus metrics
  private httpRequestDurationMs: Histogram;
  private httpRequestCounter: Counter;
  private dbConnectionGauge: Gauge;
  private redisConnectionGauge: Gauge;
  private errorCounter: Counter;
  private memoryUsage: Gauge;
  private cpuUsage: Gauge;
  private queueGauge: Gauge;
  private queueNames: string[] = [CRM_WEBHOOK_QUEUE];

  constructor() {
    this.router = Router();

    // Only initialize metrics if enabled in config
    if (serverConfig.monitoring.enableMetrics) {
      this.initializeMetrics();
      this.setupRoutes();
    } else {
      // Simple disabled route
      this.router.get('/', (_req, res) => {
        res.status(404).json({ message: 'Metrics endpoint is disabled' });
      });
    }
  }

  private initializeMetrics(): void {
    // Initialize the metrics collection
    collectDefaultMetrics({ prefix: 'hibarr_crm_event_handler_' });

    // HTTP request duration histogram
    this.httpRequestDurationMs = new Histogram({
      name: 'hibarr_crm_event_handler_http_request_duration_ms',
      help: 'Duration of HTTP requests in ms',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    });

    // HTTP request counter
    this.httpRequestCounter = new Counter({
      name: 'hibarr_crm_event_handler_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    // Database connection gauge
    this.dbConnectionGauge = new Gauge({
      name: 'hibarr_crm_event_handler_db_connections',
      help: 'Current number of database connections',
    });

    // Redis connection gauge (1 = connected, 0 = disconnected)
    this.redisConnectionGauge = new Gauge({
      name: 'hibarr_crm_event_handler_redis_connection',
      help: 'Redis connection status (1=connected, 0=disconnected)',
    });

    // Error counter
    this.errorCounter = new Counter({
      name: 'hibarr_crm_event_handler_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'code'],
    });

    // Memory usage gauge
    this.memoryUsage = new Gauge({
      name: 'hibarr_crm_event_handler_memory_usage_bytes',
      help: 'Process memory usage in bytes',
      labelNames: ['type'],
    });

    // CPU usage gauge
    this.cpuUsage = new Gauge({
      name: 'hibarr_crm_event_handler_cpu_usage_percentage',
      help: 'Process CPU usage in percentage',
    });

    // Queue state gauge with labels for queue and status
    this.queueGauge = new Gauge({
      name: 'hibarr_crm_event_handler_queue_jobs',
      help: 'BullMQ queue job counts by status',
      labelNames: ['queue', 'status'],
    });

    // Start collecting metrics
    this.startMetricsCollection();
  }

  private setupRoutes(): void {
    // Main metrics endpoint
    this.router.get('/', async (_req: Request, res: Response) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        logger.error('Error generating metrics', { error });
        res.status(500).json({ message: 'Error generating metrics' });
      }
    });

    // Health check endpoint for monitoring systems
    this.router.get('/health', async (_req: Request, res: Response) => {
      try {
        // Check database connection
        const dbHealthy = db.isConnected();
        const redisHealthy = await RedisService.getInstance().ping(1000);

        // Check memory usage
        const memoryUsage = process.memoryUsage();
        const memoryUsagePercentage =
          (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

        // Determine overall health
        const isHealthy =
          dbHealthy && redisHealthy && memoryUsagePercentage < 90;

        res.status(isHealthy ? 200 : 503).json({
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: {
            database: {
              status: dbHealthy ? 'healthy' : 'unhealthy',
            },
            redis: {
              status: redisHealthy ? 'healthy' : 'unhealthy',
            },
            memory: {
              status: memoryUsagePercentage < 90 ? 'healthy' : 'warning',
              usage: `${memoryUsagePercentage.toFixed(2)}%`,
              heapUsed: memoryUsage.heapUsed,
              heapTotal: memoryUsage.heapTotal,
            },
            uptime: {
              status: 'healthy',
              value: process.uptime(),
            },
          },
        });
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(500).json({
          status: 'error',
          message: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Queue metrics as JSON (useful for debugging dashboards)
    this.router.get('/queues', async (_req: Request, res: Response) => {
      try {
        const svc = QueueService.getInstance();
        const results = await Promise.all(
          this.queueNames.map(async (name) => ({
            queue: name,
            counts: await svc.getQueueCounts(name),
          })),
        );
        res.json({ queues: results });
      } catch (error) {
        logger.error('Error generating queue metrics', { error });
        res.status(500).json({ message: 'Error generating queue metrics' });
      }
    });
  }

  private startMetricsCollection(): void {
    // Collect system metrics at regular intervals
    setInterval(() => {
      try {
        // Collect memory usage
        const memUsage = process.memoryUsage();
        this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
        this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
        this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
        this.memoryUsage.set({ type: 'external' }, memUsage.external);

        // Collect database connection status
        this.dbConnectionGauge.set(db.isConnected() ? 1 : 0);

        // Collect redis connection status (ES6 import)
        RedisService.getInstance()
          .ping(500)
          .then((healthy) => this.redisConnectionGauge.set(healthy ? 1 : 0))
          .catch((error) => {
            this.redisConnectionGauge.set(0);
            logger.error('Error collecting Redis metrics', { error });
          });

        // Collect BullMQ queue metrics
        this.collectQueueMetrics().catch((error) =>
          logger.error('Error collecting queue metrics', { error }),
        );

        // // Check backlog alerts (non-blocking)
        // checkAndAlertQueueBacklog(this.queueNames).catch((error) =>
        //   logger.error('Error running queue backlog alert', { error }),
        // );
      } catch (error) {
        logger.error('Error collecting metrics', { error });
      }
    }, 5000);
  }

  /**
   * Collect BullMQ queue metrics using QueueService
   */
  private async collectQueueMetrics(): Promise<void> {
    const svc = QueueService.getInstance();
    for (const name of this.queueNames) {
      try {
        const counts = await svc.getQueueCounts(name);
        this.queueGauge.set({ queue: name, status: 'waiting' }, counts.waiting);
        this.queueGauge.set({ queue: name, status: 'active' }, counts.active);
        this.queueGauge.set({ queue: name, status: 'delayed' }, counts.delayed);
        this.queueGauge.set({ queue: name, status: 'failed' }, counts.failed);
        this.queueGauge.set(
          { queue: name, status: 'completed' },
          counts.completed,
        );
        this.queueGauge.set({ queue: name, status: 'paused' }, counts.paused);
      } catch (error) {
        // Set gauges to 0 on error to avoid stale metrics
        this.queueGauge.set({ queue: name, status: 'waiting' }, 0);
        this.queueGauge.set({ queue: name, status: 'active' }, 0);
        this.queueGauge.set({ queue: name, status: 'delayed' }, 0);
        this.queueGauge.set({ queue: name, status: 'failed' }, 0);
        this.queueGauge.set({ queue: name, status: 'completed' }, 0);
        this.queueGauge.set({ queue: name, status: 'paused' }, 0);
        logger.error('Error fetching counts for queue', { queue: name, error });
      }
    }
  }

  /**
   * Middleware to track HTTP requests
   */
  public requestTracker = (
    req: Request,
    res: Response,
    next: Function,
  ): void => {
    if (!serverConfig.monitoring.enableMetrics) {
      return next();
    }

    // Skip metrics collection for metrics endpoint itself
    if (req.path.startsWith('/metrics')) {
      return next();
    }

    // Track request timing
    const startTime = Date.now();

    // Track response
    const originalEnd = res.end;
    res.end = (...args: any[]) => {
      // Calculate request duration
      const responseTime = Date.now() - startTime;

      // Extract route path - normalize dynamic routes
      let route = req.route ? req.route.path : req.path;
      route = route.replace(/\/[0-9a-f]{8,}/g, '/:id');

      // Record metrics
      this.httpRequestCounter.inc({
        method: req.method,
        route,
        status_code: res.statusCode,
      });

      this.httpRequestDurationMs.observe(
        {
          method: req.method,
          route,
          status_code: res.statusCode,
        },
        responseTime,
      );

      // Track errors
      if (res.statusCode >= 400) {
        this.errorCounter.inc({
          type: 'http',
          code: res.statusCode,
        });
      }

      // Call the original end function
      return originalEnd.apply(res, args);
    };

    next();
  };
}

export default new MetricsRouter();
