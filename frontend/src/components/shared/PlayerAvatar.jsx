const COLORS = [
  '#6c63ff', '#c94f4f', '#4a9e7f', '#c9a84c',
  '#4a7ec9', '#9c6cc9', '#4ab5c9', '#c96c4a',
];

export function getPlayerColor(playerId) {
  if (!playerId) return COLORS[0];
  let hash = 0;
  for (const c of playerId) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function PlayerAvatar({ player, size = 40, showName = false, style = {} }) {
  const color = getPlayerColor(player?.id);
  const initials = (player?.display_name || '?').substring(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, ...style }}>
      <div style={{
        width: size, height: size, borderRadius: 'var(--r-sm)',
        border: `2px solid ${color}`,
        overflow: 'hidden',
        background: player?.photo_path ? 'transparent' : color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.33, fontWeight: 800, color,
        flexShrink: 0,
        fontFamily: 'Fredoka One',
      }}>
        {player?.photo_path
          ? <img src={`/uploads/${player.photo_path}`} alt={player.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials
        }
      </div>
      {showName && (
        <span style={{ fontSize: 11, color: 'var(--c-muted)', maxWidth: size + 20, textAlign: 'center', wordBreak: 'break-word' }}>
          {player?.display_name}
        </span>
      )}
    </div>
  );
}
