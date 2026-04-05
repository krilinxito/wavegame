import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pctToXY, arcBandPath, pctToQuartile } from '../../utils/dialMath';
import { getPlayerColor } from '../shared/PlayerAvatar';

const R = 100;       // arc radius
const TRACK_W = 14;  // track width
const INNER_R = R - TRACK_W;

// Scoring zone colors and widths
const ZONES = [
  { halfWidth: 0.10, color: '#fbbf24', opacity: 0.25, label: '+2' },
  { halfWidth: 0.05, color: '#f97316', opacity: 0.45, label: '+3' },
  { halfWidth: 0.02, color: '#ef4444', opacity: 0.85, label: '+4' },
];

// Quartile boundary positions
const QUARTILE_TICKS = [0.25, 0.5, 0.75];

export default function SpectrumDial({
  targetPct = null,        // null = hidden; shown to psychic or on reveal
  category,                // { term, left_extreme, right_extreme }
  revealData = null,       // { targetPct, guesses:[{ playerId, guessPct, scoreDelta, playerName }] }
  players = [],            // for avatar coloring
  submittedGuesses = [],   // [{ playerId, playerName, photoPath, guessPct }] — real-time during guessing
  onGuessChange,           // (pct) => void, during guessing
  guessPct = 0.5,          // current drag position
  showGuessHandle = false,
  showQuartile = null,     // quartile number (0-3) if cuartiles power used
  isPsychic = false,
}) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const isRevealing = !!revealData;
  const actualTarget = isRevealing ? revealData.targetPct : (isPsychic ? targetPct : null);

  // Convert SVG pointer event to pct
  const eventToPct = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const svgW = rect.width;
    const svgH = rect.height;

    // viewBox: "-115 -115 230 125" → center at (0,0)
    const vbX = -115, vbY = -115, vbW = 230, vbH = 125;
    const scaleX = vbW / svgW;
    const scaleY = vbH / svgH;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * scaleX + vbX;
    const y = (clientY - rect.top) * scaleY + vbY;

    const angle = Math.atan2(-y, x) * (180 / Math.PI);
    const clampedAngle = Math.max(0, Math.min(180, angle));
    return 1 - clampedAngle / 180;
  }, []);

  const onPointerDown = (e) => {
    if (!showGuessHandle) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    const pct = eventToPct(e);
    if (pct !== null) onGuessChange?.(pct);
  };

  const onPointerMove = (e) => {
    if (!dragging || !showGuessHandle) return;
    const pct = eventToPct(e);
    if (pct !== null) onGuessChange?.(pct);
  };

  const onPointerUp = () => setDragging(false);

  // Points on the arc for left/right labels
  const leftPt  = pctToXY(0, R + 18);
  const rightPt = pctToXY(1, R + 18);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Category display */}
      {category && (
        <div style={{ marginBottom: 12, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Fredoka One', fontSize: 24, color: 'var(--c-text)', marginBottom: 4 }}>
            {category.term}
          </h2>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox="-120 -115 240 130"
        style={{ width: '100%', maxWidth: 520, overflow: 'visible', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Glow background effect */}
        <defs>
          <radialGradient id="bgGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#c87a20" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#c87a20" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <ellipse cx="0" cy="8" rx="110" ry="30" fill="url(#bgGlow)" />

        {/* Base arc track — madera oscura / bakelite */}
        <path
          d={`M -${R} 0 A ${R} ${R} 0 0 1 ${R} 0`}
          fill="none"
          stroke="#3a2210"
          strokeWidth={TRACK_W}
          strokeLinecap="round"
        />
        <path
          d={`M -${INNER_R - 1} 0 A ${INNER_R - 1} ${INNER_R - 1} 0 0 1 ${INNER_R - 1} 0`}
          fill="none"
          stroke="#251508"
          strokeWidth={1}
        />

        {/* Scoring zones — visible al revelar Y al psychic colocando el target */}
        <AnimatePresence>
          {isRevealing && ZONES.map((zone, i) => (
            <motion.path
              key={i}
              d={arcBandPath(revealData.targetPct, zone.halfWidth, R, INNER_R)}
              fill={zone.color}
              initial={{ opacity: 0 }}
              animate={{ opacity: zone.opacity }}
              transition={{ delay: i * 0.15, duration: 0.4 }}
            />
          ))}
          {isPsychic && !isRevealing && targetPct !== null && ZONES.map((zone, i) => (
            <motion.path
              key={'p' + i}
              d={arcBandPath(targetPct, zone.halfWidth, R, INNER_R)}
              fill={zone.color}
              initial={{ opacity: 0 }}
              animate={{ opacity: zone.opacity * 0.85 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
            />
          ))}
        </AnimatePresence>

        {/* Quartile tick marks (when cuartiles power revealed) */}
        {showQuartile !== null && QUARTILE_TICKS.map((q, i) => {
          const p = pctToXY(q, R + 6);
          const p2 = pctToXY(q, INNER_R - 6);
          return (
            <g key={i}>
              <line x1={p2.x} y1={p2.y} x2={p.x} y2={p.y} stroke="#d4a040" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.7" />
            </g>
          );
        })}

        {/* Quartile highlight when cuartiles power active */}
        {showQuartile !== null && (() => {
          const qStart = showQuartile * 0.25;
          const qEnd = qStart + 0.25;
          const center = qStart + 0.125;
          return (
            <motion.path
              d={arcBandPath(center, 0.125, R, INNER_R)}
              fill="#d4a040"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.25 }}
              transition={{ duration: 0.4 }}
            />
          );
        })()}

        {/* Center tick */}
        {(() => {
          const p = pctToXY(0.5, R + 8);
          const p2 = pctToXY(0.5, INNER_R - 8);
          return <line x1={p2.x} y1={p2.y} x2={p.x} y2={p.y} stroke="rgba(240,210,170,0.25)" strokeWidth="1" />;
        })()}

        {/* Psychic target indicator */}
        {actualTarget !== null && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {/* Target needle line */}
            {(() => {
              const tip = pctToXY(actualTarget, R + 4);
              const base = pctToXY(actualTarget, INNER_R - 4);
              return (
                <>
                  <line
                    x1={base.x} y1={base.y} x2={tip.x} y2={tip.y}
                    stroke={isRevealing ? '#ef4444' : '#d4a040'}
                    strokeWidth={isRevealing ? 3 : 2}
                    strokeLinecap="round"
                    filter="url(#glow)"
                  />
                  <circle cx={tip.x} cy={tip.y} r={isRevealing ? 7 : 5}
                    fill={isRevealing ? '#ef4444' : '#d4a040'}
                    filter="url(#glow)"
                  />
                </>
              );
            })()}
          </motion.g>
        )}

        {/* Drag handle (guessing phase) */}
        {showGuessHandle && (
          <motion.g style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
            {(() => {
              const tip = pctToXY(guessPct, R + 4);
              const base = pctToXY(guessPct, INNER_R - 4);
              return (
                <>
                  <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y}
                    stroke="#14b8a6" strokeWidth="3" strokeLinecap="round"
                  />
                  <circle cx={tip.x} cy={tip.y} r={8}
                    fill="#14b8a6"
                    filter="url(#glow)"
                  />
                  <circle cx={tip.x} cy={tip.y} r={12}
                    fill="rgba(20,184,166,0.15)"
                    stroke="rgba(20,184,166,0.3)"
                    strokeWidth={1}
                  />
                </>
              );
            })()}
          </motion.g>
        )}

        {/* Real-time submitted guess markers (guessing phase) */}
        {!isRevealing && submittedGuesses.map((g) => {
          const color = getPlayerColor(g.playerId);
          const pos = pctToXY(g.guessPct, R + 20);
          const arcPt = pctToXY(g.guessPct, R + 2);
          const clipId = `cg-${g.playerId}`;
          const photo = g.photoPath ? `/uploads/${g.photoPath}` : null;
          return (
            <motion.g
              key={g.playerId}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <defs>
                <clipPath id={clipId}>
                  <circle cx={pos.x} cy={pos.y} r={12} />
                </clipPath>
              </defs>
              <line x1={arcPt.x} y1={arcPt.y} x2={pos.x} y2={pos.y} stroke={color} strokeWidth="1.5" opacity="0.5" />
              <circle cx={pos.x} cy={pos.y} r={13} fill={color + '33'} stroke={color} strokeWidth={2} />
              {photo
                ? <image href={photo} x={pos.x - 12} y={pos.y - 12} width={24} height={24} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
                : <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={8} fontWeight="800" fill={color}>
                    {(g.playerName || '?').substring(0, 2).toUpperCase()}
                  </text>
              }
              <text x={pos.x} y={pos.y + 22} textAnchor="middle" fontSize={7} fill={color} opacity="0.8">
                {(g.playerName || '').substring(0, 8)}
              </text>
            </motion.g>
          );
        })}

        {/* Revealed guess markers */}
        <AnimatePresence>
          {isRevealing && revealData.guesses.map((g, i) => {
            const player = players.find(p => p.id === g.playerId);
            const color = getPlayerColor(g.playerId);
            const pos = pctToXY(g.guessPct, R + 18);
            const delta = g.scoreDelta;
            const clipId = `cr-${g.playerId}`;
            const photo = player?.photo_path ? `/uploads/${player.photo_path}` : null;
            const arcPt = pctToXY(g.guessPct, R + 2);

            return (
              <motion.g
                key={g.playerId}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.18, type: 'spring', stiffness: 280, damping: 20 }}
              >
                <defs>
                  <clipPath id={clipId}>
                    <circle cx={pos.x} cy={pos.y} r={11} />
                  </clipPath>
                </defs>

                <line x1={arcPt.x} y1={arcPt.y} x2={pos.x} y2={pos.y} stroke={color} strokeWidth="1.5" opacity="0.5" />

                <circle cx={pos.x} cy={pos.y} r={12}
                  fill={color + '33'}
                  stroke={color}
                  strokeWidth={2}
                />

                {photo
                  ? <image href={photo} x={pos.x - 11} y={pos.y - 11} width={22} height={22} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
                  : <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={9} fontWeight="800" fill={color}>
                      {(g.playerName || '?').substring(0, 2).toUpperCase()}
                    </text>
                }

                <motion.text
                  x={pos.x} y={pos.y - 20}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="800"
                  fill={delta >= 0 ? '#10b981' : '#ef4444'}
                  initial={{ opacity: 0, y: pos.y }}
                  animate={{ opacity: 1, y: pos.y - 20 }}
                  transition={{ delay: 0.6 + i * 0.18, duration: 0.5 }}
                >
                  {delta >= 0 ? `+${delta}` : delta}
                </motion.text>
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* Left/Right extreme labels */}
        {category && (
          <>
            <text x={leftPt.x - 4} y={14} textAnchor="end" fontSize={11} fontWeight="700" fill="#c8a878">
              {category.left_extreme}
            </text>
            <text x={rightPt.x + 4} y={14} textAnchor="start" fontSize={11} fontWeight="700" fill="#c8a878">
              {category.right_extreme}
            </text>
          </>
        )}

        {/* Psychic overlay text (hidden target hint) */}
        {isPsychic && !isRevealing && targetPct !== null && (
          <text x={0} y={20} textAnchor="middle" fontSize={10} fill="rgba(212,160,64,0.55)">
            Solo vos ves esto
          </text>
        )}
      </svg>
    </div>
  );
}
