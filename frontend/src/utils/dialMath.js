/**
 * Convert a 0.0–1.0 percent to an angle in degrees.
 * 0.0 → 180° (left end), 0.5 → 90° (top), 1.0 → 0° (right end)
 */
export function pctToAngle(pct) {
  return 180 - pct * 180;
}

/**
 * Convert 0.0–1.0 to (x, y) on the semicircle arc.
 * The arc opens upward: center at (0,0), radius as given.
 * y is negative (above the diameter in screen coords).
 */
export function pctToXY(pct, radius = 100) {
  const rad = (pctToAngle(pct) * Math.PI) / 180;
  return {
    x: radius * Math.cos(rad),
    y: -radius * Math.sin(rad),
  };
}

/**
 * Build an SVG arc path string for a thick band (annular sector)
 * centered at centerPct, spanning ±halfWidth on both sides.
 */
export function arcBandPath(centerPct, halfWidth, outerR, innerR) {
  const leftPct  = Math.max(0, centerPct - halfWidth);
  const rightPct = Math.min(1, centerPct + halfWidth);

  const o1 = pctToXY(leftPct,  outerR);
  const o2 = pctToXY(rightPct, outerR);
  const i1 = pctToXY(leftPct,  innerR);
  const i2 = pctToXY(rightPct, innerR);

  const spanAngle = (rightPct - leftPct) * 180;
  const largeArc = spanAngle > 180 ? 1 : 0;

  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/**
 * Detect the quartile (0–3) for a given percent.
 */
export function pctToQuartile(pct) {
  return Math.min(Math.floor(pct * 4), 3);
}

/**
 * Get the label value (within rangeMin–rangeMax) for a given pct.
 */
export function pctToValue(pct, rangeMin, rangeMax) {
  return Math.round(rangeMin + pct * (rangeMax - rangeMin));
}
