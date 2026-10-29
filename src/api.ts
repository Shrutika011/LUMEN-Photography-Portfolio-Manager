/**
 * LUMEN Photography Suite — MySQL and Express API client
 */

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'EDITOR' | 'CLIENT' | 'VIEWER';
  title?: string;
  avatar?: string;
  studioRoleLabel?: string;
  bio?: string;
  createdAt?: string;
}

export interface PhotoRecord {
  id: string;
  title: string;
  url: string;
  camera: string;
  lens: string;
  aperture: string;
  shutter: string;
  iso: string;
  dimensions: string;
  fileSize: number;
  categoryId: string;
  categoryName: string;
  shoot: string;
  shootLabel: string;
  score: number;
  isFavorite: boolean;
  inActivePortfolio: boolean;
  plateNumber?: number | null;
  isCoverHero?: boolean;
  clientStatus: string;
  clientNotes: string[];
  tags: string[];
  description?: string;
  datePhotographed?: string;
  createdAt: string;
  userId?: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  isCustom: boolean;
  userId?: string;
  createdAt?: string;
}

export interface AlbumRecord {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  coverImageId?: string | null;
  coverUrl?: string | null;
  photoIds: string[];
  createdAt: string;
  isDemo?: boolean;
  persistenceStatus?: 'demo' | 'local-draft';
}

export interface PortfolioBriefRecord {
  id: string;
  userId?: string;
  title: string;
  purpose: string;
  targetAudience: string;
  targetCount: number;
  curationStrategy: string;
  candidatePoolCount: number;
  selectedAlbumId?: string | null;
  portfolioData?: {
    photos: PhotoRecord[];
  } | null;
  isPublished?: boolean;
  publishedAt?: string | null;
  updatedAt: string;
}

export interface HealthCheckResult {
  isConnected: boolean;
  status: string;
  engine: string;
  database: string;
  host: string;
  port: number;
  tableCount: number;
  tables: string[];
  photoCount: number | null;
  categoryCount: number | null;
  albumCount: number | null;
  userCount: number | null;
  storageActive: boolean;
  uploadDir: string;
  storageDurable?: boolean;
  timestamp: string;
  error: string | null;
}

function isPortfolioBriefRecord(value: unknown): value is PortfolioBriefRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'title' in value &&
    typeof value.title === 'string'
  );
}

function isPortfolioBriefList(value: unknown): value is PortfolioBriefRecord[] {
  return Array.isArray(value) && value.every(isPortfolioBriefRecord);
}

const API_BASE = '/api';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function testConnection(): Promise<boolean> {
  try {
    const data = await fetchJson<HealthCheckResult>(`${API_BASE}/health`);
    return data?.isConnected === true;
  } catch (e) {
    console.warn('[LUMEN API] Health check probe notice:', e);
    return false;
  }
}

