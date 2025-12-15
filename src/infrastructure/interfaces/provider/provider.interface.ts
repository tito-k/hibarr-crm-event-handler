import { Request } from 'express';
import { IWebhookReceiptAttribute } from '../webhook-receipt.interface';

export enum Provider {
  EXACT_ONLINE = 'exact-online',
  WOOCOMMERCE = 'woocommerce',
  CRM = 'crm',
  META_CAPI = 'meta-capi',
  BREVO = 'brevo',
}

export interface IProviderService {
  validateWebhookRequest(req: Request): boolean | Promise<boolean>;
  getEventFromWebhookRequest(req: Request): string;
  getReferenceFromWebhookRequest(req: Request): string;
  handleWebhookRequest(webhook: IWebhookReceiptAttribute): Promise<void>;
}
