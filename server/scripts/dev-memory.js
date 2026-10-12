// Runs the server against a throwaway in-memory MongoDB, so the app can be
// tried without installing MongoDB or creating an Atlas cluster.
// Data is lost when the process stops. Not for production.
require('dotenv').config({ quiet: true });
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  // Generous timeout: the first launch on Windows can be slow (antivirus scans the binary).
  const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  process.env.MONGO_URI = mongo.getUri('chat-app');
  process.env.JWT_SECRET ||= 'dev-only-secret-do-not-use-in-production';
  console.log('Using in-memory MongoDB (data resets on restart)');
  require('../server');
})().catch((err) => {
  console.error('Could not start in-memory MongoDB:', err.message);
  process.exit(1);
});
