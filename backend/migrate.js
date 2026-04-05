require('dotenv').config();
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}).then(c => c.execute('ALTER TABLE players ADD COLUMN IF NOT EXISTS is_spectator BOOLEAN NOT NULL DEFAULT FALSE'))
  .then(() => { console.log('done'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
