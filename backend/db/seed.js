const pool = require('./index');

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      INSERT IGNORE INTO powers (id, name, cost, description) VALUES
        (1, 'cuartiles', 3, 'Revela en qué cuartil está el target. Scoring especial: acertar al centro del cuartil es más redituable.'),
        (2, 'veneno',    3, 'Quita 3pts a un rival. Si fallás tu guess, tu penalidad se duplica.'),
        (3, 'escudo',    2, 'Si fallás tu guess esta ronda, no perdés puntos.'),
        (4, 'bloqueo',   3, 'Un rival no puede adivinar esta ronda. Si vos fallás, tu penalidad es ×1.5.'),
        (5, 'switch',    3, 'Intercambia tu guess con el de otro jugador (antes del reveal).')
    `);
    console.log('Powers seeded OK');
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
