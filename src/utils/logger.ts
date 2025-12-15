import fs from 'fs';
import path from 'path';
import {
  createLogger,
  format,
  transports,
  Logger as WinstonLogger,
} from 'winston';
import 'winston-daily-rotate-file';
import util from 'util';

import { serverConfig, ServerEnvOptions } from '../config';

class Logger {
  private errorLogger: WinstonLogger;

  private infoLogger: WinstonLogger;

  private requestLogger: WinstonLogger;

  private debugLogger: WinstonLogger;

  private queryLogger: WinstonLogger;

  private isDevelopment =
    serverConfig.node.env === ServerEnvOptions.DEVELOPMENT;

  // Resolve log directory relative to process cwd to be predictable in containers
  private logDirectory = path.resolve(
    process.cwd(),
    serverConfig.logging.directoryName,
  );

  // Custom log levels
  private customLevels = {
    levels: {
      error: 0,
      warn: 1,
      info: 2,
      query: 3,
      http: 4,
      debug: 5,
    },
  };

  constructor() {
    // Initialize loggers based on environment
    if (this.isDevelopment) {
      this.initializeDevLoggers();
    } else {
      this.initializeProdLoggers();
    }
  }

  /**
   * Safely stringify metadata for file logs without throwing on circular structures
   * - Handles Error objects
   * - Skips functions
   * - Collapses known heavy/circular ORM internals
   */
  private safeStringify(meta: Record<string, unknown>): string {
    const seen = new WeakSet<object>();
    const replacer = (key: string, value: any) => {
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      if (typeof value === 'function') return undefined;
      if (value && typeof value === 'object') {
        if (seen.has(value)) return undefined;
        seen.add(value);
        const ctor = value.constructor?.name || '';
        if (ctor.includes('Sequelize') || ctor.includes('Dialect')) {
          return `[${ctor}]`;
        }
        if ('sequelize' in (value as any)) {
          return '[SequelizeInstance]';
        }
      }
      return value;
    };
    try {
      return JSON.stringify(meta, replacer, 2);
    } catch {
      // Fallback to util.inspect to avoid breaking logging
      return util.inspect(meta, { depth: 2, colors: false, compact: false });
    }
  }

  /**
   * Initialize loggers for development (console only)
   */
  private initializeDevLoggers(): void {
    // Create base logger with console transport
    const consoleFormat = this.getConsoleFormat();

    const baseLogger = createLogger({
      levels: this.customLevels.levels,
      format: consoleFormat,
      transports: [
        new transports.Console({
          level: serverConfig.logging.level,
        }),
      ],
      exitOnError: false,
    });

    // Clone the base logger for each level
    this.errorLogger = baseLogger.child({ level: 'error' });
    this.infoLogger = baseLogger.child({ level: 'info' });
    this.requestLogger = baseLogger.child({ level: 'http' });
    this.debugLogger = baseLogger.child({ level: 'debug' });
    this.queryLogger = baseLogger.child({ level: 'query' });
  }

  /**
   * Initialize loggers for production (file only)
   */
  private initializeProdLoggers(): void {
    this.errorLogger = this.createLevelLogger('error');
    this.infoLogger = this.createLevelLogger('info');
    this.requestLogger = this.createLevelLogger('http');
    this.debugLogger = this.createLevelLogger('debug');
    this.queryLogger = this.createLevelLogger('query');
  }

  /**
   * Creates a logger for a specific log level (used in production)
   */
  private createLevelLogger(level: string, folderName?: string): WinstonLogger {
    const folder = folderName || level;
    const fileFormat =
      level === 'query' ? this.getQueryFormat() : this.getFileFormat();

    // Ensure folder exists
    const targetDir = path.join(this.logDirectory, folder);
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } catch {}

