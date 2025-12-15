/**
 * Type definitions for CRM Webhook queue jobs
 */

/**
 * Job data structure for CRM webhook processing
 */
export interface CrmWebhookJobData {
  /** CRM dealId reference */
  reference: string;
  /** Event type from CRM webhook */
  event: string;
  /** Raw webhook payload from CRM */
  payload: CrmWebhookPayload;
}

/**
 * CRM webhook payload structure
 */

interface CrmWebhookPayload {
  status: string;
  message: string;
  data: CrmWebhookData;
}

interface CrmWebhookData {
  dealId: string;
  customer: CrmWebhookCustomer;
  dealDetails: CrmWebhookDealDetails;
  propertyInformation: CrmWebhookPropertyInformation;
}

interface CrmWebhookPropertyInformation {
  propertyId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  squareFootage: number;
}

interface CrmWebhookDealDetails {
  dealName: string;
  dealValue: number;
  currency: string;
  status: string;
  closingDate: string;
}

interface CrmWebhookCustomer {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

/**
 * Queue configuration for CRM Webhook jobs
 */
export const CRM_WEBHOOK_QUEUE_CONFIG = {
  name: 'crm-webhook-queue',
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
} as const;
