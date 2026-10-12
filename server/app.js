const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const { UPLOAD_DIR } = require('./middleware/upload');
const { notFound, errorHandler } = require('./middleware/error');

const INLINE_FILE = /\.(png|jpe?g|gif|webp|pdf)$/i;

function createApp({ clientOrigins }) {
  const app = express();

  app.set('trust proxy', 1); // Render/Railway sit behind a proxy; needed for rate limiting
  // The frontend is on another origin (Vercel), so uploaded images must be embeddable cross-origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: clientOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use(
    '/uploads',
    express.static(UPLOAD_DIR, {
      maxAge: '7d',
      setHeaders: (res, filePath) => {
        // Anything that isn't an image or PDF is downloaded, never rendered.
        if (!INLINE_FILE.test(filePath)) res.setHeader('Content-Disposition', 'attachment');
      },
    })
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
