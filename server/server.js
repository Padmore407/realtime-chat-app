require('dotenv').config({ quiet: true });
const http = require('http');
const mongoose = require('mongoose');
const createApp = require('./app');
const connectDB = require('./config/db');
const initSocket = require('./socket');

const PORT = process.env.PORT || 5000;
const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

for (const key of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable ${key}. See .env.example.`);
    process.exit(1);
  }
}

async function start() {
  await connectDB(process.env.MONGO_URI);

  const app = createApp({ clientOrigins });
  const server = http.createServer(app);
  const io = initSocket(server, { clientOrigins });
  app.set('io', io); // lets REST controllers push real-time events

  server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    io.close();
    server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
