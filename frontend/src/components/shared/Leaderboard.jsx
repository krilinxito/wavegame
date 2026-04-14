import { motion } from 'framer-motion';
import PlayerAvatar, { getPlayerColor } from './PlayerAvatar';
import useGameStore from '../../store/gameStore';

const TEAM_COLORS = ['#6c63ff', '#f97316', '#10b981', '#ef4444', '#fbbf24'];
const teamColor = (n) => TEAM_COLORS[(n - 1) % TEAM_COLORS.length];

function TeamsLeaderboard({ players, round, compact }) {
  // Build team groups
  const teamMap = {};
  for (const p of players) {
    if (!p.team || p.is_spectator || !p.connected) continue;
    if (!teamMap[p.team]) teamMap[p.team] = { players: [], total: 0 };
    teamMap[p.team].players.push(p);
    teamMap[p.team].total += p.score;
  }
  const teams = Object.entries(teamMap)
    .map(([tn, data]) => ({ teamNum: parseInt(tn), ...data }))
    .sort((a, b) => b.total - a.total);

  const spectators = players.filter(p => p.connected && p.is_spectator);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {teams.map((team, ti) => {
        const color = teamColor(team.teamNum);
        return (
          <motion.div
            key={team.teamNum}
            layout
            style={{
              background: `${color}0f`,
              border: `1px solid ${color}44`,
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
            }}
          >
            {/* Team header with total */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: `1px solid ${color}22`,
            }}>
              <span style={{ fontWeight: 700, color, fontSize: 13 }}>
                Equipo {team.teamNum}
              </span>
              <span style={{ fontFamily: 'Fredoka One', fontSize: 24, color }}>
                {team.total}
              </span>
            </div>
            {/* Players */}
            {team.players.map(player => {
              const isPsychic = round?.psychic_id === player.id;
              return (
                <div key={player.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                }}>
                  <PlayerAvatar player={player} size={28} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                      {player.display_name}
                    </span>
                    {isPsychic && <span style={{ fontSize: 10, color: 'var(--c-muted)' }}>🧠 psychic</span>}
                  </div>
                  <span style={{ fontSize: 14, fontFamily: 'Fredoka One', color }}>
                    {player.score}
                  </span>
                </div>
              );
            })}
          </motion.div>
        );
      })}
      {spectators.length > 0 && (
        <div style={{ paddingTop: 4 }}>
          {spectators.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              <span style={{ fontSize: 11 }}>👁</span>
              <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>{p.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Leaderboard({ compact = false }) {
  const { players, round, game } = useGameStore();

  if (game?.mode === 'teams') {
    return <TeamsLeaderboard players={players} round={round} compact={compact} />;
  }

  const sorted    = [...players].filter(p => p.connected && !p.is_spectator).sort((a, b) => b.score - a.score);
  const spectators = players.filter(p => p.connected && p.is_spectator);

  return (
    <div style={{
      background: 'var(--c-surface)',
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--c-border)',
      padding: compact ? '10px 12px' : '14px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
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
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderBottom: idx < sorted.length - 1 ? '1px solid var(--c-border)' : 'none',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--c-muted)', width: 16 }}>{idx + 1}</span>
            <PlayerAvatar player={player} size={34} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {player.display_name}
              </div>
              {isPsychic && (
                <div style={{ fontSize: 10, color: 'var(--c-muted)', marginTop: 1 }}>🧠 psychic</div>
              )}
            </div>
            <span style={{ fontFamily: 'Fredoka One', fontSize: 22, color, minWidth: 32, textAlign: 'right' }}>
              {player.score}
            </span>
          </motion.div>
        );
      })}
      {spectators.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--c-border)' }}>
          {spectators.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              <span style={{ fontSize: 11 }}>👁</span>
              <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>{p.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
