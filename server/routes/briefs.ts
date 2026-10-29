import { Router, Request, Response } from 'express';
import {
  checkDatabaseConnection,
  ensureUserRecord,
  getMemoryStore,
  getPool,
  getTableColumns,
  respondDatabaseUnavailable,
  respondDatabaseWriteError,
} from '../db';

const router = Router();

function mapBrief(row: any): Record<string, unknown> {
  let portfolioData = row.portfolio_data ?? null;
  if (typeof portfolioData === 'string') {
    portfolioData = JSON.parse(portfolioData);
  }

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    purpose: row.purpose,
    targetAudience: row.target_audience,
    targetCount: Number(row.target_count),
    curationStrategy: row.curation_strategy,
    candidatePoolCount: Number(row.candidate_pool_count),
    selectedAlbumId: row.selected_album_id,
    portfolioData,
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

function normalizePortfolioData(value: unknown): { photos: Record<string, unknown>[] } | null {
  if (value === null) return null;
  if (typeof value !== 'object' || value === null || !('photos' in value) || !Array.isArray(value.photos)) {
    throw new Error('Portfolio data must include an ordered photos array.');
  }
  if (value.photos.length > 500) {
    throw new Error('A portfolio cannot contain more than 500 photos.');
  }

  const seenPhotoIds = new Set<string>();
  const photos = value.photos.map((photo) => {
    if (
      typeof photo !== 'object' ||
      photo === null ||
      !('id' in photo) ||
      typeof photo.id !== 'string' ||
      !photo.id.trim() ||
      !('title' in photo) ||
      typeof photo.title !== 'string' ||
      !('url' in photo) ||
      typeof photo.url !== 'string'
    ) {
      throw new Error('Each portfolio photo must include an ID, title, and image URL.');
    }
    if (seenPhotoIds.has(photo.id)) {
      throw new Error(`Portfolio photo "${photo.id}" appears more than once.`);
    }
    seenPhotoIds.add(photo.id);

    return {
      id: photo.id,
      title: photo.title,
      url: photo.url,
      camera: typeof photo.camera === 'string' ? photo.camera : '',
      lens: typeof photo.lens === 'string' ? photo.lens : '',
      aperture: typeof photo.aperture === 'string' ? photo.aperture : '',
      shutter: typeof photo.shutter === 'string' ? photo.shutter : '',
      iso: typeof photo.iso === 'string' ? photo.iso : '',
      dimensions: typeof photo.dimensions === 'string' ? photo.dimensions : '',
      fileSize: Number(photo.fileSize || 0),
      categoryId: typeof photo.categoryId === 'string' ? photo.categoryId : '',
      categoryName: typeof photo.categoryName === 'string' ? photo.categoryName : '',
      shoot: typeof photo.shoot === 'string' ? photo.shoot : '',
      shootLabel: typeof photo.shootLabel === 'string' ? photo.shootLabel : '',
      score: Number(photo.score || 0),
      isFavorite: Boolean(photo.isFavorite),
      inActivePortfolio: true,
      plateNumber: seenPhotoIds.size,
      isCoverHero: Boolean(photo.isCoverHero),
      clientStatus: typeof photo.clientStatus === 'string' ? photo.clientStatus : '',
      clientNotes: Array.isArray(photo.clientNotes) ? photo.clientNotes : [],
      tags: Array.isArray(photo.tags) ? photo.tags : [],
      description: typeof photo.description === 'string' ? photo.description : '',
      datePhotographed: typeof photo.datePhotographed === 'string' ? photo.datePhotographed : '',
      createdAt: typeof photo.createdAt === 'string' ? photo.createdAt : '',
      userId: typeof photo.userId === 'string' ? photo.userId : null,
    };
  });
  return { photos };
}

function getPortfolioData(body: Record<string, unknown>): string | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(body, 'portfolioData')) return undefined;
  return JSON.stringify(normalizePortfolioData(body.portfolioData));
}

// GET /api/briefs/saved?userId=...
router.get('/saved', async (req: Request, res: Response): Promise<void> => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
  if (!userId) {
    res.status(400).json({ error: 'A user ID is required to list saved portfolio briefs.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Saved portfolio briefs');
    return;
  }

  try {
    const columns = await getTableColumns('portfolio_briefs');
    const audienceColumn = columns.has('target_audience') ? 'target_audience' : 'audience';
    const [rows]: any = await getPool().query(
      `SELECT b.*, b.${audienceColumn} AS target_audience
       FROM portfolio_briefs b
       WHERE b.user_id = ?
       ORDER BY b.updated_at DESC`,
      [userId]
    );
    res.json(rows.map(mapBrief));
  } catch (err: any) {
    console.error('[Briefs API] MySQL saved-brief fetch failed:', err);
    res.status(500).json({ error: 'Saved portfolio briefs could not be loaded from MySQL.' });
  }
});

