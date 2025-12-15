import { Request } from 'express';

import BaseService from './base.service';
import { BadRequestError } from '../errors';
import { WebhookReceiptModel } from '../db/models';
import {
  IWebhookReceiptAttribute,
  IWebhookReceiptService,
  IProviderService,
  Provider,
  WebhookStatus,
} from '../infrastructure';
import { CRMProvider } from '../providers';

class WebhookReceiptService
  extends BaseService<IWebhookReceiptAttribute>
  implements IWebhookReceiptService
{
  constructor() {
    super(WebhookReceiptModel, 'Webhook receipt');
  }

  private providerInstances: Record<string, IProviderService> = {
    [Provider.CRM]: new CRMProvider(),
  };

  public getProviderInstance(provider: Provider): IProviderService {
    const providerInstance = this.providerInstances[provider];

    if (!providerInstance) {
      throw new BadRequestError('Invalid provider.');
    }

    return providerInstance;
  }

  public async createWebhook(
    provider: Provider,
    event: string,
    reference: string,
    req: Request,
  ): Promise<[IWebhookReceiptAttribute, boolean]> {
    const attributes: Partial<IWebhookReceiptAttribute> = {
      provider,
      event,
      reference,
      payload: { headers: req.headers, body: req.body, params: req.params },
      status: WebhookStatus.PENDING,
    };

    // check if record exists with the same reference under provider
    const existingRecord = await this.findOne({
      provider,
      reference,
    });

    if (existingRecord) {
      return [existingRecord, false];
    }

    const newRecord = await this.create(attributes);
    return [newRecord, true];
  }
}

export default WebhookReceiptService;
