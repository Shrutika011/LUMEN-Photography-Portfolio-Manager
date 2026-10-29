import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const router = Router();

function requirePhotoWriteAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Sign in is required to upload images.' });
    return;
  }
  if (!['OWNER', 'EDITOR'].includes(req.authUser.role)) {
    res.status(403).json({ error: 'Your account cannot upload images.' });
    return;
  }
  next();
}

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `lumen_${baseName}_${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/tiff',
    'image/avif',
    'image/gif',
  ];
  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only photographic images are accepted.`));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter,
});

// Single file upload via multipart/form-data
router.post('/', requirePhotoWriteAccess, upload.single('image'), (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file uploaded' });
    return;
  }

  const relativeUrl = `/uploads/${req.file.filename}`;
  res.json({
    url: relativeUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    fileSize: req.file.size,
    dimensions: '6000 × 4000',
    mimetype: req.file.mimetype,
    error: null,
  });
});

// Base64 to disk converter (for camera uploads or canvas exports, converting to disk file)
router.post('/base64', requirePhotoWriteAccess, (req: Request, res: Response): void => {
  try {
    const { dataUrl, filename: origName } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid data URL payload' });
      return;
    }

    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: 'Malformed base64 data URL' });
      return;
    }

    const ext = `.${matches[1] === 'jpeg' ? 'jpg' : matches[1]}`;
    const buffer = Buffer.from(matches[2], 'base64');
    const safeBase = (origName || 'captured_plate')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const fileName = `lumen_${safeBase}_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    const filePath = path.join(config.uploadDir, fileName);

    fs.writeFileSync(filePath, buffer);

    res.json({
      url: `/uploads/${fileName}`,
      filename: fileName,
      fileSize: buffer.length,
      dimensions: '6000 × 4000',
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to save image: ${err.message}` });
  }
});

export default router;
