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

// GET /api/albums
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const dbStatus = await checkDatabaseConnection();

  if (dbStatus.isConnected) {
    try {
      const pool = getPool();
      const [rows]: any = await pool.query(`
        SELECT a.id, a.user_id AS userId, a.title, a.description,
               a.cover_image_id AS coverImageId, a.cover_url AS coverUrl,
               a.created_at AS createdAt,
               (SELECT GROUP_CONCAT(ap.photo_id ORDER BY ap.position ASC SEPARATOR '|||')
                FROM album_photos ap WHERE ap.album_id = a.id) AS photo_id_list
        FROM albums a
        ORDER BY a.created_at DESC
      `);

      const albums = rows.map((r: any) => ({
        id: r.id,
        userId: r.userId || 'usr-owner-01',
        title: r.title,
        description: r.description || '',
        coverImageId: r.coverImageId || null,
        coverUrl: r.coverUrl || null,
        photoIds: r.photo_id_list ? r.photo_id_list.split('|||') : [],
        createdAt: r.createdAt || new Date().toISOString(),
      }));
      res.json(albums);
      return;
    } catch (err: any) {
      console.error('[Albums API] MySQL fetch failed:', err);
      res.status(500).json({ error: 'Albums could not be loaded from MySQL.' });
      return;
    }
  }

  res.setHeader('X-Lumen-Storage', 'demo');
  const mem = getMemoryStore();
  res.json(mem.albums);
});

// GET /api/albums/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const albumId = req.params.id;
  const dbStatus = await checkDatabaseConnection();

  if (dbStatus.isConnected) {
    try {
      const pool = getPool();
      const [rows]: any = await pool.query(
        `SELECT a.id, a.user_id AS userId, a.title, a.description,
                a.cover_image_id AS coverImageId, a.cover_url AS coverUrl,
                a.created_at AS createdAt,
                (SELECT GROUP_CONCAT(ap.photo_id ORDER BY ap.position ASC SEPARATOR '|||')
                 FROM album_photos ap WHERE ap.album_id = a.id) AS photo_id_list
         FROM albums a WHERE a.id = ?`,
        [albumId]
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        res.json({
          id: r.id,
          userId: r.userId || 'usr-owner-01',
          title: r.title,
          description: r.description || '',
          coverImageId: r.coverImageId || null,
          coverUrl: r.coverUrl || null,
          photoIds: r.photo_id_list ? r.photo_id_list.split('|||') : [],
          createdAt: r.createdAt || new Date().toISOString(),
        });
        return;
      }
    } catch (err: any) {
      console.error('[Albums API] MySQL fetch failed:', err);
      res.status(500).json({ error: 'Album could not be loaded from MySQL.' });
      return;
    }

    res.status(404).json({ error: 'Album not found' });
    return;
  }

  res.setHeader('X-Lumen-Storage', 'demo');
  const mem = getMemoryStore();
  const alb = mem.albums.find((a) => a.id === albumId);
  if (alb) {
    res.json(alb);
  } else {
    res.status(404).json({ error: 'Album not found' });
  }
});

