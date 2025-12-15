import { model, Schema } from 'mongoose';
import {
  IWebhookReceiptAttribute,
  Provider,
  WebhookStatus,
} from '../../infrastructure';

const webhookReceiptSchema = new Schema<IWebhookReceiptAttribute>(
  {
    provider: {
      type: String,
      required: true,
      enum: Object.values(Provider),
    },
    event: { type: String, required: true },
    reference: { type: String, required: true },
    payload: {
      headers: { type: Schema.Types.Mixed },
      body: { type: Schema.Types.Mixed },
      params: { type: Schema.Types.Mixed },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(WebhookStatus),
      default: WebhookStatus.PENDING,
    },
  },
  { timestamps: true },
);

const WebhookReceiptModel = model<IWebhookReceiptAttribute>(
  'WebhookReceipt',
  webhookReceiptSchema,
);
export default WebhookReceiptModel;
