import mysql from 'mysql2/promise';
import { config } from './config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool: mysql.Pool | null = null;
let isPoolAttempted = false;
const tableColumns = new Map<string, Set<string>>();

export type DatabaseTable =
  | 'albums'
  | 'album_photos'
  | 'categories'
  | 'client_notes'
  | 'photo_client_notes'
  | 'photo_tags'
  | 'photos'
  | 'portfolio_briefs'
  | 'tags'
  | 'users';

export type DatabaseExecutor = mysql.Pool | mysql.PoolConnection;

export interface UserRecordInput {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  title?: string;
  avatar?: string;
  studioRoleLabel?: string;
  bio?: string;
}

export async function getTableColumns(table: DatabaseTable): Promise<Set<string>> {
  const cached = tableColumns.get(table);
  if (cached) return cached;

  const [rows]: any = await getPool().query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table]
  );
  const columns = new Set<string>(rows.map((row: any) => row.COLUMN_NAME));
  tableColumns.set(table, columns);
  return columns;
}

export async function ensureUserRecord(
  executor: DatabaseExecutor,
  userId: string | null | undefined,
  input: UserRecordInput = {}
): Promise<void> {
  if (!userId) return;

  const seededUser = getMemoryStore().users.find((user) => user.id === userId);
  const roles = ['OWNER', 'EDITOR', 'CLIENT', 'VIEWER'];
  const requestedRole = (input.role || seededUser?.role || 'OWNER').toUpperCase();
  const user = {
    id: userId,
    name: input.name || seededUser?.name || 'Studio Member',
    email: input.email || seededUser?.email || `${userId}@lumen.studio`,
    role: roles.includes(requestedRole) ? requestedRole : 'OWNER',
    title: input.title || seededUser?.title || '',
    avatar: input.avatar || seededUser?.avatar || '',
    studioRoleLabel: input.studioRoleLabel || seededUser?.studioRoleLabel || '',
    bio: input.bio || seededUser?.bio || '',
  };

  await executor.query(
    `INSERT INTO users (id, name, email, role, title, avatar, studio_role_label, bio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), title = VALUES(title),
       avatar = VALUES(avatar), studio_role_label = VALUES(studio_role_label), bio = VALUES(bio)`,
    [
      user.id,
      user.name,
      user.email,
      user.role,
      user.title,
      user.avatar,
      user.studioRoleLabel,
      user.bio,
    ]
  );
}

export async function ensureCategoryRecord(
  executor: DatabaseExecutor,
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
  userId: string | null | undefined,
  isCustom = false
): Promise<void> {
  if (!categoryId || !categoryName) return;

  const columns = await getTableColumns('categories');
  const values: Record<string, unknown> = {
    id: categoryId,
    name: categoryName,
  };
  if (columns.has('is_custom')) values.is_custom = isCustom ? 1 : 0;
  if (columns.has('user_id')) values.user_id = userId || null;

  const names = Object.keys(values);
  const updates = names
    .filter((name) => name !== 'id')
    .map((name) => `${name} = VALUES(${name})`)
    .join(', ');

  await executor.query(
    `INSERT INTO categories (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${updates}`,
    names.map((name) => values[name])
  );
}

export function respondDatabaseUnavailable(
  res: import('express').Response,
  error: string | null,
  resource: string
): void {
  res.status(503).json({
    error: `${resource} was not saved because MySQL is unavailable.`,
    details: error,
  });
}

export function respondDatabaseWriteError(
  res: import('express').Response,
  context: string,
  resource: string,
  error: unknown
): void {
  console.error(`[${context}] MySQL write failed:`, error);

  const dbError = error as { code?: string };
  const conflict = dbError?.code === 'ER_NO_REFERENCED_ROW_2' || dbError?.code === 'ER_DUP_ENTRY';
  res.status(conflict ? 409 : 500).json({
    error: conflict
      ? `${resource} references a missing or conflicting MySQL record.`
      : `${resource} could not be saved to MySQL.`,
    code: dbError?.code || 'MYSQL_WRITE_FAILED',
  });
}

// In-memory fallback store initialized from seed data
interface MemoryStore {
  users: any[];
  categories: any[];
  photos: any[];
  tags: any[];
  photoTags: any[];
  albums: any[];
  albumPhotos: any[];
  clientNotes: any[];
  briefs: any[];
}

let memoryStore: MemoryStore | null = null;

