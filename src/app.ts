import fs from 'fs';
import express, { Application } from 'express';
import { Server as HttpServer } from 'http';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';

import { serverConfig, ServerEnvOptions } from './config';

import db from './db';

import {
  systemMiddleware,
  errorMonitor,
  securityMiddleware,
} from './middlewares';

import routes from './routes';
import metricsRouter from './routes/metrics.routes';

import { RedisService } from './services';
import { logger } from './utils';

class Server {
  private app: Application;

  private httpServer: HttpServer | null = null;

  private port: number;

  private corsOptions: cors.CorsOptions;

  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.port = serverConfig.server.port;
    this.corsOptions = {
      origin: serverConfig.cors.allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      credentials: true,
      maxAge: 86400, // Cache preflight requests for 24 hours
    };

    // Configure middlewares
    this.configureMiddlewares();

    // Configure routes
    this.configureRoutes();

    // Configure error handling
    this.configureErrorHandling();

    // Configure graceful shutdown
    this.configureGracefulShutdown();
  }

  /**
   * Initialize database connection
   */
  private async initializeDb(): Promise<void> {
    try {
      await db.connect();
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  /**
   * Configure Express middlewares
   */
  private configureMiddlewares(): void {
    // Trust first proxy for rate limiting
    this.app.set('trust proxy', 1);

    // Enforce HTTPS in production
    this.app.use(securityMiddleware.enforceHTTPS);

    // Compression - compress responses
    if (serverConfig.security.enableCompression) {
      this.app.use(
        compression({
          level: 6, // Balanced compression (0-9)
          threshold: 1024, // Only compress responses larger than 1KB
        }),
      );
    }

    // CORS configuration
    if (serverConfig.node.env === ServerEnvOptions.DEVELOPMENT) {
      this.app.use(cors());
    } else {
      this.app.use(cors(this.corsOptions));
    }

    // Body parsing
    this.app.use(express.json({ limit: '5mb' }));
    this.app.use(express.urlencoded({ limit: '5mb', extended: true }));

    // Security headers
    if (serverConfig.security.enableHelmet) {
      this.app.use(
        helmet({
          contentSecurityPolicy:
            serverConfig.node.env === ServerEnvOptions.PRODUCTION,
          crossOriginEmbedderPolicy:
            serverConfig.node.env === ServerEnvOptions.PRODUCTION,
        }),
      );
    }

    // Additional security measures
    this.app.use(securityMiddleware.addSecurityHeaders);

    // Enhanced rate limiting
    this.app.use(securityMiddleware.setupRateLimit());

    // Request logging
    this.app.use(systemMiddleware.requestLogger);
  }

  /**
   * Configure API routes
   */
  private configureRoutes(): void {
    // Add request tracking for metrics
    if (serverConfig.monitoring.enableMetrics) {
      this.app.use(metricsRouter.requestTracker);
    }

    // Health check endpoint
    this.app.get('/health', async (_req, res) => {
      const dbHealthy = db.isConnected();
      const redisHealthy = await RedisService.getInstance().ping(1000);

      const overall = dbHealthy && redisHealthy;
      res.status(overall ? 200 : 503).json({
        uptime: process.uptime(),
        status: overall ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        checks: {
          db: dbHealthy ? 'connected' : 'disconnected',
          redis: redisHealthy ? 'connected' : 'disconnected',
        },
      });
    });

    // Metrics endpoints
    this.app.use('/metrics', metricsRouter.router);

    // API routes
    this.app.use('/', routes);
  }

  /**
   * Configure error handling middleware
   */
  private configureErrorHandling(): void {
    // Add error monitoring middleware before main error handler
    this.app.use(errorMonitor.middleware);

    // Error handling should be the last middleware
    this.app.use(systemMiddleware.errorHandler);

    // Handle 404 errors for routes that do not exist
    this.app.use((req, res) => {
      res.status(404).json({
        message: `Route not found: ${req.method} ${req.url}`,
      });
    });
  }

  /**
   * Configure graceful shutdown handlers
   */
  private configureGracefulShutdown(): void {
    const signals = ['SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        if (this.isShuttingDown) return;

        this.isShuttingDown = true;
        logger.info(`Received ${signal}, starting graceful shutdown`);

        try {
          await this.shutDown();
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });
    });
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Setup global error handling
      errorMonitor.setupUncaughtHandlers();

      // Connect to database first
      await this.initializeDb();

      // Create HTTP server from Express app
      this.httpServer = new HttpServer(this.app);

      // Start HTTP server
      this.httpServer.listen(this.port);

      // Handle HTTP server events
      this.httpServer.on('listening', () => {
        logger.info(
          `Server running on http://localhost:${this.port} in ${serverConfig.node.env} mode`,
        );
      });

      this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
        logger.error('Server error', { error });
        throw error;
      });
    } catch (error) {
      logger.error('Failed to start server', { error });
      await this.shutDown();
      throw error;
    }
  }

  /**
   * Gracefully shut down the server
   */
  public async shutDown(): Promise<void> {
    try {
      logger.info('Shutting down server...');

      // Close HTTP server (stop accepting new connections)
      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer?.close((err) => {
            if (err) return reject(err);
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      // Close database connections
      if (db.isConnected()) {
        await db.disconnect();
      }

      logger.info('Shutdown completed successfully');
    } catch (error) {
      logger.error('Error during shutdown', { error });
      throw error;
    } finally {
      process.exit(0);
    }
  }
}

const server = new Server();
server.start().catch(() => process.exit(1));