    return createLogger({
      level,
      levels: this.customLevels.levels,
      format: fileFormat,
      transports: [
        new transports.DailyRotateFile({
          filename: path.join(targetDir, `%DATE%-${level}.log`),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '365d',
        }),
      ],
      exitOnError: false,
    });
  }

  /**
   * Remove Winston symbol internals and common top-level fields from meta before console printing
   */
  private sanitizeConsoleMeta(
    meta: Record<string, unknown>,
  ): Record<string, unknown> {
    const cleaned: Record<string, unknown> = { ...meta };

    // Remove known string keys we don't want duplicated in meta block
    delete cleaned.level;
    delete cleaned.message;
    delete cleaned.timestamp;

    // Remove Winston symbol keys (e.g., Symbol(level), Symbol(splat), Symbol(message))
    for (const sym of Object.getOwnPropertySymbols(cleaned)) {
      const desc = (sym as any).description;
      if (desc === 'level' || desc === 'splat' || desc === 'message') {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (cleaned as any)[sym];
      }
    }

    return cleaned;
  }

  /**
   * Get console format with colors
   */
  private getConsoleFormat() {
    return format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.splat(),
      format.colorize(),
      format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;

        // Add stack trace if available
        if (stack) {
          log += `\n${stack}`;
        }

        // Add metadata if present
        if (Object.keys(meta).length > 0) {
          // Remove Winston internals before printing
          const cleaned = this.sanitizeConsoleMeta(meta);
          if (Object.keys(cleaned).length > 0) {
            // util.inspect gracefully handles remaining structures for console
            log += `\n${util.inspect(cleaned, {
              depth: 3,
              colors: true,
              compact: false,
            })}`;
          }
        }

        return log;
      }),
    );
  }

  /**
   * Get file format
   */
  private getFileFormat() {
    return format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.splat(),
      format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        if (stack) log += `\n${stack}`;
        if (Object.keys(meta).length > 0) {
          log += `\nMetadata: ${this.safeStringify(meta)}`;
        }
        return log;
      }),
    );
  }

  /**
   * Get specialized format for query logs
   */
  private getQueryFormat() {
    return format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(({ timestamp, message, ...meta }) => {
        let log = `${timestamp} [QUERY]: ${message}`;

        // Format query-specific metadata
        if (meta.executionTime) {
          log += ` (${meta.executionTime}ms)`;
        }

        if (meta.sql) {
          log += `\nSQL: ${meta.sql}`;
        }

        if (
          meta.parameters &&
          Array.isArray(meta.parameters) &&
          meta.parameters.length > 0
        ) {
          log += `\nParameters: ${JSON.stringify(meta.parameters)}`;
        }

        if (meta.affected !== undefined) {
          log += `\nRows Affected: ${meta.affected}`;
        }

        // Add any other metadata
        const otherMeta = { ...meta };
        delete otherMeta.executionTime;
        delete otherMeta.sql;
        delete otherMeta.parameters;
        delete otherMeta.affected;

        if (Object.keys(otherMeta).length > 0) {
          log += `\nAdditional: ${this.safeStringify(otherMeta)}`;
        }

        return log;
      }),
    );
  }

  /**
   * Logs error messages
   */
  public error(message: string, meta?: Record<string, unknown> | Error): void {
    if (meta instanceof Error) {
      this.errorLogger.error(message, { error: meta });
    } else {
      this.errorLogger.error(message, meta);
    }
  }

  /**
   * Logs warning messages
   */
  public warn(message: string, meta?: Record<string, unknown>): void {
    this.infoLogger.warn(message, meta);
  }

  /**
   * Logs informational messages
   */
  public info(message: string, meta?: Record<string, unknown>): void {
    this.infoLogger.info(message, meta);
  }

  /**
   * Logs debug messages
   */
  public debug(message: string, meta?: Record<string, unknown>): void {
    this.debugLogger.debug(message, meta);
  }

  /**
   * Logs HTTP requests
   */
  public http(message: string, meta?: Record<string, unknown>): void {
    this.requestLogger.log('http', message, meta);
  }

  /**
   * Logs database queries with performance metrics
   */
  public query(
    message: string,
    meta?: {
      sql?: string;
      executionTime?: number;
      parameters?: any[];
      affected?: number;
      [key: string]: any;
    },
  ): void {
    this.queryLogger.log('query', message, meta);
  }

  /**
   * For morgan integration
   */
  public getHttpLogStream(): { write: (message: string) => void } {
    return {
      write: (message: string) => {
        this.http(message.trim());
      },
    };
  }
}

export default new Logger();
