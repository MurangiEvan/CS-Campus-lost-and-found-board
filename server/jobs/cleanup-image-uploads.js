require('dotenv').config();
const ImageUpload = require('../models/image-upload.model');
const db = require('../config/db');

async function main() {
  try {
    const count = await ImageUpload.cleanupExpired();
    console.log(`Expired image uploads cleaned: ${count}`);
    process.exitCode = 0;
  } catch {
    console.error('Expired image upload cleanup failed');
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

void main();