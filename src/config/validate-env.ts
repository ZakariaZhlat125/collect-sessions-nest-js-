export function validateEnv(config: Record<string, unknown>) {
  for (const key of ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'CLIENT_URL']) {
    if (!config[key]) throw new Error(`Missing env var: ${key}`);
  }
  return config;
}
