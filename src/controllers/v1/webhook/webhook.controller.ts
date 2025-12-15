import { Response, NextFunction, Request } from 'express';
import { Provider, WebhookStatus } from '../../../infrastructure';
import { WebhookReceiptService } from '../../../services';
import { logger } from '../../../utils';

export default class WebhookController {
  protected service: WebhookReceiptService;

  constructor() {
    this.service = new WebhookReceiptService();
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        params: { provider },
      } = req;

      // get provider instance
      const providerInstance = this.service.getProviderInstance(
        provider as Provider,
      );

      // validate webhook request (supports async validation)
      const isValid = await providerInstance.validateWebhookRequest(req);

      if (!isValid) {
        res.sendStatus(202);
        return;
      }

      // get event & reference from webhook request
      const [event, reference] = [
        providerInstance.getEventFromWebhookRequest(req),
        providerInstance.getReferenceFromWebhookRequest(req),
      ];

      // create webhook record in db
      const [webhook, isNew] = await this.service.createWebhook(
        provider as Provider,
        event,
        reference,
        req,
      );

      if (isNew || webhook.status !== WebhookStatus.PROCESSED) {
        try {
          // handle webhook based on provider instance
          await providerInstance.handleWebhookRequest(webhook);

          // update webhook status
          await this.service.updateById(webhook._id, {
            status: WebhookStatus.PROCESSED,
          });
        } catch (error) {
          logger.error('Error processing webhook', {
            provider,
            error,
            webhook,
          });

          // update webhook status to failed
          await this.service.updateById(webhook._id, {
            status: WebhookStatus.FAILED,
          });
        }
      }

      res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  };
}
