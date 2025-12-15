// /**
//  * CRM Webhook Worker
//  *
//  * Background worker for processing CRM webhook payloads.
//  * Processes CRM webhook payloads asynchronously.
//  */

// import { logger } from '../utils';
// import { QueueService, processCRMWebhook } from '../queues';
// import db from '../db';

// async function startWorker() {
//   try {
//     // Initialize database connection and models
//     await db.connect();
//     logger.info('CRM Webhook worker: Database connected');

//     const queueService = QueueService.getInstance();

//     // Create worker with processor function
//     const worker = queueService.createWorker(
//       CRM_WEBHOOK_QUEUE,
//       processCRMWebhook,
//       {
//         concurrency: 5, // Process up to 5 jobs concurrently
//       },
//     );

//     worker.on('ready', () =>
//       logger.info('CRM Webhook worker ready', {
//         queue: CRM_WEBHOOK_QUEUE,
//       }),
//     );

//     // Graceful shutdown
//     process.on('SIGTERM', async () => {
//       logger.warn('CRM Webhook worker shutting down (SIGTERM)...');
//       try {
//         await worker.close();
//         await db.disconnect();
//         logger.info('CRM Webhook worker closed gracefully');
//       } finally {
//         process.exit(0);
//       }
//     });

//     process.on('SIGINT', async () => {
//       logger.warn('CRM Webhook worker shutting down (SIGINT)...');
//       try {
//         await worker.close();
//         await db.disconnect();
//         logger.info('CRM Webhook worker closed gracefully');
//       } finally {
//         process.exit(0);
//       }
//     });
//   } catch (error) {
//     logger.error('Failed to start CRM Webhook worker', { error });
//     process.exit(1);
//   }
// }

// // Start the worker
// startWorker();
