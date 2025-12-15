# hibarr-crm-event-handler
Backend Engineer Assessment - The CRM Event Handler

## Overview

The CRM Event Handler is a robust integration orchestration service that acts as a middleware between a CRM system and downstream services. It processes CRM webhooks, validates incoming requests, stores events in a database, and triggers actions in third-party services based on deal status changes.

## Features

- **Webhook Authentication**: Secure API key validation for incoming CRM webhooks
- **Event Processing**: Asynchronous processing using BullMQ for reliable event handling
- **Meta Conversions API Integration**: Sends conversion events to Meta CAPI when deal status changes
- **Brevo Email Integration**: Sends property details emails to customers at the "Committed" stage
- **Error Handling**: Robust retry mechanisms and dead letter queue handling
- **Database Storage**: MongoDB integration for webhook receipt tracking
- **Redis Queue**: Reliable message queue for background job processing

## Architecture

### Components

1. **Webhook Controller**: Receives and validates incoming webhooks from CRM
2. **CRM Provider**: Handles CRM-specific webhook validation and event extraction
3. **Queue Service**: Manages asynchronous job processing using BullMQ
4. **CRM Processor**: Processes queued webhook jobs and orchestrates downstream actions
5. **Downstream Provider**: Orchestrates calls to Meta CAPI and Brevo based on deal status
6. **Meta CAPI Provider**: Sends conversion events to Meta's Conversions API
7. **Brevo Provider**: Sends transactional emails via Brevo API

### Workflow

```
CRM Webhook → Authentication → Validation → Database Storage → Queue → Process → Downstream Services
                                                                                    ├─ Meta CAPI
                                                                                    └─ Brevo Email
```

## Deal Status Processing

### Qualified Status
When a deal reaches "Qualified" status:
- ✅ Conversion event sent to Meta CAPI (event: "Lead")

### Committed Status
When a deal reaches "Committed" status:
- ✅ Conversion event sent to Meta CAPI (event: "Purchase")
- ✅ Property details email sent to customer via Brevo

## API Endpoints

### Webhook Endpoint
```
POST /api/v1/webhook/:provider
```

Headers:
- `x-api-key`: Authentication key
- `x-event`: Event type (e.g., "deal_created", "deal_updated")

Body: CRM webhook payload (see Demo Data section)

## Demo Data

Sample CRM webhook payload:
```json
{
  "status": "success",
  "message": "Customer deal information retrieved successfully",
  "data": {
    "dealId": "D-927483-XYZ",
    "customer": {
      "contactId": "CUST-45678",
      "firstName": "d1c8a6f05f42e8b2c45e06d910a3f8c5",
      "lastName": "7e3b1d92c4a0f6e5b3c4a1d8f7e2c0b9",
      "email": "a5d2c1e8f9b0c3d4a7b6c5d8e1f0a9b8",
      "phoneNumber": "f8c7b6a5d4e3c2b1a0d9e8f7c6b5a4d3"
    },
    "dealDetails": {
      "dealName": "The Grand Cypress Acquisition",
      "dealValue": 12500000.00,
      "currency": "USD",
      "status": "Qualified",
      "closingDate": "2026-03-15"
    },
    "propertyInformation": {
      "propertyId": "PROP-101122",
      "address": "4509 Ocean View Dr, Suite 200",
      "city": "Coastal City",
      "state": "CA",
      "zipCode": "90210",
      "propertyType": "Commercial Office",
      "squareFootage": 15000
    }
  }
}
```

## Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- MongoDB
- Redis

### Installation Steps

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

4. Update environment variables in `.env`:
   - `API_KEY`: Set a secure API key for webhook authentication
   - `DB_URI`: MongoDB connection string
   - `REDIS_URI`: Redis connection string
   - `META_ACCESS_TOKEN`: Meta Conversions API access token
   - `META_PIXEL_ID`: Meta pixel ID
   - `BREVO_API_KEY`: Brevo API key
   - `BREVO_SENDER_EMAIL`: Sender email for Brevo

5. Start the application:
   ```bash
   npm run dev
   ```

## Testing

Send a test webhook to the CRM endpoint:

```bash
curl -X POST http://localhost:3000/api/v1/webhook/crm \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -H "x-event: deal_created" \
  -d '{
    "status": "success",
    "message": "Customer deal information retrieved successfully",
    "data": {
      "dealId": "D-927483-XYZ",
      "customer": {
        "contactId": "CUST-45678",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "phoneNumber": "+1234567890"
      },
      "dealDetails": {
        "dealName": "The Grand Cypress Acquisition",
        "dealValue": 12500000.00,
        "currency": "USD",
        "status": "Qualified",
        "closingDate": "2026-03-15"
      },
      "propertyInformation": {
        "propertyId": "PROP-101122",
        "address": "4509 Ocean View Dr, Suite 200",
        "city": "Coastal City",
        "state": "CA",
        "zipCode": "90210",
        "propertyType": "Commercial Office",
        "squareFootage": 15000
      }
    }
  }'
```

## Project Structure

```
src/
├── app.ts                      # Application entry point
├── config/                     # Configuration files
├── controllers/                # Request handlers
│   └── v1/webhook/            # Webhook controller
├── db/                        # Database models
├── infrastructure/            # Interfaces and types
├── middlewares/              # Express middlewares
├── providers/                # Service providers
│   ├── crm.provider.ts      # CRM webhook handler
│   ├── meta-capi.provider.ts # Meta CAPI integration
│   ├── brevo.provider.ts    # Brevo email integration
│   └── downstream.provider.ts # Orchestration layer
├── queues/                   # Queue processors
│   └── crm/                 # CRM webhook queue
├── routes/                   # API routes
└── services/                 # Business logic services
```

## Error Handling

The service implements comprehensive error handling:
- **Webhook Validation Failures**: Returns 202 status (accepted but not processed)
- **Queue Processing Failures**: Automatic retry with exponential backoff (5 attempts)
- **Downstream Service Failures**: Logged but doesn't block other operations
- **Database Failures**: Properly logged with stack traces

## Monitoring

- **Prometheus Metrics**: Available at `/metrics` endpoint
- **Queue Monitoring**: Automatic alerts for queue backlog
- **Logging**: Structured logging with Winston

## Notes

- This implementation uses demo API keys for Meta CAPI and Brevo
- For production use, replace with actual API credentials
- The service deduplicates webhooks based on `event_reference_status` combination
- All customer data sent to Meta CAPI is hashed using SHA256 for privacy
