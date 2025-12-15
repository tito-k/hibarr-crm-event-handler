import { Request } from 'express';

import BaseProvider from './base.provider';
import { serverConfig } from '../config';
import { logger } from '../utils';
import { IProviderService, IWebhookReceiptAttribute } from '../infrastructure';

/**
 * Brevo (formerly Sendinblue) Email Provider
 *
 * Handles integration with Brevo API for sending transactional emails.
 *
 * @class BrevoProvider
 * @extends {BaseProvider}
 */
class BrevoProvider extends BaseProvider implements IProviderService {
  private apiKey: string;
  private senderEmail: string;
  private senderName: string;

  constructor() {
    // Brevo API base URL
    super('https://api.brevo.com');

    this.apiKey = serverConfig.brevo.apiKey;
    this.senderEmail = serverConfig.brevo.senderEmail;
    this.senderName = serverConfig.brevo.senderName;
  }

  /**
   * Returns headers for Brevo API requests
   * @protected
   * @returns {Promise<Record<string, string>>} Headers object
   */
  protected async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
    };
  }

  /**
   * Brevo doesn't receive webhooks in this context - not used
   */
  validateWebhookRequest(req: Request): boolean {
    return true;
  }

  /**
   * Brevo doesn't receive webhooks in this context - not used
   */
  getEventFromWebhookRequest(req: Request): string {
    return '';
  }

  /**
   * Brevo doesn't receive webhooks in this context - not used
   */
  getReferenceFromWebhookRequest(req: Request): string {
    return '';
  }

  /**
   * Brevo doesn't handle incoming webhooks - not used
   */
  async handleWebhookRequest(
    webhookReceipt: IWebhookReceiptAttribute,
  ): Promise<void> {
    // Not applicable for Brevo
  }

  /**
   * Sends a transactional email via Brevo
   *
   * @param {Object} params - Email parameters
   * @param {string} params.to - Recipient email address
   * @param {string} params.toName - Recipient name
   * @param {string} params.subject - Email subject
   * @param {string} params.htmlContent - HTML content of the email
   * @param {string} params.textContent - Plain text content (optional)
   * @param {Record<string, any>} params.params - Template parameters (optional)
   * @returns {Promise<any>} Response from Brevo API
   */
  async sendEmail(params: {
    to: string;
    toName: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    params?: Record<string, any>;
  }): Promise<any> {
    try {
      const emailData = {
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [
          {
            email: params.to,
            name: params.toName,
          },
        ],
        subject: params.subject,
        htmlContent: params.htmlContent,
        textContent: params.textContent,
        params: params.params,
      };

      logger.info('Sending email via Brevo', {
        to: params.to,
        subject: params.subject,
      });

      const response = await this.makeRequest(
        'POST',
        '/v3/smtp/email',
        emailData,
      );

      logger.info('Email sent successfully via Brevo', {
        to: params.to,
        subject: params.subject,
        messageId: (response as any)?.messageId,
      });

      return response;
    } catch (error) {
      logger.error('Failed to send email via Brevo', {
        to: params.to,
        subject: params.subject,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  /**
   * Sends a property details email to customer
   *
   * @param {Object} params - Property email parameters
   * @param {string} params.customerEmail - Customer email address
   * @param {string} params.customerName - Customer full name
   * @param {string} params.dealName - Name of the deal
   * @param {Object} params.propertyInfo - Property information object
   * @returns {Promise<any>} Response from Brevo API
   */
  async sendPropertyDetailsEmail(params: {
    customerEmail: string;
    customerName: string;
    dealName: string;
    propertyInfo: {
      propertyId: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      propertyType: string;
      squareFootage: number;
    };
  }): Promise<any> {
    const { customerEmail, customerName, dealName, propertyInfo } = params;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .property-details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Property Details - ${dealName}</h1>
          </div>
          <div class="content">
            <p>Dear ${customerName},</p>
            <p>Congratulations on reaching the Committed stage! Here are the details of your selected property:</p>
            
            <div class="property-details">
              <div class="detail-row">
                <span class="label">Property ID:</span> ${propertyInfo.propertyId}
              </div>
              <div class="detail-row">
                <span class="label">Type:</span> ${propertyInfo.propertyType}
              </div>
              <div class="detail-row">
                <span class="label">Address:</span> ${propertyInfo.address}
              </div>
              <div class="detail-row">
                <span class="label">City:</span> ${propertyInfo.city}
              </div>
              <div class="detail-row">
                <span class="label">State:</span> ${propertyInfo.state}
              </div>
              <div class="detail-row">
                <span class="label">Zip Code:</span> ${propertyInfo.zipCode}
              </div>
              <div class="detail-row">
                <span class="label">Square Footage:</span> ${propertyInfo.squareFootage.toLocaleString()} sq ft
              </div>
            </div>
            
            <p>We're excited to move forward with you on this journey!</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>${this.senderName}</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Property Details - ${dealName}
      
      Dear ${customerName},
      
      Congratulations on reaching the Committed stage! Here are the details of your selected property:
      
      Property ID: ${propertyInfo.propertyId}
      Type: ${propertyInfo.propertyType}
      Address: ${propertyInfo.address}
      City: ${propertyInfo.city}
      State: ${propertyInfo.state}
      Zip Code: ${propertyInfo.zipCode}
      Square Footage: ${propertyInfo.squareFootage.toLocaleString()} sq ft
      
      We're excited to move forward with you on this journey!
      If you have any questions, please don't hesitate to contact us.
      
      Best regards,
      ${this.senderName}
    `;

    return this.sendEmail({
      to: customerEmail,
      toName: customerName,
      subject: `Your Property Details - ${dealName}`,
      htmlContent,
      textContent,
      params: { dealName, propertyInfo },
    });
  }
}

export default BrevoProvider;
