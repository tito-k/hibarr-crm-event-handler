import { Router } from 'express';
import { LoggerController } from '../../controllers/logger';

class LoggerRoutes extends LoggerController {
  public router: Router;

  constructor() {
    super();
    this.router = Router();
    this.routes();
  }

  private routes(): void {
    // List log files for a level
    this.router.route('/:level').get(this.getFiles);

    // Get log content for a level (optional ?date=YYYY-MM-DD)
    this.router.route('/:level/content').get(this.getContent);
  }
}

export default new LoggerRoutes().router;
