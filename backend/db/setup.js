/**
 * Run once to create the database and all tables.
 * Usage: DB_PASSWORD=mypassword node db/setup.js
 * Or: node db/setup.js  (if root has no password)
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function setup() {
  // Connect without specifying a database first
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  console.log('Connected to MySQL');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

  // Split and run each statement
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await conn.execute(stmt);
    process.stdout.write('.');
  }

  console.log('\nSchema applied ✓');
  await conn.end();

  // Now seed powers
  const pool = require('./index');
  await pool.execute(`
    INSERT IGNORE INTO powers (id, name, cost, description) VALUES
      (1, 'cuartiles', 3, 'Revela en qué cuartil está el target. Scoring especial de inversión.'),
      (2, 'veneno',    3, 'Quita 3pts a un rival. Si fallás, tu penalidad se duplica.'),
      (3, 'escudo',    2, 'Si fallás esta ronda, no perdés puntos.'),
      (4, 'bloqueo',   3, 'Un rival no puede adivinar esta ronda. Si vos fallás, tu penalidad es ×1.5.'),
      (5, 'switch',    3, 'Intercambia tu guess con el de otro jugador (antes del reveal).')
  `);
  console.log('Powers seeded ✓');
  process.exit(0);
}

setup().catch(err => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
