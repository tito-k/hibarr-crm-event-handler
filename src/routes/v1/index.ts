import { Request, Response, Router } from 'express';
import { serverConfig } from '../../config';

import webhookRoutes from './webhook.route';

/**
 * V1 API Routes
 * This file aggregates all version 1 API routes
 */
class V1Routes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.routes();
  }

  /**
   * Configure all version 1 API routes
   */
  private routes(): void {
    // Main routes
    this.router.get('/', (req: Request, res: Response) => {
      return res.status(200).json({
        message: 'Welcome to Hibarr CRM Event Handler API v1',
        data: {
          status: 'active',
          environment: serverConfig.node.env,
          version: '1.0.0',
        },
      });
    });

    // Mount other routes
    this.router.use('/webhooks', webhookRoutes);
  }
}

export default new V1Routes().router;
