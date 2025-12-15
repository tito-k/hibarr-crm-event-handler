import { logger } from '../utils';
import { serverConfig } from '../config';
import MetaCAPIProvider from './meta-capi.provider';
import BrevoProvider from './brevo.provider';
import { CrmWebhookJobData } from '../queues/crm/crm.types';

/**
 * Downstream Provider
 *
 * Orchestrates calls to downstream services (Meta CAPI, Brevo) based on CRM events.
 * This provider handles the business logic for when to trigger specific downstream actions.
 *
 * @class DownstreamProvider
 */
class DownstreamProvider {
  private metaCAPIProvider: MetaCAPIProvider;
  private brevoProvider: BrevoProvider;

  constructor() {
    this.metaCAPIProvider = new MetaCAPIProvider();
    this.brevoProvider = new BrevoProvider();
  }

  /**
   * Process a qualified deal
   * - Send conversion event to Meta CAPI for all status changes
   *
   * @param {CrmWebhookJobData['payload']['data']} dealData - Deal data from CRM
   * @returns {Promise<void>}
   */
  async processQualifiedDeal(
    dealData: CrmWebhookJobData['payload']['data'],
  ): Promise<void> {
    logger.info('Processing qualified deal', {
      dealId: dealData.dealId,
      status: dealData.dealDetails.status,
    });

    try {
      // Send conversion event to Meta CAPI for "Qualified" status
      await this.sendMetaConversionEvent(dealData, 'Lead');

      logger.info('Qualified deal processed successfully', {
        dealId: dealData.dealId,
      });
    } catch (error) {
      logger.error('Error processing qualified deal', {
        dealId: dealData.dealId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Process a committed deal
   * - Send conversion event to Meta CAPI
   * - Send property details email via Brevo
   *
   * @param {CrmWebhookJobData['payload']['data']} dealData - Deal data from CRM
   * @returns {Promise<void>}
   */
  async processCommittedDeal(
    dealData: CrmWebhookJobData['payload']['data'],
  ): Promise<void> {
    logger.info('Processing committed deal', {
      dealId: dealData.dealId,
      status: dealData.dealDetails.status,
    });

    try {
      // Send conversion event to Meta CAPI for "Committed" status
      await this.sendMetaConversionEvent(dealData, 'Purchase');

      // Send property details email via Brevo
      await this.sendPropertyEmail(dealData);

      logger.info('Committed deal processed successfully', {
        dealId: dealData.dealId,
      });
    } catch (error) {
      logger.error('Error processing committed deal', {
        dealId: dealData.dealId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Send conversion event to Meta CAPI
   * @private
   */
  private async sendMetaConversionEvent(
    dealData: CrmWebhookJobData['payload']['data'],
    eventName: 'Lead' | 'Purchase' | 'ViewContent',
  ): Promise<void> {
    try {
      await this.metaCAPIProvider.sendConversionEvent({
        eventName,
        email: dealData.customer.email,
        firstName: dealData.customer.firstName,
        lastName: dealData.customer.lastName,
        phone: dealData.customer.phoneNumber,
        dealId: dealData.dealId,
        value: dealData.dealDetails.dealValue,
        currency: dealData.dealDetails.currency,
        eventSourceUrl: serverConfig.server.baseUrl,
      });

      logger.info('Meta conversion event sent', {
        dealId: dealData.dealId,
        eventName,
      });
    } catch (error) {
      logger.error('Failed to send Meta conversion event', {
        dealId: dealData.dealId,
        eventName,
        error: (error as Error).message,
      });
      // Don't throw - we want to continue processing even if Meta CAPI fails
    }
  }

  /**
   * Send property details email via Brevo
   * @private
   */
  private async sendPropertyEmail(
    dealData: CrmWebhookJobData['payload']['data'],
  ): Promise<void> {
    try {
      const customerName = `${dealData.customer.firstName} ${dealData.customer.lastName}`;

      await this.brevoProvider.sendPropertyDetailsEmail({
        customerEmail: dealData.customer.email,
        customerName,
        dealName: dealData.dealDetails.dealName,
        propertyInfo: dealData.propertyInformation,
      });

      logger.info('Property details email sent', {
        dealId: dealData.dealId,
        customerEmail: dealData.customer.email,
      });
    } catch (error) {
      logger.error('Failed to send property details email', {
        dealId: dealData.dealId,
        error: (error as Error).message,
      });
      // Don't throw - we want to continue processing even if email fails
    }
  }
}

export default DownstreamProvider;
