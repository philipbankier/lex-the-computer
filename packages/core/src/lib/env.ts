export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  LITELLM_BASE_URL: process.env.LITELLM_BASE_URL || process.env.LITELLM_URL || 'http://localhost:4000',
};

