const express = require('express');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { HttpError } = require('../utils/httpError');

const router = express.Router();

// Two-step file sharing: upload here, then send the returned attachment
// through the `send_message` socket event like any other message.
router.post('/', protect, upload.single('file'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded');
  res.status(201).json({
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

module.exports = router;
