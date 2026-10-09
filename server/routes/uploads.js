'use strict';

const express = require('express');
const multer = require('multer');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB per file

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 4 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      const err = new Error('Unsupported image type. Allowed: PNG, JPEG, WebP, GIF.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.post('/', uploadLimiter, upload.array('images', 4), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'No images uploaded.' });

  const images = files.map((f) => {
    // Validate magic numbers for common formats
    const b = f.buffer;
    const isPng = b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const isJpg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const isWebp = b.length > 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP';
    const isGif = b.length > 6 && b.slice(0, 3).toString('ascii') === 'GIF';

    if (!(isPng || isJpg || isWebp || isGif)) {
      const err = new Error('File is not a valid image.');
      err.status = 400;
      throw err;
    }

    return {
      name: f.originalname,
      mime: f.mimetype,
      base64: b.toString('base64'),
      size: f.size,
    };
  });

  res.json({ images });
});

module.exports = router;
