const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_BASE_DIR = path.join(__dirname, '..', 'uploads');
const PHOTO_UPLOAD_DIR = path.join(UPLOAD_BASE_DIR, 'profile-photos');

// Ensure destination directory exists safely
if (!fs.existsSync(PHOTO_UPLOAD_DIR)) {
  fs.mkdirSync(PHOTO_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PHOTO_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const ext = rawExt === '.jpeg' ? '.jpg' : rawExt;
    const safeExt = ['.jpg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const uniqueName = `student-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error('Unsupported image format. Allowed formats: JPEG, PNG, WebP.'),
      false
    );
  }

  const rawExt = path.extname(file.originalname).toLowerCase();
  const ext = rawExt === '.jpeg' ? '.jpg' : rawExt;
  if (!['.jpg', '.png', '.webp'].includes(ext)) {
    return cb(
      new Error('Unsupported file extension. Allowed extensions: .jpg, .jpeg, .png, .webp.'),
      false
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
    files: 1,
  },
  fileFilter,
});

/**
 * Validates actual binary signature (magic bytes) from the written file.
 * Returns true if JPEG, PNG, or WebP; false otherwise.
 */
const validateImageMagicBytes = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return false;
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) return false;

    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    // PNG: 89 50 4E 47
    const isPng =
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

    // WebP: starts with 'RIFF' (0x52, 0x49, 0x46, 0x46) and at bytes 8-11: 'WEBP' (0x57, 0x45, 0x42, 0x50)
    const isWebp =
      bytesRead >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;

    return isJpeg || isPng || isWebp;
  } catch (err) {
    return false;
  }
};

/**
 * Safely removes a photo file from disk if it resides within the PHOTO_UPLOAD_DIR.
 * Prevents directory traversal attacks.
 */
const deletePhotoFile = (photoUrl) => {
  if (!photoUrl || typeof photoUrl !== 'string') return;

  try {
    // Only delete files that are stored locally under /uploads/profile-photos/
    if (!photoUrl.startsWith('/uploads/profile-photos/')) return;

    const filename = path.basename(photoUrl);
    const targetPath = path.resolve(PHOTO_UPLOAD_DIR, filename);

    // Verify target path resides strictly inside PHOTO_UPLOAD_DIR
    if (!targetPath.startsWith(PHOTO_UPLOAD_DIR)) return;

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  } catch (err) {
    console.error('[deletePhotoFile Error]:', err.message);
  }
};

/**
 * Multer middleware wrapper with standardized JSON error responses
 */
const handlePhotoUpload = (req, res, next) => {
  const singleUpload = upload.single('photo');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds the 5 MB limit. Please select a smaller image.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Error occurred during file upload.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided. Please attach an image under the "photo" field.',
      });
    }

    // Verify magic bytes
    if (!validateImageMagicBytes(req.file.path)) {
      // Remove invalid/disguised file immediately
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Unsupported or corrupted image file. Actual file contents must be JPEG, PNG, or WebP.',
      });
    }

    next();
  });
};

module.exports = {
  PHOTO_UPLOAD_DIR,
  handlePhotoUpload,
  validateImageMagicBytes,
  deletePhotoFile,
};
