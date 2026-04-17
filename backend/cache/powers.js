const POWERS = [
  { id: 'cuartiles', name: 'cuartiles', cost: 3, description: 'Revela en qué cuartil está el objetivo. Si adivinás en el cuartil correcto, obtenés puntuación especial.' },
  { id: 'veneno',    name: 'veneno',    cost: 3, description: 'El jugador objetivo pierde 3 puntos. Si vos fallás, tu penalización se duplica.' },
  { id: 'escudo',    name: 'escudo',    cost: 2, description: 'Si fallás, no recibís penalización.' },
  { id: 'bloqueo',   name: 'bloqueo',   cost: 3, description: 'El jugador objetivo no puede adivinar esta ronda. Si vos fallás, tu penalización es x1.5.' },
  { id: 'switch',    name: 'switch',    cost: 3, description: 'Intercambia tu posición con la de otro jugador antes de revelar.' },
];

module.exports = POWERS;
