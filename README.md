# hibarr-crm-event-handler
Backend Engineer Assessment - The CRM Event Handler

## Overview

The CRM Event Handler is a robust integration orchestration service that acts as a middleware between a CRM system and downstream services. It processes CRM webhooks, validates incoming requests, stores events in a database, and triggers actions in third-party services based on deal status changes.

## Quick Start with Docker

```bash
# 1. Clone and setup
git clone <repository-url>
cd hibarr-crm-event-handler
cp .env.example .env

# 2. Edit .env file with your API keys (or use demo values)

# 3. Start all services
docker-compose up -d

# 4. Check services are running
docker-compose ps

# 5. Test the webhook endpoint
curl -X POST http://localhost:3232/api/v1/webhook/crm \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -H "x-event: deal_created" \
  -d '{"status": "success", "message": "Test", "data": {...}}'

# 6. View logs
docker-compose logs -f
```

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
4. **CRM Worker**: Background worker that processes queued webhook jobs
5. **CRM Processor**: Processes queued webhook jobs and orchestrates downstream actions
6. **Downstream Provider**: Orchestrates calls to Meta CAPI and Brevo based on deal status
7. **Meta CAPI Provider**: Sends conversion events to Meta's Conversions API
8. **Brevo Provider**: Sends transactional emails via Brevo API

### System Design

The application consists of two main processes:

1. **API Server** (`src/app.ts`):
   - Receives incoming webhooks
   - Validates and authenticates requests
   - Stores webhook receipts in MongoDB
   - Enqueues jobs for processing

2. **Worker Process** (`src/workers/crm-webhook.worker.ts`):
   - Processes jobs from the queue asynchronously
   - Handles retries and error recovery
   - Calls downstream services (Meta CAPI, Brevo)
   - Updates job status in the queue

### Workflow

```
CRM Webhook → API Server → Authentication → Validation → Database Storage → Redis Queue
                                                                                  ↓
                                                                            Worker Process
                                                                                  ↓
                                                                          CRM Processor
                                                                                  ↓
                                                                      Downstream Services
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

### Postman Collection

For easy API testing, a complete Postman collection is available:

📘 **[View Postman Documentation](https://documenter.getpostman.com/view/13203401/2sB3dTtU4d)**

The collection includes:
- Pre-configured webhook requests
- Sample payloads for different deal statuses
- Environment variables setup
- Example responses

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

### Option 1: Docker Setup (Recommended)

The easiest way to run the application is using Docker Compose, which sets up all required services.

#### Prerequisites
- Docker
- Docker Compose

#### Installation Steps

1. Clone the repository

2. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

3. Update environment variables in `.env`:
   - `API_KEY`: Set a secure API key for webhook authentication
   - `META_ACCESS_TOKEN`: Meta Conversions API access token (or use demo value)
   - `META_PIXEL_ID`: Meta pixel ID (or use demo value)
   - `BREVO_API_KEY`: Brevo API key (or use demo value)
   - `BREVO_SENDER_EMAIL`: Sender email for Brevo
   - `CRM_SERVER_URL`: Your CRM server URL

   **Note**: MongoDB and Redis URIs will be automatically configured by Docker Compose.

4. Start all services (API, Worker, MongoDB, Redis):
   ```bash
   docker-compose up -d
   ```

5. View logs:
   ```bash
   # All services
   docker-compose logs -f
   
   # API only
   docker-compose logs -f api
   
   # Worker only
   docker-compose logs -f worker
   ```

6. Stop all services:
   ```bash
   docker-compose down
   ```

7. Stop and remove all data (including database):
   ```bash
   docker-compose down -v
   ```

The application will be available at `http://localhost:3232`

#### Docker Services

The Docker Compose setup includes:
- **API Service**: Handles incoming webhooks and HTTP requests
- **Worker Service**: Processes queued jobs asynchronously
- **MongoDB**: Database for webhook receipts
- **Redis**: Message queue and cache

