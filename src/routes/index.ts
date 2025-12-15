import { Router, Request, Response } from 'express';

import { serverConfig } from '../config';

// Import logger routes
import loggerRoutes from './logger';

// Import API version routes
import v1Routes from './v1';

class Routes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.routes();
  }

  private routes(): void {
    // Welcome/root endpoint
    this.router.get('/', (req: Request, res: Response) => {
      return res.status(200).json({
        message: 'Welcome to Hibarr CRM Event Handler API.',
        data: {
          service: serverConfig.node.service,
          environment: serverConfig.node.env,
        },
      });
    });

    // Logger routes
    this.router.use('/logs', loggerRoutes);

    // API version routing
    this.router.use('/v1', v1Routes);
  }
}

export default new Routes().router;
