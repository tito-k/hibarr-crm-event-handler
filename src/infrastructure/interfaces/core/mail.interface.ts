export interface IMailOptions {
  to: string | string[];
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  templateName: string;
  replacements?: Record<string, any>;
  attachments?: IMailAttachment[];
}

export interface IMailAttachment {
  filename: string;
  data: Buffer;
}