### Option 2: Local Development Setup

#### Prerequisites
- Node.js (v18 or higher)
- MongoDB (running locally or remote instance)
- Redis (running locally or remote instance)

#### Installation Steps

1. Clone the repository

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

4. Update environment variables in `.env`:
   - `API_KEY`: Set a secure API key for webhook authentication
   - `DB_URI`: MongoDB connection string (e.g., `mongodb://localhost:27017/hibarr-crm-event-handler`)
   - `REDIS_URI`: Redis connection string (e.g., `redis://localhost:6379`)
   - `META_ACCESS_TOKEN`: Meta Conversions API access token
   - `META_PIXEL_ID`: Meta pixel ID
   - `BREVO_API_KEY`: Brevo API key
   - `BREVO_SENDER_EMAIL`: Sender email for Brevo

5. Start the application:

   **Terminal 1 - API Server**:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

   **Terminal 2 - Worker** (Required for processing jobs):
   ```bash
   npm run dev:worker:crm-webhook
   # or
   yarn dev:worker:crm-webhook
   ```

   **Important**: Both the API server and worker must be running for the system to function properly. The API receives webhooks and queues jobs, while the worker processes them asynchronously.

The application will be available at `http://localhost:3000`

## Testing

### With Docker

If using Docker Compose, send a test webhook to:

```bash
curl -X POST http://localhost:3232/api/v1/webhook/crm \
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

Check the worker logs to see job processing:
```bash
docker-compose logs -f worker
```

### With Local Development

Send a test webhook to the local CRM endpoint:

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
├── app.ts                      # Application entry point (API Server)
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
│       ├── crm.processor.ts # Job processing logic
│       ├── crm.queue.ts     # Queue configuration
│       └── crm.types.ts     # Type definitions
├── routes/                   # API routes
├── services/                 # Business logic services
└── workers/                  # Background workers
    └── crm-webhook.worker.ts # CRM webhook worker process
```

## Error Handling

The service implements comprehensive error handling:
- **Webhook Validation Failures**: Returns 202 status (accepted but not processed)
- **Queue Processing Failures**: Automatic retry with exponential backoff (5 attempts)
- **Downstream Service Failures**: Logged but doesn't block other operations
- **Database Failures**: Properly logged with stack traces

## Monitoring

- **Prometheus Metrics**: Available at `/metrics` endpoint
- **Health Check**: Available at `/metrics/health` endpoint
- **Queue Metrics**: Available at `/metrics/queues` endpoint (JSON format)
- **Queue Monitoring**: Automatic alerts for queue backlog
- **Logging**: Structured logging with Winston

### Monitoring Endpoints

```bash
# Health check
curl http://localhost:3232/metrics/health

# Prometheus metrics
curl http://localhost:3232/metrics

# Queue status
curl http://localhost:3232/metrics/queues
```

### Docker Logs

```bash
# View all logs
docker-compose logs -f

# View API logs only
docker-compose logs -f api

# View worker logs only
docker-compose logs -f worker

# View specific service logs
docker-compose logs -f mongodb
docker-compose logs -f redis
```

## Troubleshooting

### Jobs not processing
- Ensure the worker is running: `docker-compose ps` or check Terminal 2 in local setup
- Check worker logs: `docker-compose logs -f worker`
- Verify Redis connection: Check `/metrics/health` endpoint

### Webhook not received
- Verify API is running: `curl http://localhost:3232/health`
- Check API key in request headers matches `.env` file
- Review API logs for validation errors

### Database connection issues
- Ensure MongoDB is running: `docker-compose ps mongodb`
- Check connection string in `.env` file
- View MongoDB logs: `docker-compose logs mongodb`

## Notes

- This implementation uses demo API keys for Meta CAPI and Brevo
- For production use, replace with actual API credentials
- The service deduplicates webhooks based on `event_reference_status` combination
- All customer data sent to Meta CAPI is hashed using SHA256 for privacy
