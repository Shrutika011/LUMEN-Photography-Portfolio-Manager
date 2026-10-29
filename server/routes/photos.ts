import { Router, Request, Response } from 'express';
import {
  checkDatabaseConnection,
  DatabaseExecutor,
  ensureCategoryRecord,
  ensureUserRecord,
  getMemoryStore,
  getPool,
  getTableColumns,
  respondDatabaseUnavailable,
  respondDatabaseWriteError,
  UserRecordInput,
} from '../db';

const router = Router();

// Helper to format a DB row into a clean PhotoRecord matching LUMEN frontend
function formatPhoto(row: any, tags: string[] = [], notes: string[] = []) {
  return {
    id: row.id,
    title: row.title,
    url: row.url || row.image_url || '',
    camera: row.camera || '',
    lens: row.lens || '',
    aperture: row.aperture || '',
    shutter: row.shutter || '',
    iso: row.iso || '',
    dimensions: row.dimensions || '6000 × 4000',
    fileSize: Number(row.file_size || row.fileSize || 0),
    categoryId: row.category_id || row.categoryId || 'cat-fashion',
    categoryName: row.category_name || row.categoryName || 'Fashion & Editorial',
    shoot: row.shoot || 'editorial',
    shootLabel: row.shoot_label || row.shootLabel || 'Studio Editorial',
    score: Number(row.score || 9.0),
    isFavorite: Boolean(row.is_favorite ?? row.isFavorite),
    inActivePortfolio: Boolean(row.in_active_portfolio ?? row.inActivePortfolio),
    plateNumber: row.plate_number !== null && row.plate_number !== undefined ? Number(row.plate_number) : (row.plateNumber ?? null),
    isCoverHero: Boolean(row.is_cover_hero ?? row.isCoverHero),
    clientStatus: row.client_status || row.clientStatus || 'UNREVIEWED',
    clientNotes: notes.length > 0 ? notes : (Array.isArray(row.clientNotes) ? row.clientNotes : []),
    tags: tags.length > 0 ? tags : (Array.isArray(row.tags) ? row.tags : []),
    description: row.description || '',
    datePhotographed: row.date_photographed || row.datePhotographed || '2024-10-14',
    userId: row.user_id || row.userId || 'usr-owner-01',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

async function getPhotoAggregates(): Promise<{ tags: string; notes: string }> {
  const photoTagColumns = await getTableColumns('photo_tags');
  const tagColumns = await getTableColumns('tags');
  const clientNoteColumns = await getTableColumns('client_notes');
  const photoClientNoteColumns = await getTableColumns('photo_client_notes');

  const tags = photoTagColumns.has('tag')
    ? `(SELECT GROUP_CONCAT(pt.tag SEPARATOR '|||') FROM photo_tags pt WHERE pt.photo_id = p.id)`
    : photoTagColumns.has('tag_id') && tagColumns.has('name')
      ? `(SELECT GROUP_CONCAT(t.name SEPARATOR '|||') FROM photo_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.photo_id = p.id)`
      : 'NULL';
  const notes = clientNoteColumns.has('note')
    ? `(SELECT GROUP_CONCAT(cn.note SEPARATOR '|||') FROM client_notes cn WHERE cn.photo_id = p.id)`
    : photoClientNoteColumns.has('note')
      ? `(SELECT GROUP_CONCAT(cn.note SEPARATOR '|||') FROM photo_client_notes cn WHERE cn.photo_id = p.id)`
      : 'NULL';

  return { tags, notes };
}

async function savePhotoRecord(
  executor: DatabaseExecutor,
  photo: any,
  user?: UserRecordInput
): Promise<ReturnType<typeof formatPhoto>> {
  const photoId = photo.id || `p-${Date.now()}`;
  const userId = photo.userId || user?.id || 'usr-owner-01';
  const categoryId = photo.categoryId || 'cat-fashion';
  const categoryName = photo.categoryName || 'Fashion & Editorial';

  await ensureUserRecord(executor, userId, user);
  await ensureCategoryRecord(executor, categoryId, categoryName, userId);

  const columns = await getTableColumns('photos');
  const urlColumn = columns.has('url') ? 'url' : columns.has('image_url') ? 'image_url' : null;
  if (!urlColumn) {
    throw new Error('The MySQL photos table has no url or image_url column.');
  }

  const photoRecord: Record<string, any> = {
    id: photoId,
    title: photo.title,
    [urlColumn]: photo.url,
    file_path: photo.filePath || null,
    camera: photo.camera || '',
    lens: photo.lens || '',
    aperture: photo.aperture || '',
    shutter: photo.shutter || '',
    iso: photo.iso || '',
    dimensions: photo.dimensions || '6000 × 4000',
    file_size: photo.fileSize || 0,
    category_id: categoryId,
    category_name: categoryName,
    shoot: photo.shoot || 'editorial',
    shoot_label: photo.shootLabel || 'Studio Editorial',
    score: photo.score !== undefined ? Number(photo.score) : 9.0,
    is_favorite: photo.isFavorite ? 1 : 0,
    in_active_portfolio: photo.inActivePortfolio ? 1 : 0,
    plate_number: photo.plateNumber !== undefined && photo.plateNumber !== null ? Number(photo.plateNumber) : null,
    is_cover_hero: photo.isCoverHero ? 1 : 0,
    client_status: photo.clientStatus || 'UNREVIEWED',
    description: photo.description || '',
    date_photographed: photo.datePhotographed || '2024-10-14',
    user_id: userId,
  };
  const values = Object.entries(photoRecord).filter(([column]) => columns.has(column));
  const requiredColumns = ['id', 'title', urlColumn];
  if (requiredColumns.some((column) => !columns.has(column))) {
    throw new Error('The MySQL photos table is missing a required column.');
  }
  const updates = values
    .map(([column]) => column)
    .filter((column) => column !== 'id')
    .map((column) => `${column} = VALUES(${column})`)
    .join(', ');

  await executor.query(
    `INSERT INTO photos (${values.map(([column]) => column).join(', ')})
     VALUES (${values.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${updates}`,
    values.map(([, value]) => value)
  );

  if (Array.isArray(photo.tags) && photo.tags.length > 0) {
    const tagLinks = await getTableColumns('photo_tags');
    if (tagLinks.has('tag')) {
      for (const tag of photo.tags) {
        if (typeof tag === 'string' && tag.trim()) {
          await executor.query('INSERT IGNORE INTO photo_tags (photo_id, tag) VALUES (?, ?)', [photoId, tag.trim()]);
        }
      }
    } else if (tagLinks.has('tag_id')) {
      for (const tag of photo.tags) {
        if (typeof tag === 'string' && tag.trim()) {
          await executor.query('INSERT IGNORE INTO tags (name) VALUES (?)', [tag.trim()]);
          await executor.query(
            'INSERT IGNORE INTO photo_tags (photo_id, tag_id) SELECT ?, id FROM tags WHERE name = ?',
            [photoId, tag.trim()]
          );
        }
      }
    } else {
      throw new Error('The MySQL schema cannot store photo tags.');
    }
  }

  if (Array.isArray(photo.clientNotes) && photo.clientNotes.length > 0) {
    const notesColumns = await getTableColumns('client_notes');
    const photoNotesColumns = await getTableColumns('photo_client_notes');
    for (const note of photo.clientNotes) {
      if (typeof note !== 'string' || !note.trim()) continue;
      if (notesColumns.has('note')) {
        await executor.query(
          'INSERT INTO client_notes (photo_id, user_id, author_name, note) VALUES (?, ?, ?, ?)',
          [photoId, userId, 'Studio Client', note.trim()]
        );
      } else if (photoNotesColumns.has('note')) {
        await executor.query(
          'INSERT INTO photo_client_notes (photo_id, note, position) VALUES (?, ?, ?)',
          [photoId, note.trim(), photo.clientNotes.indexOf(note)]
        );
      } else {
        throw new Error('The MySQL schema cannot store photo notes.');
      }
    }
  }

  return formatPhoto({ ...photoRecord, url: photo.url }, photo.tags || [], photo.clientNotes || []);
}

// GET /api/photos - Get all photos with optional filters
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { category, album, favorite, inPortfolio, clientStatus, search, userId } = req.query;
  const dbStatus = await checkDatabaseConnection();

  if (dbStatus.isConnected) {
    try {
      const pool = getPool();
      const aggregates = await getPhotoAggregates();
      let queryStr = `
        SELECT p.*, ${aggregates.tags} AS tag_names, ${aggregates.notes} AS note_texts
        FROM photos p
      `;
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (album) {
        queryStr += ` JOIN album_photos ap ON p.id = ap.photo_id WHERE ap.album_id = ? `;
        params.push(album);
      } else {
        queryStr += ` WHERE 1=1 `;
      }

      if (category && category !== 'all') {
        whereClauses.push(`p.category_id = ?`);
        params.push(category);
      }
      if (favorite === 'true') {
        whereClauses.push(`p.is_favorite = 1`);
      }
      if (inPortfolio === 'true') {
        whereClauses.push(`p.in_active_portfolio = 1`);
      }
      if (clientStatus) {
        whereClauses.push(`p.client_status = ?`);
        params.push(clientStatus);
      }
      if (search) {
        whereClauses.push(`(p.title LIKE ? OR p.camera LIKE ? OR p.lens LIKE ? OR p.category_name LIKE ?)`);
        const searchWild = `%${search}%`;
        params.push(searchWild, searchWild, searchWild, searchWild);
      }

      if (whereClauses.length > 0) {
        queryStr += ` AND ` + whereClauses.join(' AND ');
      }

      queryStr += ` ORDER BY p.in_active_portfolio DESC, p.plate_number ASC, p.created_at DESC`;

      const [rows]: any = await pool.query(queryStr, params);
      const photos = rows.map((r: any) => {
        const tags = r.tag_names ? r.tag_names.split('|||') : [];
        const notes = r.note_texts ? r.note_texts.split('|||') : [];
        return formatPhoto(r, tags, notes);
      });

      res.json(photos);
      return;
    } catch (err: any) {
      console.error('[Photos API] MySQL query failed:', err);
      res.status(500).json({ error: 'Photos could not be loaded from MySQL.' });
      return;
    }
  }

  res.setHeader('X-Lumen-Storage', 'demo');
  // Local Memory Fallback
  const mem = getMemoryStore();
  let photos = [...mem.photos];

  if (category && category !== 'all') {
    photos = photos.filter((p) => p.categoryId === category);
  }
  if (album) {
    const alb = mem.albums.find((a) => a.id === album);
    if (alb && Array.isArray(alb.photoIds)) {
      photos = photos.filter((p) => alb.photoIds.includes(p.id));
    }
  }
  if (favorite === 'true') {
    photos = photos.filter((p) => p.isFavorite);
  }
  if (inPortfolio === 'true') {
    photos = photos.filter((p) => p.inActivePortfolio);
  }
  if (clientStatus) {
    photos = photos.filter((p) => p.clientStatus === clientStatus);
  }
  if (search) {
    const q = (search as string).toLowerCase();
    photos = photos.filter(
      (p) =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.camera && p.camera.toLowerCase().includes(q)) ||
        (p.lens && p.lens.toLowerCase().includes(q)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(q)))
    );
  }

  res.json(photos);
});

