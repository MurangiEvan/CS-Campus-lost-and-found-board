const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://username:password@localhost:5432/lost_and_found',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function runSqlScript(sql) {
  await pool.query(sql);
}

async function initializeDatabase() {
  const rootDir = path.join(__dirname, '..');
  const scriptPaths = [path.join(rootDir, 'schema.sql')];
  const migrationDir = path.join(rootDir, 'migrations');

  if (fs.existsSync(migrationDir)) {
    const migrationFiles = fs.readdirSync(migrationDir)
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort();

    for (const fileName of migrationFiles) {
      scriptPaths.push(path.join(migrationDir, fileName));
    }
  }

  for (const scriptPath of scriptPaths) {
    if (!fs.existsSync(scriptPath)) continue;
    const sql = fs.readFileSync(scriptPath, 'utf8');
    await runSqlScript(sql);
  }

  return true;
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initializeDatabase,
  runSqlScript,
};
