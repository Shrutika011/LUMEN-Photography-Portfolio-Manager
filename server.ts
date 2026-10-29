import express from 'express';
import { createServer } from './server/index';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { config, validateRuntimeConfig } from './server/config';

async function startServer() {
  validateRuntimeConfig();
  const app = createServer();
  const PORT = config.port;
  const isProduction = config.nodeEnv === 'production';

  if (isProduction) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LUMEN] Full-stack studio manager listening on http://0.0.0.0:${PORT}`);
    console.log(`[LUMEN] REST API endpoints: http://0.0.0.0:${PORT}/api/health`);
  });
}

startServer().catch((err) => {
  console.error('[LUMEN] Failed to start full-stack server:', err instanceof Error ? err.message : 'Unexpected startup error.');
  process.exit(1);
});
