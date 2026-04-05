INSERT IGNORE INTO powers (id, name, cost, description) VALUES
  (1, 'cuartiles', 3, 'Revela en qué cuartil está el target. Scoring especial de inversión.'),
  (2, 'veneno',    3, 'Quita 3pts a un rival. Si fallás, tu penalidad se duplica.'),
  (3, 'escudo',    2, 'Si fallás esta ronda, no perdés puntos.'),
  (4, 'bloqueo',   3, 'Un rival no puede adivinar esta ronda. Si vos fallás, tu penalidad es ×1.5.'),
  (5, 'switch',    3, 'Intercambia tu guess con el de otro jugador (antes del reveal).');