// GET /api/photos/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const photoId = req.params.id;
  const dbStatus = await checkDatabaseConnection();

  if (dbStatus.isConnected) {
    try {
      const pool = getPool();
      const aggregates = await getPhotoAggregates();
      const [rows]: any = await pool.query(
        `SELECT p.*, ${aggregates.tags} AS tag_names, ${aggregates.notes} AS note_texts
         FROM photos p WHERE p.id = ?`,
        [photoId]
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        const tags = r.tag_names ? r.tag_names.split('|||') : [];
        const notes = r.note_texts ? r.note_texts.split('|||') : [];
        res.json(formatPhoto(r, tags, notes));
        return;
      }
    } catch (e: any) {
      console.error('[Photos API] MySQL fetch failed:', e);
      res.status(500).json({ error: 'Photo could not be loaded from MySQL.' });
      return;
    }

    res.status(404).json({ error: 'Photo not found' });
    return;
  }

  res.setHeader('X-Lumen-Storage', 'demo');
  const mem = getMemoryStore();
  const photo = mem.photos.find((p) => p.id === photoId);
  if (photo) {
    res.json(photo);
  } else {
    res.status(404).json({ error: 'Photo not found' });
  }
});

// POST /api/photos - Create or Upsert photo
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const p = req.body;
  if (!p || typeof p.title !== 'string' || !p.title.trim() || typeof p.url !== 'string' || !p.url.trim()) {
    res.status(400).json({ error: 'Photo title and image URL are required' });
    return;
  }
  const authenticatedUser = req.authUser;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to save a photo.' });
    return;
  }
  if (!['OWNER', 'EDITOR'].includes(authenticatedUser.role)) {
    res.status(403).json({ error: 'Your account cannot add photographs to the library.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Photo');
    return;
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const formatted = await savePhotoRecord(
      connection,
      { ...p, userId: authenticatedUser.id },
      authenticatedUser
    );
    await connection.commit();
    res.status(201).json(formatted);
  } catch (err: any) {
    await connection.rollback();
    respondDatabaseWriteError(res, 'Photos API', 'Photo', err);
  } finally {
    connection.release();
  }
});

