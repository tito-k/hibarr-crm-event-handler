import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { serverConfig, ServerEnvOptions } from '../config';
import { logger } from '../utils';

class SecurityMiddleware {
  /**
   * Sets up rate limiting middleware with different configurations based on environment
   * @returns Rate limiting middleware
   */
  public setupRateLimit() {
    const options = {
      windowMs: serverConfig.security.rateLimitWindowMs,
      max: serverConfig.security.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        status: 429,
        message: 'Too many requests, please try again later.',
      },
      skip: (req: Request) => {
        // Skip health check endpoint
        return req.path === '/health';
      },
      keyGenerator: (req: Request) => {
        // Use X-Forwarded-For header if behind a proxy, otherwise use IP
        return (
          (req.headers['x-forwarded-for'] as string) ||
          req.socket.remoteAddress ||
          ''
        );
      },
      handler: (req: Request, res: Response) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.headers['user-agent'],
        });
        res.status(429).json({
          message: 'Too many requests, please try again later.',
        });
      },
    };

    // Make the limit more strict in production
    if (serverConfig.node.env === ServerEnvOptions.PRODUCTION) {
      return rateLimit(options);
    }

    // More permissive in development
    return rateLimit({
      ...options,
      max: 3000, // Higher limit in development
    });
  }

  /**
   * Sets up Content Security Policy headers
   * @returns CSP middleware
   */
  public setupCSP() {
    const isDev = serverConfig.node.env === ServerEnvOptions.DEVELOPMENT;

    // Use Helmet's CSP to avoid express-csp-header -> psl -> punycode deprecation chain
    return helmet.contentSecurityPolicy({
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...(isDev ? ["'unsafe-eval'"] : [])],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", ...(isDev ? ['ws:'] : [])],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
      },
    });
  }

  /**
   * Middleware to add security-related HTTP headers
   * @param req Express request
   * @param res Express response
   * @param next Next function
   */
  public addSecurityHeaders(req: Request, res: Response, next: NextFunction) {
    // Generate a random nonce for CSP
    const nonce = randomBytes(16).toString('base64');
    res.locals.nonce = nonce;

    // Add security headers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // Strict Transport Security
    if (serverConfig.node.env === ServerEnvOptions.PRODUCTION) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload',
      );
    }

    next();
  }

  /**
   * Middleware to enforce secure communications
   * @param req Express request
   * @param res Express response
   * @param next Next function
   */
  public enforceHTTPS(req: Request, res: Response, next: NextFunction) {
    // Only enforce in production
    if (serverConfig.node.env === ServerEnvOptions.PRODUCTION) {
      // Check if request is secure
      const isSecure =
        req.secure || req.headers['x-forwarded-proto'] === 'https';

      if (!isSecure) {
        // Redirect to HTTPS
        return res.redirect(301, `https://${req.hostname}${req.url}`);
      }
    }

    next();
  }
}

export default new SecurityMiddleware();
