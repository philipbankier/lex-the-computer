import path from 'node:path';

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  LITELLM_BASE_URL: process.env.LITELLM_BASE_URL || process.env.LITELLM_URL || 'http://localhost:4000',
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.resolve(process.cwd(), 'workspace'),
};
