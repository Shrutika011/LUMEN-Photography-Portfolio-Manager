import { Router, Request, Response } from 'express';
import {
  checkDatabaseConnection,
  ensureUserRecord,
  getMemoryStore,
  getPool,
  respondDatabaseUnavailable,
  respondDatabaseWriteError,
} from '../db';

const router = Router();

// GET /api/categories
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const dbStatus = await checkDatabaseConnection();

  if (dbStatus.isConnected) {
    try {
      const pool = getPool();
      const [rows]: any = await pool.query(
        'SELECT id, name, is_custom AS isCustom, user_id AS userId, created_at AS createdAt FROM categories ORDER BY is_custom ASC, name ASC'
      );
      res.json(rows.map((r: any) => ({ ...r, isCustom: Boolean(r.isCustom) })));
      return;
    } catch (err: any) {
      console.error('[Categories API] MySQL fetch failed:', err);
      res.status(500).json({ error: 'Categories could not be loaded from MySQL.' });
      return;
    }
  }

  res.setHeader('X-Lumen-Storage', 'demo');
  const mem = getMemoryStore();
  res.json(mem.categories);
});

// POST /api/categories
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { name, isCustom } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Category name cannot be empty' });
    return;
  }
  const authenticatedUser = req.authUser;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to create a category.' });
    return;
  }
  if (!['OWNER', 'EDITOR'].includes(authenticatedUser.role)) {
    res.status(403).json({ error: 'Your account cannot create categories.' });
    return;
  }

  const trimmed = name.trim();
  const catId = req.body.id || `cat-${Date.now()}`;
  const customFlag = isCustom !== undefined ? !!isCustom : true;
  const user = authenticatedUser.id;

  const newCat = {
    id: catId,
    name: trimmed,
    isCustom: customFlag,
    userId: user,
    createdAt: new Date().toISOString(),
  };

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Category');
    return;
  }

  try {
    const pool = getPool();
    await ensureUserRecord(pool, newCat.userId, authenticatedUser);
    await pool.query(
        'INSERT INTO categories (id, name, is_custom, user_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
        [newCat.id, newCat.name, newCat.isCustom ? 1 : 0, newCat.userId]
      );
    const [rows]: any = await pool.query(
      'SELECT id, name, is_custom AS isCustom, user_id AS userId, created_at AS createdAt FROM categories WHERE id = ? OR name = ? LIMIT 1',
      [newCat.id, newCat.name]
    );
    if (!rows.length) {
      res.status(500).json({ error: 'Category was not returned after saving to MySQL.' });
      return;
    }
    res.status(201).json({ ...rows[0], isCustom: Boolean(rows[0].isCustom) });
  } catch (err: any) {
    respondDatabaseWriteError(res, 'Categories API', 'Category', err);
  }
});

export default router;
