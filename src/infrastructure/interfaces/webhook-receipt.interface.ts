import { Request } from 'express';
import { IProviderService, Provider } from './provider';
import { BaseEntity } from './core';

export interface IWebhookReceiptAttribute extends BaseEntity {
  provider: Provider;
  event: string;
  reference: string;
  payload: WebhookPayload;
  status: WebhookStatus;
}

export interface WebhookPayload {
  headers: Request['headers'];
  body: Request['body'];
  params: Request['params'];
}

export enum WebhookStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

export interface IWebhookReceiptService {
  getProviderInstance(provider: Provider): IProviderService;
}