// PUT /api/photos/:id - Update photo metadata / flags
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const photoId = req.params.id;
  const updates = req.body;
  const authenticatedUser = req.authUser;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to update a photo.' });
    return;
  }
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    res.status(400).json({ error: 'Photo updates must be a JSON object.' });
    return;
  }
  if (!['OWNER', 'EDITOR', 'CLIENT'].includes(authenticatedUser.role)) {
    res.status(403).json({ error: 'Your account cannot update photos.' });
    return;
  }
  if (
    authenticatedUser.role === 'CLIENT' &&
    Object.keys(updates).some((field) => !['clientStatus', 'clientNotes'].includes(field))
  ) {
    res.status(403).json({ error: 'Clients may only submit review status and notes.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Photo');
    return;
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [existing]: any = await connection.query('SELECT id FROM photos WHERE id = ?', [photoId]);
    if (!existing.length) {
      await connection.rollback();
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    if (updates.categoryId !== undefined || updates.categoryName !== undefined) {
      const [currentRows]: any = await connection.query(
        'SELECT category_id, category_name, user_id FROM photos WHERE id = ?',
        [photoId]
      );
      const current = currentRows[0];
      await ensureCategoryRecord(
        connection,
        updates.categoryId ?? current.category_id,
        updates.categoryName ?? current.category_name,
        current.user_id
      );
    }

    const columns = await getTableColumns('photos');
    const fields: string[] = [];
    const values: any[] = [];
    const mapField = (prop: string, col: string, transform?: (value: any) => any) => {
      const targetColumn = col === 'url' && !columns.has('url') && columns.has('image_url') ? 'image_url' : col;
      if (updates[prop] !== undefined && columns.has(targetColumn)) {
        fields.push(`${targetColumn} = ?`);
        values.push(transform ? transform(updates[prop]) : updates[prop]);
      }
    };

    mapField('title', 'title');
    mapField('url', 'url');
    mapField('camera', 'camera');
    mapField('lens', 'lens');
    mapField('aperture', 'aperture');
    mapField('shutter', 'shutter');
    mapField('iso', 'iso');
    mapField('dimensions', 'dimensions');
    mapField('fileSize', 'file_size');
    mapField('categoryId', 'category_id');
    mapField('categoryName', 'category_name');
    mapField('shoot', 'shoot');
    mapField('shootLabel', 'shoot_label');
    mapField('score', 'score', Number);
    mapField('isFavorite', 'is_favorite', (value) => (value ? 1 : 0));
    mapField('inActivePortfolio', 'in_active_portfolio', (value) => (value ? 1 : 0));
    mapField('plateNumber', 'plate_number', (value) => (value !== null && value !== undefined ? Number(value) : null));
    mapField('isCoverHero', 'is_cover_hero', (value) => (value ? 1 : 0));
    mapField('clientStatus', 'client_status');
    mapField('description', 'description');

    if (fields.length > 0) {
      values.push(photoId);
      await connection.query(`UPDATE photos SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (Array.isArray(updates.clientNotes)) {
      const noteColumns = await getTableColumns('client_notes');
      const photoNoteColumns = await getTableColumns('photo_client_notes');
      for (const note of updates.clientNotes) {
        if (typeof note !== 'string' || !note.trim()) continue;
        if (noteColumns.has('note')) {
          await connection.query(
            'INSERT INTO client_notes (photo_id, user_id, author_name, note) VALUES (?, ?, ?, ?)',
            [photoId, authenticatedUser.id, authenticatedUser.name, note.trim()]
          );
        } else if (photoNoteColumns.has('note')) {
          await connection.query(
            'INSERT INTO photo_client_notes (photo_id, note, position) VALUES (?, ?, ?)',
            [photoId, note.trim(), updates.clientNotes.indexOf(note)]
          );
        } else {
          throw new Error('The MySQL schema cannot store photo notes.');
        }
      }
    }

    await connection.commit();
    res.json({ id: photoId, ...updates });
  } catch (err: any) {
    await connection.rollback();
    respondDatabaseWriteError(res, 'Photos API', 'Photo', err);
  } finally {
    connection.release();
  }
});

// DELETE /api/photos/:id - Delete photo
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const photoId = req.params.id;
  if (!req.authUser) {
    res.status(401).json({ error: 'Sign in is required to delete a photo.' });
    return;
  }
  if (req.authUser.role !== 'OWNER') {
    res.status(403).json({ error: 'Only the studio owner can delete master RAWs.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Photo');
    return;
  }

  try {
    const pool = getPool();
    const [result]: any = await pool.query('DELETE FROM photos WHERE id = ?', [photoId]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }
  } catch (err: any) {
    respondDatabaseWriteError(res, 'Photos API', 'Photo', err);
    return;
  }

  res.json({ success: true, id: photoId });
});

// POST /api/photos/:id/notes - Add client proofing note
router.post('/:id/notes', async (req: Request, res: Response): Promise<void> => {
  const photoId = req.params.id;
  const { note } = req.body || {};
  const authenticatedUser = req.authUser;
  if (!authenticatedUser) {
    res.status(401).json({ error: 'Sign in is required to submit client feedback.' });
    return;
  }
  if (authenticatedUser.role !== 'CLIENT') {
    res.status(403).json({ error: 'Only authenticated client accounts can submit proofing notes.' });
    return;
  }

  if (!note || typeof note !== 'string' || !note.trim()) {
    res.status(400).json({ error: 'Note text cannot be empty' });
    return;
  }

  const cleanNote = note.trim();
  const cleanAuthor = authenticatedUser.name;
  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Client note');
    return;
  }

  const cleanUserId = authenticatedUser.id;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [photos]: any = await connection.query('SELECT id FROM photos WHERE id = ?', [photoId]);
    if (!photos.length) {
      await connection.rollback();
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const noteColumns = await getTableColumns('client_notes');
    const photoNoteColumns = await getTableColumns('photo_client_notes');
    if (noteColumns.has('note')) {
      await connection.query(
        'INSERT INTO client_notes (photo_id, user_id, author_name, note) VALUES (?, ?, ?, ?)',
        [photoId, cleanUserId, cleanAuthor, cleanNote]
      );
    } else if (photoNoteColumns.has('note')) {
      const [countRows]: any = await connection.query(
        'SELECT COUNT(*) AS count FROM photo_client_notes WHERE photo_id = ?',
        [photoId]
      );
      await connection.query(
        'INSERT INTO photo_client_notes (photo_id, note, position) VALUES (?, ?, ?)',
        [photoId, cleanNote, Number(countRows[0]?.count || 0)]
      );
    } else {
      throw new Error('The MySQL schema cannot store photo notes.');
    }

    await connection.commit();
  } catch (err: any) {
    await connection.rollback();
    respondDatabaseWriteError(res, 'Photos API', 'Client note', err);
    return;
  } finally {
    connection.release();
  }

  res.status(201).json({ success: true, photoId, note: cleanNote });
});

// POST /api/photos/seed - Batch seed
router.post('/seed', async (req: Request, res: Response): Promise<void> => {
  const { photos: photosList } = req.body;
  if (!Array.isArray(photosList)) {
    res.status(400).json({ error: 'Array of photos required' });
    return;
  }
  if (!req.authUser) {
    res.status(401).json({ error: 'Sign in is required to seed photos.' });
    return;
  }
  if (req.authUser.role !== 'OWNER') {
    res.status(403).json({ error: 'Only the studio owner can seed photos.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Photo batch');
    return;
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    for (const photo of photosList) {
      await savePhotoRecord(
        connection,
        { ...photo, userId: req.authUser.id },
        req.authUser
      );
    }
    await connection.commit();
  } catch (err: any) {
    await connection.rollback();
    respondDatabaseWriteError(res, 'Photos API', 'Photo batch', err);
    return;
  } finally {
    connection.release();
  }

  res.json({ success: true, count: photosList.length });
});

export default router;
