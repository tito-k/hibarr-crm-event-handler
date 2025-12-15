import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

import { serverConfig, ServerEnvOptions } from '../config';
import { logger } from '../utils';

/**
 * ErrorMonitor class for centralized error tracking and monitoring
 * Can be extended to integrate with third-party error monitoring services like Sentry
 */
class ErrorMonitor {
  private readonly isProduction: boolean;

  constructor() {
    this.isProduction = serverConfig.node.env === ServerEnvOptions.PRODUCTION;
  }

  /**
   * Captures an error and logs it with appropriate context
   * @param error Error to capture
   * @param request Express request object (optional)
   * @param additionalContext Additional context for the error (optional)
   */
  capture(
    error: Error,
    request?: Request,
    additionalContext: Record<string, any> = {},
  ): void {
    // Generate correlation id for this error and attach for downstream usage
    const errorId = randomUUID();
    // Basic context
    const context: Record<string, any> = {
      errorName: error.name,
      stack: error.stack,
      errorId,
      ...additionalContext,
    };

    // Add request context if available
    if (request) {
      const { method, path, ip } = request;
      context.request = {
        method,
        path,
        ip,
        userAgent: request.headers['user-agent'],
        referrer: request.headers.referer || request.headers.referrer,
      };

      // Add user context if authenticated
      if ((request as any).user) {
        context.user = {
          id: (request as any).user.id,
          // Don't include sensitive user data
        };
      }

      // Attach to response locals for error handler to include in response
      try {
        (request as any).res?.locals &&
          ((request as any).res.locals.errorId = errorId);
      } catch {}
    }

    // Log the error with context
    logger.error(`Error captured: ${error.message}`, context);

    // Integration point: Send to third-party error monitoring service
    this.sendToErrorService(error, context);
  }

  /**
   * Send error to third-party error monitoring service
   * This is a placeholder method for future integration
   * @param error Error to send
   * @param context Error context
   */
  private sendToErrorService(error: Error, context: Record<string, any>): void {
    // Placeholder for integration with services like Sentry, Rollbar, etc.
    // Example Sentry integration:
    // if (Sentry && this.isProduction) {
    //   Sentry.withScope((scope) => {
    //     // Add context data to the error
    //     Object.keys(context).forEach((key) => {
    //       scope.setExtra(key, context[key]);
    //     });
    //     // Capture the error
    //     Sentry.captureException(error);
    //   });
    // }
  }

  /**
   * Middleware to handle uncaught promise rejections
   */
  setupUncaughtHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.capture(error, undefined, { source: 'uncaughtException' });

      // Force exit after uncaught exception in production
      if (this.isProduction) {
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      this.capture(error, undefined, { source: 'unhandledRejection' });
    });
  }

  /**
   * Express middleware to track error responses
   */
  middleware = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    // Add error classification
    const errorContext: Record<string, any> = {
      severity: this.classifyError(error),
      route: `${req.method} ${req.path}`,
      timestamp: new Date().toISOString(),
    };

    // Capture the error with additional context
    this.capture(error, req, errorContext);

    // Continue to the next error handler
    next(error);
  };

  /**
   * Classify the severity of an error
   * @param error Error to classify
   * @returns Severity classification (critical, error, warning)
   */
  private classifyError(error: Error): string {
    // Check for timeout or connection errors
    if (
      error.message.includes('timeout') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    ) {
      return 'warning';
    }

    // Check for critical errors
    if (
      error.message.includes('memory') ||
      error.message.includes('heap') ||
      error.name === 'RangeError' ||
      error.name === 'SystemError'
    ) {
      return 'critical';
    }

    // Default to standard error
    return 'error';
  }
}

export default new ErrorMonitor();
