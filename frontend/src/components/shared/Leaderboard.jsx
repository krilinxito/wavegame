import { motion } from 'framer-motion';
import PlayerAvatar, { getPlayerColor } from './PlayerAvatar';
import useGameStore from '../../store/gameStore';

export default function Leaderboard({ compact = false }) {
  const { players, round } = useGameStore();
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div style={{
      background: 'var(--c-surface)',
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--c-border)',
      padding: compact ? '10px 12px' : '14px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
        Puntos
      </div>
      {sorted.map((player, idx) => {
        const color = getPlayerColor(player.id);
        const isPsychic = round?.psychic_id === player.id;
        return (
          <motion.div
            key={player.id}
            layout
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0',
              borderBottom: idx < sorted.length - 1 ? '1px solid var(--c-border)' : 'none',
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--c-muted)', width: 14 }}>{idx + 1}</span>
            <PlayerAvatar player={player} size={compact ? 22 : 28} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {player.display_name}
                {isPsychic && <span style={{ fontSize: 10, color: 'var(--c-muted)', marginLeft: 4 }}>[psychic]</span>}
              </div>
            </div>
            <span style={{ fontFamily: 'Fredoka One', fontSize: compact ? 16 : 18, color, minWidth: 28, textAlign: 'right' }}>
              {player.score}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
