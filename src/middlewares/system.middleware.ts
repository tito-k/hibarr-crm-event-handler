import { Request, Response, NextFunction } from 'express';
import Joi, { ValidationResult } from 'joi';
import morgan from 'morgan';

import { serverConfig, ServerEnvOptions } from '../config';

import { SystemError } from '../errors';
import { logger } from '../utils';

class SystemMiddlewares {
  /**
   * Global error handler middleware
   * Handles different types of errors and formats responses accordingly
   */
  errorHandler(
    error: SystemError,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const { method, path } = req;

    const isProduction = serverConfig.node.env === ServerEnvOptions.PRODUCTION;

    // Normalize status code: prefer numeric fields, avoid strings like 'ENOTFOUND'
    const anyErr = error as any;
    let errorCode: number = 500;
    if (typeof anyErr.status === 'number') {
      errorCode = anyErr.status;
    } else if (typeof anyErr.statusCode === 'number') {
      errorCode = anyErr.statusCode;
    } else if (anyErr.response && typeof anyErr.response.status === 'number') {
      errorCode = anyErr.response.status;
    } else if (typeof anyErr.code === 'number') {
      errorCode = anyErr.code;
    }

    // If headers already sent, delegate to Express's default error handler
    if (res.headersSent) {
      return next(error);
    }

    if (error instanceof Joi.ValidationError) {
      res.status(400).json({
        message: 'Validation error.',
        data: {
          error: error.details.map((detail) => detail.message),
        },
      });
      return;
    }

    // Network/axios-like errors without response -> treat as Bad Gateway
    const isNetworkError =
      anyErr?.isAxiosError && (!anyErr.response || !anyErr.response.status);
    if (isNetworkError) {
      errorCode = 502;
      if (!isProduction) {
        error.message = `Upstream service unreachable: ${anyErr.code || 'NETWORK_ERROR'}`;
      } else {
        error.message = 'Upstream service unreachable';
      }
    }

    if (errorCode === 500 && isProduction) {
      res.status(500).json({
        message: 'An unexpected error occurred. Please try again later.',
      });
      return;
    }

    const errorId = (res.locals && (res.locals as any).errorId) || undefined;

    res.status(errorCode).json({
      message: error.message,
      data: {
        ...(error.errors && { error: error.errors }),
        ...(!isProduction && { trace: error.stack, method, path }),
        ...(errorId && { errorId }),
      },
    });
  }

  /**
   * Request logger middleware
   * Configures morgan logging based on environment
   */
  requestLogger(req: Request, res: Response, next: NextFunction): void {
    try {
      // Skip logging for health check endpoint
      if (req.path === '/health') {
        return next();
      }

      // Skip logging for static files
      if (req.path.startsWith('/static')) {
        return next();
      }

      // Skip logging for favicon.ico
      if (req.path === '/favicon.ico') {
        return next();
      }

      // Custom format for non-development environments
      const format =
        serverConfig.node.env === ServerEnvOptions.DEVELOPMENT
          ? 'dev'
          : ':remote-addr :method :url :status :response-time ms ":referrer" ":user-agent"';

      // Use appropriate logger based on environment
      if (serverConfig.node.env === ServerEnvOptions.DEVELOPMENT) {
        morgan(format)(req, res, next);
      } else {
        // Use custom stream for production logging
        morgan(format, {
          stream: logger.getHttpLogStream(),
          skip: (request) => request.method === 'OPTIONS', // Skip OPTIONS requests in prod
        })(req, res, next);
      }
    } catch (error) {
      next(error);
    }
  }
}

export default new SystemMiddlewares();
