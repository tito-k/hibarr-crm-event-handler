import { Router } from 'express';
import { WebhookReceiptController } from '../../controllers/v1';

class WebhookReceiptRoutes extends WebhookReceiptController {
  public router: Router;

  constructor() {
    super();
    this.router = Router();
    this.routes();
  }

  private routes(): void {
    // Handle incoming webhook receipts
    this.router.post('/:provider', this.create);
  }
}

export default new WebhookReceiptRoutes().router;