// POST /api/albums
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { title, description, coverImageId, coverUrl, photoIds, id } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'Album title cannot be empty' });
    return;
  }
  const authenticatedUser = req.authUser;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to create an album.' });
    return;
  }
  if (authenticatedUser.role !== 'OWNER') {
    res.status(403).json({ error: 'Only the album owner can create albums.' });
    return;
  }

  const albumId = id || `alb-${Date.now()}`;
  const cleanPhotoIds: string[] = Array.isArray(photoIds) ? photoIds : [];
  const cleanCoverImageId = coverImageId || (cleanPhotoIds.length > 0 ? cleanPhotoIds[0] : null);
  const cleanCoverUrl = coverUrl || null;

  const newAlbum = {
    id: albumId,
    userId: authenticatedUser.id,
    title: title.trim(),
    description: description ? description.trim() : '',
    coverImageId: cleanCoverImageId,
    coverUrl: cleanCoverUrl,
    photoIds: cleanPhotoIds,
    createdAt: new Date().toISOString(),
  };

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Album');
    return;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureUserRecord(connection, newAlbum.userId, authenticatedUser);
    await connection.query(
        'INSERT INTO albums (id, user_id, title, description, cover_image_id, cover_url) VALUES (?, ?, ?, ?, ?, ?)',
        [
          newAlbum.id,
          newAlbum.userId,
          newAlbum.title,
          newAlbum.description,
          newAlbum.coverImageId,
          newAlbum.coverUrl,
        ]
      );

      for (let i = 0; i < cleanPhotoIds.length; i++) {
        await connection.query(
          'INSERT IGNORE INTO album_photos (album_id, photo_id, position) VALUES (?, ?, ?)',
          [newAlbum.id, cleanPhotoIds[i], i]
        );
      }
    await connection.commit();
  } catch (err: any) {
    await connection.rollback();
    respondDatabaseWriteError(res, 'Albums API', 'Album', err);
    return;
  } finally {
    connection.release();
  }

  res.status(201).json(newAlbum);
});

// PUT /api/albums/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const albumId = req.params.id;
  const updates = req.body;
  const authenticatedUser = req.authUser;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to update an album.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Album');
    return;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing]: any = await connection.query(
      'SELECT id, user_id AS userId FROM albums WHERE id = ? FOR UPDATE',
      [albumId]
    );
    if (!existing.length) {
      await connection.rollback();
      res.status(404).json({ error: 'Album not found' });
      return;
    }
    if (existing[0].userId !== authenticatedUser.id) {
      await connection.rollback();
      res.status(404).json({ error: 'Album not found' });
      return;
    }
    if (authenticatedUser.role !== 'OWNER') {
      await connection.rollback();
      res.status(403).json({ error: 'Only the album owner can update this album.' });
      return;
    }

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.title !== undefined) {
        fields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.coverImageId !== undefined) {
        fields.push('cover_image_id = ?');
        values.push(updates.coverImageId);
      }
      if (updates.coverUrl !== undefined) {
        fields.push('cover_url = ?');
        values.push(updates.coverUrl);
      }

      if (fields.length > 0) {
        values.push(albumId);
        await connection.query(`UPDATE albums SET ${fields.join(', ')} WHERE id = ?`, values);
      }

      if (Array.isArray(updates.photoIds)) {
        await connection.query('DELETE FROM album_photos WHERE album_id = ?', [albumId]);
        for (let i = 0; i < updates.photoIds.length; i++) {
          await connection.query(
            'INSERT IGNORE INTO album_photos (album_id, photo_id, position) VALUES (?, ?, ?)',
            [albumId, updates.photoIds[i], i]
          );
        }
      }
    await connection.commit();
  } catch (err: any) {
    await connection.rollback();
    respondDatabaseWriteError(res, 'Albums API', 'Album', err);
    return;
  } finally {
    connection.release();
  }

  res.json({ id: albumId, ...updates });
});