export const ApiBackend = {
  // --- HEALTH & DATABASE STATUS ---
  async checkHealth(): Promise<HealthCheckResult> {
    try {
      return await fetchJson<HealthCheckResult>(`${API_BASE}/health`);
    } catch (e: any) {
      return {
        isConnected: false,
        status: 'disconnected',
        engine: 'MySQL Server (Offline)',
        database: 'unavailable',
        host: 'not exposed',
        port: 0,
        tableCount: 0,
        tables: [],
        photoCount: null,
        categoryCount: null,
        albumCount: null,
        userCount: null,
        storageActive: false,
        uploadDir: 'local filesystem',
        storageDurable: false,
        timestamp: new Date().toISOString(),
        error: e.message || 'Server connection failed',
      };
    }
  },

  // --- USERS & AUTH ---
  async login(
    email: string,
    password: string,
    rememberMe: boolean,
    requiredRole?: 'CLIENT'
  ): Promise<UserProfile> {
    const response = await fetchJson<{ success: boolean; user: UserProfile }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe, requiredRole }),
    });
    if (!response.success || !response.user?.id) {
      throw new Error('The MySQL authentication service returned an invalid sign-in response.');
    }
    return response.user;
  },

  async getSession(): Promise<UserProfile | null> {
    const response = await fetch(`${API_BASE}/auth/session`, { credentials: 'same-origin' });
    if (response.status === 401) return null;
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorBody.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as { user?: UserProfile };
    if (!data.user?.id) {
      throw new Error('The MySQL authentication service returned an invalid session response.');
    }
    return data.user;
  },

  async logout(): Promise<void> {
    await fetchJson<{ success: boolean }>(`${API_BASE}/auth/logout`, { method: 'POST' });
  },

  async getUser(userId: string): Promise<UserProfile | null> {
    try {
      return await fetchJson<UserProfile>(`${API_BASE}/users/${encodeURIComponent(userId)}`);
    } catch (e) {
      console.warn(`[LUMEN API] Failed to fetch user ${userId}:`, e);
      return null;
    }
  },

  async saveUser(user: UserProfile): Promise<boolean> {
    try {
      await fetchJson<UserProfile>(`${API_BASE}/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        body: JSON.stringify(user),
      });
      return true;
    } catch (e) {
      console.warn(`[LUMEN API] Failed to save user ${user.id}:`, e);
      return false;
    }
  },

  // --- CATEGORIES ---
  async getCategories(): Promise<CategoryRecord[]> {
    return fetchJson<CategoryRecord[]>(`${API_BASE}/categories`);
  },

  async createCategory(category: CategoryRecord, user?: UserProfile): Promise<CategoryRecord> {
    return fetchJson<CategoryRecord>(`${API_BASE}/categories`, {
      method: 'POST',
      body: JSON.stringify({ ...category, user }),
    });
  },

  // --- PHOTOS ---
  async getPhotos(filters?: { category?: string; album?: string; favorite?: boolean }): Promise<PhotoRecord[]> {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.album) params.append('album', filters.album);
    if (filters?.favorite) params.append('favorite', 'true');

    const url = `${API_BASE}/photos${params.toString() ? `?${params.toString()}` : ''}`;
    return fetchJson<PhotoRecord[]>(url);
  },

  async upsertPhoto(photo: PhotoRecord, user?: UserProfile): Promise<boolean> {
    await fetchJson<PhotoRecord>(`${API_BASE}/photos`, {
      method: 'POST',
      body: JSON.stringify({ ...photo, user }),
    });
    return true;
  },

  async updatePhoto(photoId: string, updates: Partial<PhotoRecord>): Promise<boolean> {
    await fetchJson<PhotoRecord>(`${API_BASE}/photos/${encodeURIComponent(photoId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return true;
  },

  async deletePhoto(photoId: string): Promise<boolean> {
    await fetchJson<{ success: boolean }>(`${API_BASE}/photos/${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
    });
    return true;
  },

  async addClientNote(photoId: string, note: string, authorName?: string, userId?: string): Promise<boolean> {
    await fetchJson<{ success: boolean }>(`${API_BASE}/photos/${encodeURIComponent(photoId)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note, authorName, userId }),
    });
    return true;
  },

  // --- ALBUMS ---
  async getAlbums(): Promise<AlbumRecord[]> {
    return fetchJson<AlbumRecord[]>(`${API_BASE}/albums`);
  },

  async getAlbum(albumId: string): Promise<AlbumRecord> {
    return fetchJson<AlbumRecord>(`${API_BASE}/albums/${encodeURIComponent(albumId)}`);
  },

  async createAlbum(album: AlbumRecord, user?: UserProfile): Promise<AlbumRecord> {
    return fetchJson<AlbumRecord>(`${API_BASE}/albums`, {
      method: 'POST',
      body: JSON.stringify({ ...album, user }),
    });
  },

  async addPhotosToAlbum(albumId: string, photoIds: string[], userId: string): Promise<{ success: boolean; photoIds: string[] }> {
    return fetchJson<{ success: boolean; photoIds: string[] }>(`${API_BASE}/albums/${encodeURIComponent(albumId)}/photos`, {
      method: 'POST',
      body: JSON.stringify({ photoIds, userId }),
    });
  },

  async updateAlbum(albumId: string, updates: Partial<AlbumRecord>): Promise<boolean> {
    await fetchJson<AlbumRecord>(`${API_BASE}/albums/${encodeURIComponent(albumId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return true;
  },

  async deleteAlbum(albumId: string, userId: string): Promise<boolean> {
    await fetchJson<{ success: boolean }>(`${API_BASE}/albums/${encodeURIComponent(albumId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    });
    return true;
  },

  // --- PORTFOLIO BRIEFS ---
  async getBrief(userId?: string): Promise<PortfolioBriefRecord | null> {
    const brief = await fetchJson<PortfolioBriefRecord | null>(`${API_BASE}/briefs/${encodeURIComponent(userId || '')}`);
    return brief && brief.title ? brief : null;
  },

  async getSavedBriefs(userId: string): Promise<PortfolioBriefRecord[]> {
    const query = new URLSearchParams({ userId });
    const data = await fetchJson<unknown>(`${API_BASE}/briefs/saved?${query}`);
    const portfolios =
      isPortfolioBriefList(data)
        ? data
        : typeof data === 'object' &&
            data !== null &&
            'portfolios' in data &&
            isPortfolioBriefList(data.portfolios)
          ? data.portfolios
          : null;

    if (!portfolios) {
      throw new Error('Saved portfolio briefs response must contain a list.');
    }

    return portfolios;
  },

  async saveBrief(brief: PortfolioBriefRecord, user?: UserProfile): Promise<boolean> {
    await fetchJson<PortfolioBriefRecord>(`${API_BASE}/briefs`, {
      method: 'POST',
      body: JSON.stringify({ ...brief, user }),
    });
    return true;
  },

  async updateBrief(brief: PortfolioBriefRecord, userId: string): Promise<PortfolioBriefRecord> {
    return fetchJson<PortfolioBriefRecord>(`${API_BASE}/briefs/${encodeURIComponent(brief.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...brief, userId }),
    });
  },

  async deleteBrief(briefId: string, userId: string): Promise<boolean> {
    await fetchJson<{ success: boolean }>(`${API_BASE}/briefs/${encodeURIComponent(briefId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    });
    return true;
  },

  async publishPortfolio(briefId: string): Promise<boolean> {
    await fetchJson<{ success: boolean }>(`${API_BASE}/briefs/${encodeURIComponent(briefId)}/publish`, {
      method: 'POST',
    });
    return true;
  },
};

/**
 * High-performance, real multipart file upload to Express disk storage
 * Saves image to /uploads/ directory and returns the static URL, avoiding large base64 in MySQL
 */
export async function optimizeImageFile(
  file: File
): Promise<{ url: string; dimensions: string; fileSize: number; error: null }> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) {
    throw new Error(data.error || `Image upload failed with HTTP ${res.status}.`);
  }
  if (typeof data.url !== 'string' || !data.url.startsWith('/uploads/')) {
    throw new Error('The server did not return a valid stored image URL.');
  }
  return {
    url: data.url,
    dimensions: data.dimensions || '6000 × 4000',
    fileSize: data.fileSize || file.size,
    error: null,
  };
}
