import { QueueService } from '..';
import { CrmWebhookJobData, CRM_WEBHOOK_QUEUE_CONFIG } from './crm.types';

/**
 * CRM webhook queue name
 * @constant
 */
export const CRM_WEBHOOK_QUEUE = CRM_WEBHOOK_QUEUE_CONFIG.name;

/**
 * Enqueues a CRM webhook job for processing
 *
 * Uses the event, reference & deal status from CRM as the BullMQ jobId for automatic deduplication.
 * If the same event, reference & deal status is enqueued multiple times, only one job will be processed.
 *
 * @async
 * @param {CrmWebhookJobData} data - Job data containing event, reference, and payload
 * @returns {Promise<string | undefined>} The BullMQ job ID
 *
 * @example
 * await enqueueCRMWebhookJob({
 *   reference: 'crm-deal-123',
 *   event: 'deal_created',
 *   payload: webhookBody
 * });
 */
export async function enqueueCRMWebhookJob(
  data: CrmWebhookJobData,
): Promise<string | undefined> {
  const queueService = QueueService.getInstance();

  return queueService.enqueue(CRM_WEBHOOK_QUEUE, data, {
    jobId: `${data.event}_${data.reference}_${data.payload.data.dealDetails.status.toLocaleLowerCase()}`, // Enables deduplication
    ...CRM_WEBHOOK_QUEUE_CONFIG.defaultJobOptions,
  });
}
