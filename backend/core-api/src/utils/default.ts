/**
 * Central app config from environment.
 */
export interface AppConfig {
  /** MongoDB connection string when configured */
  dbUri: string | undefined;
}

/** Genesis / P2P / admin-signals primary DB. */
export function getMongoConnectionUriGenesis(): string | undefined {
  return (
    process.env.MONGO_URI_GENESIS?.trim() ||
    process.env.MONGO_URI?.trim() ||
    process.env.LINUXDB?.trim() ||
    undefined
  );
}

/** Optional second cluster or database (admin reads via `?source=winx`). */
export function getMongoConnectionUriWinx(): string | undefined {
  return process.env.MONGO_URI_WINX?.trim() || undefined;
}

/** Optional third cluster or database (admin reads via `?source=gpulse`). */
export function getMongoConnectionUriGpulse(): string | undefined {
  return process.env.MONGO_URI_GPULSE?.trim() || undefined;
}

/**
 * @deprecated Use getMongoConnectionUriGenesis — alias for backward compatibility.
 */
export function getMongoConnectionUri(): string | undefined {
  return getMongoConnectionUriGenesis();
}

export function loadAppConfig(): AppConfig {
  return {
    dbUri: getMongoConnectionUri(),
  };
}
