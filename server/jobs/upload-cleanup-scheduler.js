const defaultIntervalMs = 15 * 60 * 1000;

/**
 * Periodically deletes expired, never-attached image uploads from object storage.
 * Returns the timer, or null when storage is not configured (nothing to clean).
 */
function startUploadCleanup({
  isStorageConfigured = () => require('../services/object-storage').getConfigurationStatus().configured,
  cleanupExpired = (limit) => require('../models/image-upload.model').cleanupExpired(limit),
  intervalMs = defaultIntervalMs,
  logger = console,
} = {}) {
  if (!isStorageConfigured()) return null;

  let running = false;
  const runOnce = async () => {
    if (running) return;
    running = true;
    try {
      const cleaned = await cleanupExpired(100);
      if (cleaned > 0) logger.log(`[Uploads] Cleaned ${cleaned} expired image upload(s)`);
    } catch (error) {
      logger.error('[Uploads] Expired upload cleanup failed', { message: error?.message });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(runOnce, intervalMs);
  timer.unref();
  return timer;
}

module.exports = { startUploadCleanup, defaultIntervalMs };
