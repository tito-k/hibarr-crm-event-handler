import { Job } from 'bullmq';
import { logger } from '../../utils';
import { CrmWebhookJobData } from './crm.types';
import { DownstreamProvider } from '../../providers';

/**
 * Processes CRM webhook data
 *
 * This processor handles the updates from CRM webhook, triggers any necessary follow-up actions.
 *
 * @async
 * @param {Job<CrmWebhookJobData>} job - BullMQ job containing CRM webhook data
 * @returns {Promise<{ success: boolean; jobId: string }>} Processing result
 *
 * @example
 * // Used by worker:
 * const worker = queueService.createWorker(
 *   CRM_WEBHOOK_QUEUE,
 *   processCRMWebhook
 * );
 */
export async function processCRMWebhook(
  job: Job<CrmWebhookJobData>,
): Promise<{ success: boolean; jobId: string }> {
  const { reference, event, payload } = job.data;

  logger.info('Processing CRM webhook job', {
    bullmqJobId: job.id,
    reference,
    event,
    status: payload.data.dealDetails.status,
  });

  try {
    const downstreamProvider = new DownstreamProvider();

    // Process based on event type and status
    switch (event) {
      case 'deal_created':
        await handleDealCreatedEvent(downstreamProvider, payload);
        break;
      case 'deal_updated':
        await handleDealUpdatedEvent(downstreamProvider, payload);
        break;
      default:
        logger.warn('Unhandled CRM webhook event', { event });
        break;
    }

    logger.info('CRM webhook job completed successfully', {
      reference,
      event,
    });

    return { success: true, jobId: job.id };
  } catch (error) {
    logger.error('Failed to process CRM webhook job', {
      reference,
      event,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error; // Let BullMQ handle retries
  }
}

/**
 * Handles 'deal_created' CRM webhook event
 *
 * @private
 * @param downstreamProvider - The downstream service provider
 * @param payload - The webhook payload
 */
async function handleDealCreatedEvent(
  downstreamProvider: DownstreamProvider,
  payload: CrmWebhookJobData['payload'],
): Promise<void> {
  try {
    switch (payload.data.dealDetails.status) {
      case 'Qualified':
        // Process the qualified deal - send to Meta CAPI
        await downstreamProvider.processQualifiedDeal(payload.data);

        logger.info('Deal qualified successfully', {
          reference: payload.data.dealId,
          status: payload.data.dealDetails.status,
        });
        break;
      case 'Committed':
        // Process the committed deal - send to Meta CAPI and Brevo
        await downstreamProvider.processCommittedDeal(payload.data);

        logger.info('Deal committed successfully', {
          reference: payload.data.dealId,
          status: payload.data.dealDetails.status,
        });
        break;
      default:
        logger.warn('Unknown deal status from CRM', {
          status: payload.data.dealDetails.status,
          reference: payload.data.dealId,
        });
        break;
    }
  } catch (error) {
    logger.error('Error handling deal created event', {
      reference: payload.data.dealId,
      status: payload.data.dealDetails.status,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Handles 'deal_updated' CRM webhook event
 *
 * @private
 * @param downstreamProvider - The downstream service provider
 * @param payload - The webhook payload
 */
async function handleDealUpdatedEvent(
  downstreamProvider: DownstreamProvider,
  payload: CrmWebhookJobData['payload'],
): Promise<void> {
  try {
    switch (payload.data.dealDetails.status) {
      case 'Qualified':
        // Process the qualified deal - send to Meta CAPI
        await downstreamProvider.processQualifiedDeal(payload.data);

        logger.info('Deal status updated to Qualified', {
          reference: payload.data.dealId,
          status: payload.data.dealDetails.status,
        });
        break;
      case 'Committed':
        // Process the committed deal - send to Meta CAPI and Brevo
        await downstreamProvider.processCommittedDeal(payload.data);

        logger.info('Deal status updated to Committed', {
          reference: payload.data.dealId,
          status: payload.data.dealDetails.status,
        });
        break;
      default:
        logger.info('Deal status updated', {
          status: payload.data.dealDetails.status,
          reference: payload.data.dealId,
        });
        break;
    }
  } catch (error) {
    logger.error('Error handling deal updated event', {
      reference: payload.data.dealId,
      status: payload.data.dealDetails.status,
      error: (error as Error).message,
    });
    throw error;
  }
}

