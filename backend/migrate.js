require('dotenv').config();
const mysql = require('mysql2/promise');
async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const migrations = [
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS is_spectator BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE games ADD COLUMN IF NOT EXISTS score_bullseye INT NOT NULL DEFAULT 4',
    'ALTER TABLE games ADD COLUMN IF NOT EXISTS score_close INT NOT NULL DEFAULT 3',
    'ALTER TABLE games ADD COLUMN IF NOT EXISTS score_near INT NOT NULL DEFAULT 2',
  ];
  for (const sql of migrations) {
    await c.execute(sql);
    console.log('✓', sql.slice(0, 60));
  }
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