// POST /api/albums/:id/photos
router.post('/:id/photos', async (req: Request, res: Response): Promise<void> => {
  const albumId = req.params.id;
  const authenticatedUser = req.authUser;
  const requestedUserId = req.body?.userId;
  const requestedPhotoIds = req.body?.photoIds;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to update this album.' });
    return;
  }
  if (typeof requestedUserId !== 'string' || !requestedUserId.trim()) {
    res.status(400).json({ error: 'A studio user ID is required to update this album.' });
    return;
  }
  const userId = authenticatedUser.id;
  if (!Array.isArray(requestedPhotoIds) || requestedPhotoIds.length === 0 ||
      requestedPhotoIds.some((photoId: unknown) => typeof photoId !== 'string' || !photoId.trim())) {
    res.status(400).json({ error: 'Select one or more valid photographs to add.' });
    return;
  }

  const photoIds = [...new Set(requestedPhotoIds as string[])];
  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Album photos');
    return;
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [albumRows]: any = await connection.query(
      'SELECT id, user_id AS userId FROM albums WHERE id = ? FOR UPDATE',
      [albumId]
    );
    if (!albumRows.length) {
      await connection.rollback();
      res.status(404).json({ error: 'Album not found.' });
      return;
    }
    if (albumRows[0].userId !== userId) {
      await connection.rollback();
      res.status(403).json({ error: 'You do not own this album.' });
      return;
    }

    const [userRows]: any = await connection.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (!userRows.length || userRows[0].role !== 'OWNER') {
      await connection.rollback();
      res.status(403).json({ error: 'Only the album owner can add photographs.' });
      return;
    }

    const placeholders = photoIds.map(() => '?').join(', ');
    const [photoRows]: any = await connection.query(
      `SELECT id FROM photos WHERE id IN (${placeholders})`,
      photoIds
    );
    const foundPhotoIds = new Set(photoRows.map((photo: { id: string }) => photo.id));
    const missingPhotoIds = photoIds.filter((photoId) => !foundPhotoIds.has(photoId));
    if (missingPhotoIds.length > 0) {
      await connection.rollback();
      res.status(404).json({
        error: 'One or more selected photographs are not saved in the Photo Library.',
        photoIds: missingPhotoIds,
      });
      return;
    }

    const [existingLinks]: any = await connection.query(
      'SELECT photo_id AS photoId, position FROM album_photos WHERE album_id = ? ORDER BY position ASC FOR UPDATE',
      [albumId]
    );
    const existingPhotoIds = new Set(existingLinks.map((link: { photoId: string }) => link.photoId));
    let position = existingLinks.reduce(
      (maximum: number, link: { position: number | null }) => Math.max(maximum, Number(link.position ?? -1)),
      -1
    ) + 1;
    for (const photoId of photoIds) {
      if (existingPhotoIds.has(photoId)) continue;
      await connection.query(
        'INSERT INTO album_photos (album_id, photo_id, position) VALUES (?, ?, ?)',
        [albumId, photoId, position++]
      );
    }

    await connection.commit();
    res.json({
      success: true,
      photoIds: [...existingLinks.map((link: { photoId: string }) => link.photoId), ...photoIds.filter((photoId) => !existingPhotoIds.has(photoId))],
    });
  } catch (err: any) {
    await connection.rollback();
    respondDatabaseWriteError(res, 'Albums API', 'Album photo links', err);
  } finally {
    connection.release();
  }
});

// DELETE /api/albums/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const albumId = req.params.id;
  const authenticatedUser = req.authUser;
  const requestedUserId = req.body?.userId;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to delete an album.' });
    return;
  }
  if (typeof requestedUserId !== 'string' || !requestedUserId.trim()) {
    res.status(400).json({ error: 'A studio user ID is required to delete this album.' });
    return;
  }
  const userId = authenticatedUser.id;

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Album');
    return;
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [albumRows]: any = await connection.query(
      'SELECT id, user_id AS userId FROM albums WHERE id = ? FOR UPDATE',
      [albumId]
    );
    if (!albumRows.length) {
      await connection.rollback();
      res.status(404).json({ error: 'Album not found.' });
      return;
    }
    if (albumRows[0].userId !== userId) {
      await connection.rollback();
      res.status(403).json({ error: 'You do not own this album.' });
      return;
    }

    const [userRows]: any = await connection.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (!userRows.length || userRows[0].role !== 'OWNER') {
      await connection.rollback();
      res.status(403).json({ error: 'Only the album owner can delete this album.' });
      return;
    }

    await connection.query('DELETE FROM album_photos WHERE album_id = ?', [albumId]);
    await connection.query('DELETE FROM albums WHERE id = ?', [albumId]);
    await connection.commit();
  } catch (err: any) {
    await connection.rollback();
    console.error('[Albums API] MySQL album deletion failed:', err);
    res.status(500).json({ error: 'Album could not be deleted from MySQL.' });
    return;
  } finally {
    connection.release();
  }

  res.json({ success: true, id: albumId });
});

export default router;
