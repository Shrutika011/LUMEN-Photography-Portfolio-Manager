import { Router, Request, Response } from 'express';
import { checkDatabaseConnection, getPool } from '../db';
import fs from 'fs';
import { config } from '../config';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const dbStatus = await checkDatabaseConnection();
  let photoCount: number | null = null;
  let categoryCount: number | null = null;
  let albumCount: number | null = null;
  let userCount: number | null = null;
  let metricsAvailable = false;

  if (dbStatus.isConnected) {
    try {
      const pool = getPool();
      const [pRows]: any = await pool.query('SELECT COUNT(*) AS cnt FROM photos');
      const [cRows]: any = await pool.query('SELECT COUNT(*) AS cnt FROM categories');
      const [aRows]: any = await pool.query('SELECT COUNT(*) AS cnt FROM albums');
      const [uRows]: any = await pool.query('SELECT COUNT(*) AS cnt FROM users');
      photoCount = Number(pRows[0]?.cnt ?? 0);
      categoryCount = Number(cRows[0]?.cnt ?? 0);
      albumCount = Number(aRows[0]?.cnt ?? 0);
      userCount = Number(uRows[0]?.cnt ?? 0);
      metricsAvailable = true;
    } catch (e: any) {
      console.error('[Health Endpoint] Count query failed:', e?.code || 'MYSQL_METRICS_FAILED');
    }
  }

  const storageActive = fs.existsSync(config.uploadDir);
  const databaseConnected = dbStatus.isConnected;
  const status = !databaseConnected
    ? 'disconnected'
    : metricsAvailable
      ? 'ok'
      : 'degraded';

  res.status(databaseConnected ? 200 : 503).json({
    status,
    isConnected: databaseConnected,
    engine: 'MySQL',
    database: databaseConnected ? 'configured' : 'unavailable',
    host: 'not exposed',
    port: 0,
    tableCount: dbStatus.tableCount ?? 0,
    tables: [],
    photoCount,
    categoryCount,
    albumCount,
    userCount,
    storageActive,
    uploadDir: 'local filesystem',
    storageDurable: false,
    timestamp: new Date().toISOString(),
    error: databaseConnected
      ? metricsAvailable ? null : 'MySQL is connected, but health metrics could not be collected.'
      : 'MySQL is unavailable. Check server configuration and database connectivity.',
  });
});

export default router;
