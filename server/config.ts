import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parsePort(value: string | undefined, fallback: number, name: string): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return parsed;
}

function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (databaseUrl) {
    let url: URL;
    try {
      url = new URL(databaseUrl);
    } catch {
      throw new Error('DATABASE_URL must be a valid MySQL connection URL.');
    }
    if (url.protocol !== 'mysql:' || !url.hostname || !url.pathname.slice(1)) {
      throw new Error('DATABASE_URL must use mysql:// and include a host and database name.');
    }
    return {
      host: url.hostname,
      port: parsePort(url.port || undefined, 3306, 'Database port'),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parsePort(process.env.DB_PORT, 3306, 'DB_PORT'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lumen_db',
  };
}

const database = getDatabaseConfig();

export const config = {
  port: parsePort(process.env.PORT, 3000, 'PORT'),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    ...database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000,
  },
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
  uploadStorage: process.env.UPLOAD_STORAGE || 'local',
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || '3000'}`,
  maxFileSize: 50 * 1024 * 1024, // 50MB max file size for high-res RAW/JPEG photography
};

export function validateRuntimeConfig(): void {
  if (config.nodeEnv !== 'production') return;

  const hasConnectionUrl = Boolean(process.env.DATABASE_URL || process.env.MYSQL_URL);
  const hasCompleteDatabaseConfig = Boolean(
    process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME
  );
  if (!hasConnectionUrl && !hasCompleteDatabaseConfig) {
    throw new Error('Production requires DATABASE_URL or DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME.');
  }
  if (!process.env.AUTH_TOKEN_SECRET || process.env.AUTH_TOKEN_SECRET.length < 32) {
    throw new Error('Production requires AUTH_TOKEN_SECRET to contain at least 32 characters.');
  }
  if (!['local', 's3'].includes(config.uploadStorage)) {
    throw new Error('UPLOAD_STORAGE must be either "local" or "s3".');
  }
  if (config.uploadStorage === 's3') {
    throw new Error('S3 upload storage is not configured in this build. Use durable mounted storage or configure an object-storage provider.');
  }
}
