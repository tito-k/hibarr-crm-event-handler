import { config } from 'dotenv';
import Joi from 'joi';
import fs from 'fs';
import path from 'path';

import { ServerEnvOptions } from './constants';

// Resolve and load environment file: prefer NODE_ENV-specific, fallback to .env
const envCandidates = ['.env', `.env.${process.env.NODE_ENV || 'development'}`];
const resolvedEnvFile = envCandidates
  .map((p) => path.resolve(process.cwd(), p))
  .find((p) => fs.existsSync(p));

if (resolvedEnvFile) {
  config({ path: resolvedEnvFile, quiet: true });
} else {
  config({ quiet: true });
}

interface IServerConfig {
  node: {
    env: ServerEnvOptions;
    service: string;
    version: string;
  };
  server: {
    port: number;
    baseUrl: string;
    tz: string;
  };
  logging: {
    directoryName: string;
    level: string;
  };
  security: {
    rateLimitWindowMs: number;
    rateLimitMax: number;
    enableHelmet: boolean;
    enableCompression: boolean;
  };
  monitoring: {
    enableMetrics: boolean; // Enable Prometheus metrics
    // Alerting for job queue backlog
    queueAlert: {
      enabled: boolean;
      waitingThreshold: number;
      backlogMinutes: number;
      cooldownMinutes: number;
      recipients: string[];
    };
  };
  auth: { apiKey: string };
  cors: { allowedOrigins: string[] };
  db: { uri: string };
  redis: { uri: string };
  crm: { serverUrl: string };
  meta: {
    accessToken: string;
    pixelId: string;
    apiVersion: string;
  };
  brevo: {
    apiKey: string;
    senderEmail: string;
    senderName: string;
  };
}

const envVarsSchema = Joi.object()
  .keys({
    // Server config
    NODE_ENV: Joi.string()
      .default(ServerEnvOptions.DEVELOPMENT)
      .valid(...Object.values(ServerEnvOptions)),
    PORT: Joi.number().default(3000),
    BASE_URL: Joi.string().uri().required(),
    TZ: Joi.string().default('UTC'),

    // Logging config
    LOG_DIR_NAME: Joi.string().default('logs'),
    LOG_LEVEL: Joi.string().default('debug').valid('info', 'debug'),

    // Security config
    RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes
    RATE_LIMIT_MAX: Joi.number().default(100), // limit each IP to 100 requests per windowMs
    ENABLE_HELMET: Joi.boolean().default(true),
    ENABLE_COMPRESSION: Joi.boolean().default(true),

    // Monitoring config
    ENABLE_METRICS: Joi.boolean().default(true),
    ALERT_QUEUE_ENABLED: Joi.boolean().default(true),
    ALERT_QUEUE_WAITING_THRESHOLD: Joi.number().default(50),
    ALERT_QUEUE_BACKLOG_MINUTES: Joi.number().default(5),
    ALERT_QUEUE_COOLDOWN_MINUTES: Joi.number().default(30),
    ALERT_RECIPIENTS: Joi.string()
      .default('')
      .custom((value, helpers) => {
        // format string into an array of string
        const parts = value
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
        return parts;
      }),

    // Auth config
    API_KEY: Joi.string().required(),

    // CORS config
    CORS_ALLOWED_ORIGINS: Joi.string()
      .default('*')
      .custom((value, helpers) => {
        // format string into an array of string
        const parts = value.split(',');
        if (parts.length === 0) {
          return helpers.error('any.invalid');
        }
        return parts;
      }),

    // Database config
    DB_URI: Joi.string().required(),

    // Redis config
    REDIS_URI: Joi.string().required(),

    // CRM config
    CRM_SERVER_URL: Joi.string().uri().required(),

    // Meta CAPI config
    META_ACCESS_TOKEN: Joi.string().default('demo-meta-access-token'),
    META_PIXEL_ID: Joi.string().default('demo-pixel-id'),
    META_API_VERSION: Joi.string().default('v21.0'),

    // Brevo config
    BREVO_API_KEY: Joi.string().default('demo-brevo-api-key'),
    BREVO_SENDER_EMAIL: Joi.string().email().default('noreply@example.com'),
    BREVO_SENDER_NAME: Joi.string().default('Hibarr CRM'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  console.error(`Config validation error: ${error.message}`);
  process.exit(1);
}

const serverConfig: IServerConfig = Object.freeze({
  node: {
    env: envVars.NODE_ENV,
    service: envVars.npm_package_name,
    version: envVars.npm_package_version,
  },
  logging: {
    directoryName: envVars.LOG_DIR_NAME,
    level: envVars.LOG_LEVEL,
  },
  security: {
    rateLimitWindowMs: envVars.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: envVars.RATE_LIMIT_MAX,
    enableHelmet: envVars.ENABLE_HELMET,
    enableCompression: envVars.ENABLE_COMPRESSION,
  },
  monitoring: {
    enableMetrics: envVars.ENABLE_METRICS,
    queueAlert: {
      enabled: envVars.ALERT_QUEUE_ENABLED,
      waitingThreshold: envVars.ALERT_QUEUE_WAITING_THRESHOLD,
      backlogMinutes: envVars.ALERT_QUEUE_BACKLOG_MINUTES,
      cooldownMinutes: envVars.ALERT_QUEUE_COOLDOWN_MINUTES,
      recipients: envVars.ALERT_RECIPIENTS,
    },
  },
  server: {
    port: envVars.PORT,
    baseUrl: envVars.BASE_URL,
    tz: envVars.TZ,
  },
  auth: { apiKey: envVars.API_KEY },
  cors: { allowedOrigins: envVars.CORS_ALLOWED_ORIGINS },
  db: { uri: envVars.DB_URI },
  redis: { uri: envVars.REDIS_URI },
  crm: { serverUrl: envVars.CRM_SERVER_URL },
  meta: {
    accessToken: envVars.META_ACCESS_TOKEN,
    pixelId: envVars.META_PIXEL_ID,
    apiVersion: envVars.META_API_VERSION,
  },
  brevo: {
    apiKey: envVars.BREVO_API_KEY,
    senderEmail: envVars.BREVO_SENDER_EMAIL,
    senderName: envVars.BREVO_SENDER_NAME,
  },
});

export default serverConfig;
