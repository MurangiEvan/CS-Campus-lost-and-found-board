const http = require('http');
const { exec } = require('child_process');

// Simple smoke checks for the running API
async function check(url, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode === expectedStatus) return resolve(true);
      reject(new Error(`Unexpected status ${res.statusCode} from ${url}`));
    }).on('error', reject);
  });
}

(async () => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  try {
    console.log('Checking /health...');
    await check(`${base}/health`);
    console.log('Checking /ready...');
    await check(`${base}/ready`);
    console.log('Smoke checks passed');
    process.exit(0);
  } catch (err) {
    console.error('Smoke check failed:', err.message);
    process.exit(2);
  }
})();
