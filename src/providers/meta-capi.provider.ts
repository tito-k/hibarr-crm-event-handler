import { Request } from 'express';
import crypto from 'crypto';

import BaseProvider from './base.provider';
import { serverConfig } from '../config';
import { logger } from '../utils';
import { IProviderService, IWebhookReceiptAttribute } from '../infrastructure';

/**
 * Meta Conversions API (CAPI) Provider
 *
 * Handles integration with Meta's Conversions API for sending conversion events.
 * This provider sends customer conversion events to Meta for tracking and attribution.
 *
 * @class MetaCAPIProvider
 * @extends {BaseProvider}
 */
class MetaCAPIProvider extends BaseProvider implements IProviderService {
  private accessToken: string;
  private pixelId: string;
  private apiVersion: string;

  constructor() {
    // Meta CAPI base URL
    super('https://graph.facebook.com');

    this.accessToken = serverConfig.meta.accessToken;
    this.pixelId = serverConfig.meta.pixelId;
    this.apiVersion = serverConfig.meta.apiVersion;
  }

  /**
   * Returns headers for Meta CAPI requests
   * @protected
   * @returns {Promise<Record<string, string>>} Headers object
   */
  protected async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Meta CAPI doesn't receive webhooks - this is not used
   */
  validateWebhookRequest(req: Request): boolean {
    return true;
  }

  /**
   * Meta CAPI doesn't receive webhooks - this is not used
   */
  getEventFromWebhookRequest(req: Request): string {
    return '';
  }

  /**
   * Meta CAPI doesn't receive webhooks - this is not used
   */
  getReferenceFromWebhookRequest(req: Request): string {
    return '';
  }

  /**
   * Meta CAPI doesn't handle incoming webhooks - this is not used
   */
  async handleWebhookRequest(
    webhookReceipt: IWebhookReceiptAttribute,
  ): Promise<void> {
    // Not applicable for Meta CAPI
  }

  /**
   * Sends a conversion event to Meta CAPI
   *
   * @param {Object} params - Event parameters
   * @param {string} params.eventName - The event name (e.g., 'Lead', 'Purchase', 'ViewContent')
   * @param {string} params.email - Customer email (will be hashed)
   * @param {string} params.firstName - Customer first name (will be hashed)
   * @param {string} params.lastName - Customer last name (will be hashed)
   * @param {string} params.phone - Customer phone (will be hashed)
   * @param {string} params.dealId - Deal reference ID
   * @param {number} params.value - Deal value
   * @param {string} params.currency - Currency code
   * @param {string} params.eventSourceUrl - Source URL where the event occurred
   * @returns {Promise<any>} Response from Meta CAPI
   */
  async sendConversionEvent(params: {
    eventName: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    dealId: string;
    value: number;
    currency: string;
    eventSourceUrl: string;
  }): Promise<any> {
    try {
      const eventTime = Math.floor(Date.now() / 1000);

      // Hash user data for privacy (SHA256)
      const hashedEmail = this.hashData(params.email);
      const hashedFirstName = this.hashData(params.firstName);
      const hashedLastName = this.hashData(params.lastName);
      const hashedPhone = this.hashData(params.phone);

      const eventData = {
        data: [
          {
            event_name: params.eventName,
            event_time: eventTime,
            event_source_url: params.eventSourceUrl,
            action_source: 'website',
            user_data: {
              em: [hashedEmail],
              fn: [hashedFirstName],
              ln: [hashedLastName],
              ph: [hashedPhone],
            },
            custom_data: {
              value: params.value,
              currency: params.currency,
              deal_id: params.dealId,
            },
          },
        ],
        access_token: this.accessToken,
      };

      logger.info('Sending conversion event to Meta CAPI', {
        eventName: params.eventName,
        dealId: params.dealId,
        pixelId: this.pixelId,
      });

      const endpoint = `/${this.apiVersion}/${this.pixelId}/events`;
      const response = await this.makeRequest('POST', endpoint, eventData);

      logger.info('Meta CAPI conversion event sent successfully', {
        eventName: params.eventName,
        dealId: params.dealId,
        response,
      });

      return response;
    } catch (error) {
      logger.error('Failed to send conversion event to Meta CAPI', {
        eventName: params.eventName,
        dealId: params.dealId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  /**
   * Hash data using SHA256 for Meta CAPI user data
   * @private
   * @param {string} data - Data to hash
   * @returns {string} Hashed data in hexadecimal format
   */
  private hashData(data: string): string {
    if (!data) return '';
    return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
  }
}

export default MetaCAPIProvider;
