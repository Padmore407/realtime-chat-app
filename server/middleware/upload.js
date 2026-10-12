const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { HttpError } = require('../utils/httpError');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Whitelist by MIME type AND extension. SVG and HTML are deliberately excluded
// because browsers can execute scripts inside them.
const ALLOWED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
};

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // Random names: never trust the client's filename on disk.
  filename: (_req, file, cb) =>
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ALLOWED_TYPES[file.mimetype];
    if (allowedExts && allowedExts.includes(ext)) return cb(null, true);
    cb(new HttpError(400, 'Unsupported file type. Allowed: images, PDF, Office documents, TXT, ZIP'));
  },
});

module.exports = { upload, UPLOAD_DIR, MAX_FILE_SIZE };
