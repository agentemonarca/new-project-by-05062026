/**
 * Central app config from environment.
 */
export interface AppConfig {
  /** MongoDB connection string when configured */
  dbUri: string | undefined;
}

/**
 * Single source of truth for the MongoDB URI.
 * Priority: non-empty `MONGO_URI`, then optional legacy `LINUXDB`.
 */
export function getMongoConnectionUri(): string | undefined {
  return (
    process.env.MONGO_URI?.trim() ||
    process.env.LINUXDB?.trim() ||
    undefined
  );
}

export function loadAppConfig(): AppConfig {
  return {
    dbUri: getMongoConnectionUri(),
  };
}
