const process = require('node:process');
require('dotenv').config();
const app = require('./server');
const { initializeDatabase } = require('./config/db');
const objectStorage = require('./services/object-storage');

const PORT = process.env.PORT || 3001;

async function startServer() {
  await initializeDatabase();
  const uploadConfig = objectStorage.getConfigurationStatus();
  if (!uploadConfig.configured) {
    const details = uploadConfig.missingSettings.length
      ? `missing ${uploadConfig.missingSettings.join(', ')}`
      : uploadConfig.error;
    console.warn(`[Storage] Image uploads are unavailable: ${details}`);
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
});
//read always