function loadSeedData(): MemoryStore {
  try {
    const candidatePaths = [
      path.resolve(__dirname, 'seedData.json'),
      path.resolve(process.cwd(), 'server/seedData.json'),
      path.resolve(process.cwd(), 'tmp/extracted_initial_data.json'),
    ];
    let data: any = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        data = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      }
    }
    if (data) {
      const users = [
        {
          id: 'usr-owner-01',
          name: 'Madhura Dhoke',
          email: 'madhura@lumen.studio',
          role: 'OWNER',
          title: 'Studio Founder & Master Photographer',
          avatar: '',
          studioRoleLabel: 'Studio Owner (Full Access)',
          bio: 'Leica Hall of Fame honoree, specializes in brutalist high-contrast fashion and chiaroscuro editorial spreads.',
        },
        {
          id: 'usr-editor-01',
          name: 'Rahul Verma',
          email: 'rahul@lumen.studio',
          role: 'EDITOR',
          title: 'Curatorial Associate & Senior Editor',
          avatar: '',
          studioRoleLabel: 'Curatorial Associate (Editor)',
          bio: 'Oversees monograph sequencing, RAW grading, and client selection drafts.',
        },
        {
          id: 'usr-client-01',
          name: 'Anita & Vikram',
          email: 'anita.vikram@sharmagroup.com',
          role: 'CLIENT',
          title: 'Wedding & Monograph Commissioners',
          avatar: '',
          studioRoleLabel: 'Private Client (Proofing Only)',
          bio: 'Private commissioners reviewing 60 plates from the Udaipur Palace Colonnade ceremony.',
        },
        {
          id: 'usr-viewer-01',
          name: 'Sarah Lin',
          email: 'sarah.lin@xyzmagazine.com',
          role: 'VIEWER',
          title: 'Guest Curator',
          avatar: '',
          studioRoleLabel: 'Guest Curator (Read Only)',
          bio: 'Invited review delegate for upcoming Biennial Photography Monograph.',
        },
      ];

      const photos = (data.photos || []).map((p: any) => ({
        ...p,
        userId: 'usr-owner-01',
        isFavorite: !!p.isFavorite,
        inActivePortfolio: !!p.inActivePortfolio,
        isCoverHero: !!p.isCoverHero,
        score: p.score || 9.0,
        clientStatus: p.clientStatus || 'UNREVIEWED',
        clientNotes: p.clientNotes || [],
        tags: p.tags || [],
        createdAt: new Date().toISOString(),
      }));

      const categories = (data.cats || []).map((c: any) => ({
        ...c,
        isCustom: !!c.isCustom,
        userId: 'usr-owner-01',
        createdAt: new Date().toISOString(),
      }));

      const albums = (data.albs || []).map((a: any) => ({
        ...a,
        userId: 'usr-owner-01',
        photoIds: a.photoIds || [],
        createdAt: new Date().toISOString(),
      }));

      const briefs = [
        {
          id: 'brief-usr-owner-01',
          userId: 'usr-owner-01',
          title: 'High-Contrast Monograph 2025',
          purpose: 'Editorial & Monograph Submission',
          targetAudience: 'Curators, Gallerists, High-Fashion Publishers',
          targetCount: 24,
          curationStrategy: 'visual_tempo',
          candidatePoolCount: 24,
          selectedAlbumId: 'alb-01',
          isPublished: true,
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'brief-default',
          userId: 'usr-owner-01',
          title: 'Studio Master Monograph',
          purpose: 'Curatorial Editorial Spread',
          targetAudience: 'Gallery Directors',
          targetCount: 20,
          curationStrategy: 'tonal_balance',
          candidatePoolCount: 24,
          selectedAlbumId: 'alb-02',
          isPublished: false,
          publishedAt: null,
          updatedAt: new Date().toISOString(),
        },
      ];

      return {
        users,
        categories,
        photos,
        tags: [],
        photoTags: [],
        albums,
        albumPhotos: [],
        clientNotes: [],
        briefs,
      };
    }
  } catch (e) {
    console.warn('[LUMEN DB] Notice loading seed backup:', e);
  }

  return {
    users: [],
    categories: [],
    photos: [],
    tags: [],
    photoTags: [],
    albums: [],
    albumPhotos: [],
    clientNotes: [],
    briefs: [],
  };
}

export function getMemoryStore(): MemoryStore {
  if (!memoryStore) {
    memoryStore = loadSeedData();
  }
  return memoryStore;
}

export function getPool(): mysql.Pool {
  if (!pool && !isPoolAttempted) {
    isPoolAttempted = true;
    try {
      pool = mysql.createPool(config.db);
    } catch (err: any) {
      console.warn('[LUMEN MySQL] Initial pool creation notice:', err.message);
    }
  }
  return pool!;
}

export async function checkDatabaseConnection(): Promise<{
  isConnected: boolean;
  database: string;
  host: string;
  port: number;
  tableCount?: number;
  tables?: string[];
  error: string | null;
}> {
  try {
    const p = getPool();
    if (!p) {
      return {
        isConnected: false,
        database: config.db.database,
        host: config.db.host,
        port: config.db.port,
        error: 'MySQL pool is not initialized',
      };
    }

    const [rows]: any = await p.query('SELECT 1 AS probe');
    if (rows && rows[0]?.probe === 1) {
      // Query table list in lumen_db
      const [tableRows]: any = await p.query(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
        [config.db.database]
      );
      const tables = tableRows.map((r: any) => r.TABLE_NAME || r.table_name);

      return {
        isConnected: true,
        database: config.db.database,
        host: config.db.host,
        port: config.db.port,
        tableCount: tables.length,
        tables,
        error: null,
      };
    }
    return {
      isConnected: false,
      database: config.db.database,
      host: config.db.host,
      port: config.db.port,
      error: 'Unexpected response from database probe',
    };
  } catch (err: any) {
    console.error('[LUMEN MySQL] Connection probe failed:', err?.code || 'MYSQL_CONNECTION_FAILED');
    return {
      isConnected: false,
      database: config.db.database,
      host: config.db.host,
      port: config.db.port,
      error: 'Unable to connect to MySQL. Check the server configuration and database availability.',
    };
  }
}
