import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';

import healthRouter from './routes/health';
import photosRouter from './routes/photos';
import categoriesRouter from './routes/categories';
import albumsRouter from './routes/albums';
import briefsRouter from './routes/briefs';
import uploadRouter from './routes/upload';
import authRouter from './routes/auth';
import { requireAuthenticatedUser } from './auth';

export function createServer(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static directory for uploaded images
  app.use('/uploads', express.static(config.uploadDir));
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'public/uploads')));

  // REST API Endpoints
  app.use('/api/health', healthRouter);
  app.use('/api', (req, res, next) => {
    const publicAuthEndpoints = new Set([
      '/auth/login',
      '/auth/register',
      '/auth/session',
      '/auth/logout',
    ]);
    if (publicAuthEndpoints.has(req.path)) {
      next();
      return;
    }
    void requireAuthenticatedUser(req, res, next);
  });
  app.use('/api/photos', photosRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/albums', albumsRouter);
  app.use('/api/briefs', briefsRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/users', authRouter);
  app.use('/api/auth', authRouter);

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[LUMEN API Error]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
