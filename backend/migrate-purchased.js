const pool = require('./db');

async function migrate() {
  try {
    await pool.execute(
      'ALTER TABLE round_powers ADD COLUMN IF NOT EXISTS purchased BOOLEAN NOT NULL DEFAULT FALSE'
    );
    console.log('OK: columna purchased agregada a round_powers');

    const [rows] = await pool.execute('DESCRIBE round_powers');
    const col = rows.find(r => r.Field === 'purchased');
    if (col) console.log('Verificado:', col);
  } catch (err) {
    console.error('Error en migración:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
