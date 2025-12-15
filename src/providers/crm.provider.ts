import { Request } from 'express';

import BaseProvider from './base.provider';
import { serverConfig } from '../config';
import { logger } from '../utils';
import { IProviderService, IWebhookReceiptAttribute } from '../infrastructure';
import { BadRequestError } from '../errors';
import { enqueueCRMWebhookJob } from '../queues';

/**
 * CRM Provider
 *
 * Handles integration with CRM middleware for processing CRM events.
 *
 * @class CRMProvider
 * @extends {BaseProvider}
 */
class CRMProvider extends BaseProvider implements IProviderService {
  constructor() {
    // CRM middleware base URL from server config
    super(serverConfig.crm.serverUrl);
  }

  /**
   * Returns headers for CRM API requests
   * @protected
   * @returns {Promise<Record<string, string>>} Headers object
   */
  protected async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
    };
  }

  validateWebhookRequest(req: Request): boolean {
    const apiKey = req.headers['x-api-key'];

    if (apiKey !== serverConfig.auth.apiKey) {
      return false;
    }

    return true;
  }

  getEventFromWebhookRequest(req: Request): string {
    const event = req.headers['x-event'] as string;

    if (!event) {
      logger.error('CRM webhook missing event field', {
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query,
      });
      throw new BadRequestError('Missing event field in webhook payload');
    }

    return event;
  }

  getReferenceFromWebhookRequest(req: Request): string {
    const reference = req.body?.data?.dealId;

    if (!reference) {
      logger.error('CRM webhook missing reference field', {
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query,
      });
      throw new BadRequestError('Missing reference field in webhook payload.');
    }

    return reference;
  }

  async handleWebhookRequest(
    webhookReceipt: IWebhookReceiptAttribute,
  ): Promise<void> {
    logger.info('Received CRM webhook', {
      event: webhookReceipt.event,
      reference: webhookReceipt.reference,
    });

    const {
      payload: { body },
      event,
      reference,
    } = webhookReceipt;

    try {
      // Enqueue webhook for asynchronous processing
      const jobId = await enqueueCRMWebhookJob({
        reference,
        event,
        payload: body,
      });

      logger.info('CRM webhook job enqueued', {
        event,
        reference,
        jobId,
      });
    } catch (error) {
      logger.error('Failed to enqueue CRM webhook job', {
        event,
        reference,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

export default CRMProvider;
