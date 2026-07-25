import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

function findRepoEnv(): string | undefined {
  const starts = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))];
  for (const start of starts) {
    let cursor = path.resolve(start);
    for (;;) {
      const candidate = path.join(cursor, '.env');
      if (existsSync(candidate)) return candidate;
      const parent = path.dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
  return undefined;
}

const envPath = findRepoEnv();
if (envPath) loadDotenv({ path: envPath, quiet: true });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  OPENAI_API_KEY: z.string().min(1).optional(),
  APP_ACCESS_TOKEN: z.string().min(16).optional(),
  LOG_FETCH_HOSTS: z.string().default('raw.githubusercontent.com'),
  OPENAI_MODEL: z.string().min(1).default('gpt-5.6-terra'),
  OPENAI_REASONING_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh']).default('xhigh'),
  SERVE_WEB: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  MAX_SESSIONS: z.coerce.number().int().min(1).max(10_000).default(500),
});

const env = EnvSchema.parse(process.env);
const allowedLogHosts = new Set(
  env.LOG_FETCH_HOSTS.split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  openaiApiKey: env.OPENAI_API_KEY,
  accessToken: env.APP_ACCESS_TOKEN,
  allowedLogHosts,
  openaiModel: env.OPENAI_MODEL,
  reasoningEffort: env.OPENAI_REASONING_EFFORT,
  serveWeb: env.SERVE_WEB === 'true',
  trustProxy: env.TRUST_PROXY,
  maxSessions: env.MAX_SESSIONS,
};

export function assertRuntimeConfig(): void {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required to start the API');
  }
  if (config.isProduction && !config.accessToken) {
    throw new Error('APP_ACCESS_TOKEN (at least 16 characters) is required in production');
  }
}
