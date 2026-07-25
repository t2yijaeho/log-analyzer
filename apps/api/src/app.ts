import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config.js';
import { ApiError } from './errors/ApiError.js';
import { errorHandler } from './middleware/errorHandler.js';
import { chatRouter } from './routes/chat.js';
import { healthRouter } from './routes/health.js';
import { logsRouter } from './routes/logs.js';

export const RATE_LIMITS = {
  general: { windowMs: 15 * 60 * 1000, limit: 120 },
  chat: { windowMs: 5 * 60 * 1000, limit: 10 },
} as const;

export interface CreateAppOptions {
  skipRateLimit?: boolean;
  generalLimit?: number;
  chatLimit?: number;
}

function webDistPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'web', 'dist');
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const skipRateLimit = options.skipRateLimit ?? config.nodeEnv === 'test';
  const generalLimiter = rateLimit({
    ...RATE_LIMITS.general,
    limit: options.generalLimit ?? RATE_LIMITS.general.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => skipRateLimit,
  });
  const chatLimiter = rateLimit({
    ...RATE_LIMITS.chat,
    limit: options.chatLimit ?? RATE_LIMITS.chat.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => skipRateLimit,
  });
  app.disable('x-powered-by');
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', generalLimiter);

  app.use('/api/health', healthRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/chat', chatLimiter, chatRouter);

  if (config.serveWeb) {
    const dist = webDistPath();
    if (existsSync(path.join(dist, 'index.html'))) {
      app.use(express.static(dist, { index: false, maxAge: config.isProduction ? '1h' : 0 }));
      app.use((req, res, next) => {
        if (req.method === 'GET' && req.accepts('html')) {
          res.sendFile(path.join(dist, 'index.html'));
          return;
        }
        next();
      });
    }
  }

  app.use((_req, _res, next) => {
    next(ApiError.notFound('not found'));
  });

  app.use(errorHandler);
  return app;
}
