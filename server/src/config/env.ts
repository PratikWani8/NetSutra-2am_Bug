import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  OPENSEARCH_URL: z.string().default('http://localhost:9200'),
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  MONGODB_URI: z.string().optional().default('mongodb://localhost:27017/netsutra'),
  DEFAULT_AI_PROVIDER: z.enum(['gemma-api', 'ollama']).default('gemma-api'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
