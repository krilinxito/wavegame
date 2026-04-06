// Scoring constants — all as fractions of the full dial range (0.0–1.0)
const ZONE_BULLSEYE = 0.02; // ±2% → +4 pts
const ZONE_CLOSE    = 0.05; // ±5% → +3 pts
const ZONE_NEAR     = 0.10; // ±10% → +2 pts
const CENTER        = 0.50; // midpoint of dial

/**
 * Compute miss penalty based on distance from the TARGET.
 * Close miss  (≤20%): -1
 * Medium miss (≤35%): -2
 * Far miss    (>35%): -3
 */
function missPenalty(guessPct, targetPct) {
  const dist = Math.abs(guessPct - targetPct);
  if (dist <= 0.20) return -1;
  if (dist <= 0.35) return -2;
  return -3;
}

/**
 * Scoring when Cuartiles power is active.
 * The player already knows which quartile the target is in.
 * - Wrong quartile: normal miss penalty
 * - Right quartile, near center: +5, +3, +1 (investment payoff)
 */
function computeCuartilesScore(guessPct, targetPct) {
  const targetQuartile = Math.min(Math.floor(targetPct * 4), 3);
  const guessQuartile  = Math.min(Math.floor(guessPct * 4), 3);

  if (guessQuartile !== targetQuartile) {
    return { delta: missPenalty(guessPct, targetPct), reason: 'cuartiles_miss' };
  }

  // Center of the target's quartile
  const quartileCenter = targetQuartile * 0.25 + 0.125;
  const dist = Math.abs(guessPct - quartileCenter);

  if (dist <= 0.01) return { delta: +5, reason: 'cuartiles_bullseye' };
  if (dist <= 0.04) return { delta: +3, reason: 'cuartiles_close' };
  if (dist <= 0.125) return { delta: +1, reason: 'cuartiles_hit' };

  // In quartile but somehow outside range (shouldn't happen, but safe fallback)
  return { delta: +1, reason: 'cuartiles_hit' };
}

/**
 * Main scoring function for a single player's guess.
 *
 * activePowers: array of { powerName, activatorId, targetId }
 *   - 'cuartiles': activatorId used cuartiles
 *   - 'veneno':    activatorId gets 2× miss penalty
 *   - 'escudo':    activatorId ignores miss penalty
 *   - 'bloqueo':   targetId cannot guess (handled upstream); activatorId gets 1.5× miss penalty
 *   - 'switch':    positions already swapped before calling this function
 *
 * playerId: the player being scored
 */
function computeScore(guessPct, targetPct, playerId, activePowers = [], scoring = { bullseye: 4, close: 3, near: 2 }) {
  const hasPower = (name, field = 'activatorId') =>
    activePowers.some(p => p.powerName === name && p[field] === playerId);

  const isBloqueoActivator = hasPower('bloqueo');
  const hasEscudo          = hasPower('escudo');
  const hasVeneno          = hasPower('veneno');
  const hasCuartiles       = hasPower('cuartiles');

  // Cuartiles replaces normal scoring entirely
  if (hasCuartiles) {
    const result = computeCuartilesScore(guessPct, targetPct);
    // Escudo still nullifies cuartiles miss penalty
    if (result.delta < 0 && hasEscudo) {
      return { delta: 0, reason: 'cuartiles_miss_escudo' };
    }
    return result;
  }

  const distance = Math.abs(guessPct - targetPct);

  // Hit zones (use configurable scoring values)
  if (distance <= ZONE_BULLSEYE) return { delta: +(scoring.bullseye ?? 4), reason: 'bullseye' };
  if (distance <= ZONE_CLOSE)    return { delta: +(scoring.close    ?? 3), reason: 'close' };
  if (distance <= ZONE_NEAR)     return { delta: +(scoring.near     ?? 2), reason: 'near' };

  // Miss
  if (hasEscudo) return { delta: 0, reason: 'miss_escudo' };

  let multiplier = 1.0;
  if (hasVeneno)          multiplier *= 2.0;
  if (isBloqueoActivator) multiplier *= 1.5;

  const penalty = Math.floor(missPenalty(guessPct, targetPct) * multiplier);
  return { delta: penalty, reason: multiplier > 1 ? 'miss_penalty' : 'miss' };
}

/**
 * Resolve BASTA mode scoring.
 * guesses: sorted by submitted_at ASC → guesses[0] is the first submitter.
 * Returns array of { playerId, guessPct, delta, reason }
 */
function resolveBasta(guesses, targetPct, activePowers = [], scoring = { bullseye: 4, close: 3, near: 2 }) {
  if (!guesses.length) return [];

  const [first, ...rest] = guesses;
  // DB returns snake_case columns (guess_pct, player_id)
  const firstPct = parseFloat(first.guess_pct);
  const firstResult = computeScore(firstPct, targetPct, first.player_id, activePowers, scoring);

  const results = [{ playerId: first.player_id, guessPct: firstPct, ...firstResult }];

  if (firstResult.delta > 0) {
    // First submitter hit — anyone else who somehow also guessed gets 0
    for (const g of rest) {
      results.push({ playerId: g.player_id, guessPct: parseFloat(g.guess_pct), delta: 0, reason: 'basta_not_first' });
    }
  } else {
    // First submitter missed — any other submitters also get +1
    for (const g of rest) {
      results.push({ playerId: g.player_id, guessPct: parseFloat(g.guess_pct), delta: +1, reason: 'basta_others_win' });
    }
  }

  return results;
}

module.exports = { computeScore, computeCuartilesScore, resolveBasta, missPenalty };