// GET /api/briefs or /api/briefs/:userId
router.get('/:userId?', async (req: Request, res: Response): Promise<void> => {
  const authenticatedUser = req.authUser;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to load a portfolio brief.' });
    return;
  }

  const userId = req.params.userId || authenticatedUser.id;
  if (userId !== authenticatedUser.id) {
    res.status(403).json({ error: 'You cannot access another user’s portfolio brief.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();

  if (dbStatus.isConnected) {
    try {
      const pool = getPool();
      const columns = await getTableColumns('portfolio_briefs');
      const audienceColumn = columns.has('target_audience') ? 'target_audience' : 'audience';
      const [rows]: any = await pool.query(
        `SELECT b.*, b.${audienceColumn} AS target_audience
         FROM portfolio_briefs b
         WHERE b.user_id = ? OR b.id = ?
         ORDER BY b.updated_at DESC LIMIT 1`,
        [userId, `brief-${userId}`]
      );
      if (rows && rows.length > 0) {
        res.json(mapBrief(rows[0]));
        return;
      }
    } catch (err: any) {
      console.error('[Briefs API] MySQL fetch failed:', err);
      res.status(500).json({ error: 'Portfolio brief could not be loaded from MySQL.' });
      return;
    }

    res.json(null);
    return;
  }

  res.setHeader('X-Lumen-Storage', 'demo');
  const mem = getMemoryStore();
  const brief = mem.briefs.find((b) => b.userId === userId || b.id === `brief-${userId}`) || mem.briefs[0];
  res.json(brief || null);
});

// POST /api/briefs - Save or update brief
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const b = req.body;
  if (!b || typeof b.title !== 'string' || !b.title.trim() || typeof b.userId !== 'string' || !b.userId) {
    res.status(400).json({ error: 'User ID and portfolio title are required.' });
    return;
  }

  const userId = b.userId;
  const briefId = b.id || `brief-${userId}`;
  let portfolioData: string | null | undefined;
  try {
    portfolioData = getPortfolioData(b);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Portfolio data is invalid.' });
    return;
  }

  const briefRecord = {
    id: briefId,
    userId: userId,
    title: b.title,
    purpose: b.purpose || 'Editorial & Monograph Submission',
    targetAudience: b.targetAudience || 'Curators, Gallerists, High-Fashion Publishers',
    targetCount: Number(b.targetCount || 24),
    curationStrategy: b.curationStrategy || 'visual_tempo',
    candidatePoolCount: Number(b.candidatePoolCount || 24),
    selectedAlbumId: b.selectedAlbumId || null,
    isPublished: Boolean(b.isPublished),
    publishedAt: b.publishedAt || (b.isPublished ? new Date().toISOString() : null),
    updatedAt: new Date().toISOString(),
  };

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Portfolio brief');
    return;
  }

  let connection;
  try {
    const pool = getPool();
    const columns = await getTableColumns('portfolio_briefs');
    const audienceColumn = columns.has('target_audience') ? 'target_audience' : 'audience';
    if (!columns.has('portfolio_data')) {
      res.status(503).json({ error: 'Portfolio persistence is not initialized. Apply migrations/20261029_add_portfolio_data.sql.' });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    await ensureUserRecord(connection, userId, b.user);
    const [existing]: any = await connection.query(
      'SELECT user_id FROM portfolio_briefs WHERE id = ? FOR UPDATE',
      [briefId]
    );
    if (existing.length && existing[0].user_id !== userId) {
      await connection.rollback();
      res.status(404).json({ error: 'Portfolio not found.' });
      return;
    }

    if (existing.length) {
      await connection.query(
        `UPDATE portfolio_briefs
         SET title = ?, purpose = ?, ${audienceColumn} = ?, target_count = ?,
             curation_strategy = ?, candidate_pool_count = ?, selected_album_id = ?,
             is_published = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP
             ${portfolioData === undefined ? '' : ', portfolio_data = ?'}
         WHERE id = ? AND user_id = ?`,
        [
          briefRecord.title, briefRecord.purpose, briefRecord.targetAudience,
          briefRecord.targetCount, briefRecord.curationStrategy,
          briefRecord.candidatePoolCount, briefRecord.selectedAlbumId,
          briefRecord.isPublished ? 1 : 0, briefRecord.publishedAt,
          ...(portfolioData === undefined ? [] : [portfolioData]),
          briefId, userId,
        ]
      );
    } else {
      await connection.query(
        `INSERT INTO portfolio_briefs
          (id, user_id, title, purpose, ${audienceColumn}, target_count, curation_strategy,
           candidate_pool_count, selected_album_id, is_published, published_at, portfolio_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          briefRecord.id, briefRecord.userId, briefRecord.title, briefRecord.purpose,
          briefRecord.targetAudience, briefRecord.targetCount, briefRecord.curationStrategy,
          briefRecord.candidatePoolCount, briefRecord.selectedAlbumId,
          briefRecord.isPublished ? 1 : 0, briefRecord.publishedAt, portfolioData ?? null,
        ]
      );
    }
    await connection.commit();
    const [rows]: any = await pool.query(
      `SELECT b.*, b.${audienceColumn} AS target_audience
       FROM portfolio_briefs b WHERE b.id = ? AND b.user_id = ?`,
      [briefId, userId]
    );
    res.json(mapBrief(rows[0]));
  } catch (err: any) {
    if (connection) await connection.rollback();
    respondDatabaseWriteError(res, 'Briefs API', 'Portfolio brief', err);
  } finally {
    connection?.release();
  }
});

// PUT /api/briefs/:id - Update a saved brief owned by the supplied user
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.body;
  const b = req.body;
  if (typeof userId !== 'string' || !userId || typeof b.title !== 'string' || !b.title.trim()) {
    res.status(400).json({ error: 'User ID and brief title are required.' });
    return;
  }

  let portfolioData: string | null | undefined;
  try {
    portfolioData = getPortfolioData(b);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Portfolio data is invalid.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Portfolio brief');
    return;
  }

  try {
    const pool = getPool();
    const [existing]: any = await pool.query(
      'SELECT id FROM portfolio_briefs WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (!existing.length) {
      res.status(404).json({ error: 'Saved portfolio brief not found.' });
      return;
    }

    const columns = await getTableColumns('portfolio_briefs');
    const audienceColumn = columns.has('target_audience') ? 'target_audience' : 'audience';
    const briefRecord = {
      id: req.params.id,
      userId,
      title: b.title.trim(),
      purpose: b.purpose || 'Editorial & Monograph Submission',
      targetAudience: b.targetAudience || 'Curators, Gallerists, High-Fashion Publishers',
      targetCount: Number(b.targetCount || 24),
      curationStrategy: b.curationStrategy || 'visual_tempo',
      candidatePoolCount: Number(b.candidatePoolCount || 24),
      selectedAlbumId: b.selectedAlbumId || null,
      isPublished: Boolean(b.isPublished),
      publishedAt: b.publishedAt || null,
      updatedAt: new Date().toISOString(),
    };
    if (portfolioData !== undefined && !columns.has('portfolio_data')) {
      res.status(503).json({ error: 'Portfolio persistence is not initialized. Apply migrations/20261029_add_portfolio_data.sql.' });
      return;
    }
    await pool.query(
      `UPDATE portfolio_briefs
       SET title = ?, purpose = ?, ${audienceColumn} = ?, target_count = ?,
           curation_strategy = ?, candidate_pool_count = ?, selected_album_id = ?,
           is_published = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP
           ${portfolioData === undefined ? '' : ', portfolio_data = ?'}
       WHERE id = ? AND user_id = ?`,
      [
        briefRecord.title, briefRecord.purpose, briefRecord.targetAudience,
        briefRecord.targetCount, briefRecord.curationStrategy,
        briefRecord.candidatePoolCount, briefRecord.selectedAlbumId,
        briefRecord.isPublished ? 1 : 0, briefRecord.publishedAt,
        ...(portfolioData === undefined ? [] : [portfolioData]),
        req.params.id, userId,
      ]
    );
    const [rows]: any = await pool.query(
      `SELECT b.*, b.${audienceColumn} AS target_audience
       FROM portfolio_briefs b WHERE b.id = ? AND b.user_id = ?`,
      [req.params.id, userId]
    );
    res.json(mapBrief(rows[0]));
  } catch (err: any) {
    respondDatabaseWriteError(res, 'Briefs API', 'Portfolio brief', err);
  }
});

// DELETE /api/briefs/:id - Delete a saved brief owned by the supplied user
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.body;
  if (typeof userId !== 'string' || !userId) {
    res.status(400).json({ error: 'User ID is required to delete a saved portfolio brief.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Portfolio brief');
    return;
  }

  try {
    const [result]: any = await getPool().query(
      'DELETE FROM portfolio_briefs WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Saved portfolio brief not found.' });
      return;
    }
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    respondDatabaseWriteError(res, 'Briefs API', 'Portfolio brief', err);
  }
});

// POST /api/briefs/:id/publish
router.post('/:id/publish', async (req: Request, res: Response): Promise<void> => {
  const briefId = req.params.id;
  const authenticatedUser = req.authUser;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to publish a portfolio brief.' });
    return;
  }
  if (authenticatedUser.role !== 'OWNER') {
    res.status(403).json({ error: 'Only the studio owner can publish portfolio briefs.' });
    return;
  }
  const userId = authenticatedUser.id;

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Portfolio brief');
    return;
  }

  try {
    const pool = getPool();
    const [result]: any = await pool.query(
      'UPDATE portfolio_briefs SET is_published = 1, published_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [briefId, userId]
    );
    if (result.affectedRows === 0) {
      const [rows]: any = await pool.query(
        'SELECT id FROM portfolio_briefs WHERE id = ? AND user_id = ?',
        [briefId, userId]
      );
      if (!rows.length) {
        res.status(404).json({ error: 'Portfolio brief not found.' });
        return;
      }
    }
  } catch (err: any) {
    respondDatabaseWriteError(res, 'Briefs API', 'Portfolio brief', err);
    return;
  }

  res.json({ success: true, id: briefId, isPublished: true });
});

export default router;
