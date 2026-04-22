import { useState, useRef } from 'react';
import { playSfx } from '../utils/sound';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerAvatar, { getPlayerColor } from '../components/shared/PlayerAvatar';
import RoomCode from '../components/shared/RoomCode';
import Button from '../components/shared/Button';
import socket from '../socket';
import useGameStore from '../store/gameStore';

const SHORTCODES = {
  fire:'🔥',skull:'💀',heart:'❤️',ice:'🧊',snowflake:'❄️',rocket:'🚀',star:'⭐',
  smile:'😊',laugh:'😂',cry:'😢',angry:'😠',cool:'😎',think:'🤔',wow:'😮',
  clap:'👏',thumbsup:'👍',thumbsdown:'👎',muscle:'💪',eyes:'👀',wave:'👋',
  sun:'☀️',moon:'🌙',rain:'🌧️',lightning:'⚡',rainbow:'🌈',
  dog:'🐶',cat:'🐱',pig:'🐷',chicken:'🐔',fish:'🐟',
  pizza:'🍕',burger:'🍔',sushi:'🍣',taco:'🌮',beer:'🍺',
  money:'💰',crown:'👑',trophy:'🏆',target:'🎯',bomb:'💣',
  poop:'💩',ghost:'👻',alien:'👽',robot:'🤖',devil:'😈',
  red:'🔴',blue:'🔵',green:'🟢',yellow:'🟡',black:'⚫',white:'⚪',
};
const emojify = str => str.replace(/:([a-z0-9_]+):/gi, (m, code) => SHORTCODES[code.toLowerCase()] ?? m);

const MODE_INFO = {
  normal: { label: 'Normal',  desc: 'Psychic rotante · poderes activados' },
  teams:  { label: 'Teams',   desc: 'Duos · sin poderes' },
  basta:  { label: 'BASTA',   desc: 'Primero en adivinar lo toma todo' },
};

export default function Lobby() {
  const { game, players, myPlayer, categories } = useGameStore();
  const [newCat, setNewCat]     = useState({ term: '', left: '', right: '' });
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef();
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig]     = useState({
    mode: game?.mode || 'normal',
    range_min: game?.range_min || 1,
    range_max: game?.range_max || 1000,
    win_condition: game?.win_condition || 'points',
    win_value: game?.win_value || 10,
    guess_time: game?.guess_time || 120,
    score_bullseye: game?.score_bullseye ?? 4,
    score_close:    game?.score_close    ?? 3,
    score_near:     game?.score_near     ?? 2,
  });

  if (!game || !myPlayer) return null;
  const isHost = !!myPlayer.is_host;

  const addCategory = () => {
    if (!newCat.term || !newCat.left || !newCat.right) return;
    socket.emit('add_category', { gameId: game.id, term: newCat.term, left_extreme: newCat.left, right_extreme: newCat.right, playerId: myPlayer.id });
    setNewCat({ term: '', left: '', right: '' });
  };

  const importFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    playSfx('sfx_click_alt');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const toEmoji = str => emojify(str);
      const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean);
      let ok = 0, skip = 0;
      for (const line of lines) {
        const parts = line.split(',').map(p => toEmoji(p.trim()));
        if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) { skip++; continue; }
        socket.emit('add_category', { gameId: game.id, term: parts[0], left_extreme: parts[1], right_extreme: parts[2], playerId: myPlayer.id });
        ok++;
      }
      setImportMsg(`${ok} categorías importadas${skip ? `, ${skip} filas inválidas` : ''}`);
      setTimeout(() => setImportMsg(''), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const removeCategory = (catId) => {
    socket.emit('remove_category', { categoryId: catId, playerId: myPlayer.id });
  };

  const saveConfig = () => {
    playSfx('sfx_click_alt');
    socket.emit('host_update_config', { gameId: game.id, ...config });
    setShowConfig(false);
  };

  const startGame = () => {
    if (categories.length === 0) return alert('Agregá al menos una categoría antes de empezar');
    socket.emit('host_start_game', { gameId: game.id, playerId: myPlayer.id });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', padding: '28px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontFamily: 'Fredoka One', fontSize: 28, color: 'var(--c-accent2)' }}>Wave</span>
            <span style={{ fontSize: 12, color: 'var(--c-muted)', marginLeft: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Sala de espera · {MODE_INFO[game.mode]?.label}
            </span>
          </div>
          <RoomCode code={game.room_code} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Teams picker — solo en modo teams */}
            {game.mode === 'teams' && (() => {
              const PAIR_COLORS = ['#2a5a96','#b83820','#2a8052','#8a6020','#6a3090','#208a80'];
              const teamNums = [...new Set(players.filter(p => p.team).map(p => p.team))].sort((a,b)=>a-b);
              const maxTeam = teamNums.length > 0 ? Math.max(...teamNums) : 0;
              const spectatorPlayers = players.filter(p => p.is_spectator);
              const noTeamPlayers = players.filter(p => !p.team && !p.is_spectator);

              return (
                <div style={card}>
                  <div style={sectionTitle}>Parejas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {teamNums.map((teamNum, i) => {
                      const color = PAIR_COLORS[i % PAIR_COLORS.length];
                      const members = players.filter(p => p.team === teamNum);
                      const isMine = myPlayer.team === teamNum;
                      const isFull = members.filter(p => p.id !== myPlayer.id).length >= 2;
                      return (
                        <div key={teamNum} style={{ background: `${color}11`, border: `1px solid ${color}44`, borderRadius: 'var(--r-md)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontFamily: 'Fredoka One', fontSize: 13, color, minWidth: 24 }}>#{teamNum}</div>
                          <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {members.map(p => (
                              <span key={p.id} style={{ fontSize: 13, fontWeight: p.id === myPlayer.id ? 700 : 400, color: 'var(--c-text)' }}>
                                {p.display_name}{p.id === myPlayer.id ? ' (vos)' : ''}
                              </span>
                            ))}
                            {members.length < 2 && <span style={{ fontSize: 12, color: 'var(--c-muted)', fontStyle: 'italic' }}>esperando pareja...</span>}
                          </div>
                          {!isMine && !isFull && (
                            <button onClick={() => socket.emit('set_team', { team: teamNum })}
                              style={{ padding: '4px 10px', background: color, color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Nunito, sans-serif' }}>
                              Unirme
                            </button>
                          )}
                          {isMine && (
                            <button onClick={() => socket.emit('set_team', { team: null })}
                              style={{ padding: '4px 10px', background: 'transparent', color: 'var(--c-muted)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 11, fontFamily: 'Nunito, sans-serif' }}>
                              Salir
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Nueva pareja */}
                    {!myPlayer.team && !myPlayer.is_spectator && (
                      <button onClick={() => socket.emit('set_team', { team: maxTeam + 1 })}
                        style={{ padding: '8px', background: 'var(--c-surface2)', border: '1px dashed var(--c-border2)', borderRadius: 'var(--r-md)', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 13, fontFamily: 'Nunito, sans-serif' }}>
                        + Nueva pareja
                      </button>
                    )}

                    {/* Sin equipo */}
                    {noTeamPlayers.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>
                        Sin pareja: {noTeamPlayers.map(p => p.display_name).join(', ')}
                      </div>
                    )}

                    {/* Espectadores */}
                    {spectatorPlayers.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                        👁 Especteando: {spectatorPlayers.map(p => p.display_name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Players */}
            <div style={card}>
              <div style={sectionTitle}>Jugadores ({players.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {players.map(p => (
                  <motion.div key={p.id} layout style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 'var(--r-sm)',
                    background: p.id === myPlayer.id ? 'rgba(184,56,32,0.10)' : 'var(--c-surface2)',
                    border: `1px solid ${p.id === myPlayer.id ? 'rgba(184,56,32,0.35)' : 'transparent'}`,
                  }}>
                    <PlayerAvatar player={p} size={34} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{p.display_name}</span>
                      {p.id === myPlayer.id && <span style={{ fontSize: 11, color: 'var(--c-muted)', marginLeft: 6 }}>vos</span>}
                      {!!p.is_host && <span style={{ fontSize: 11, color: 'var(--c-yellow)', marginLeft: 6 }}>host</span>}
                      {!!p.is_spectator && <span style={{ fontSize: 11, color: 'var(--c-muted)', marginLeft: 6 }}>👁 espectador</span>}
                    </div>
                    {p.id === myPlayer.id && (
                      <button
                        onClick={() => socket.emit('toggle_spectator')}
                        style={{ fontSize: 11, padding: '3px 8px', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--c-muted)', fontFamily: 'Nunito, sans-serif' }}
                      >
                        {myPlayer.is_spectator ? 'Jugar' : '👁 Spectate'}
                      </button>
                    )}
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.connected ? 'var(--c-green)' : 'var(--c-red)', flexShrink: 0 }} />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div style={card}>
              <div style={sectionTitle}>Categorias secretas</div>
              <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 14 }}>
                Se revelan cuando empieza la partida.
              </div>

              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                <input value={newCat.term} onChange={e => setNewCat(p => ({ ...p, term: e.target.value }))} placeholder="Categoria (ej: Aves)" style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <input value={newCat.left} onChange={e => setNewCat(p => ({ ...p, left: e.target.value }))} placeholder="Extremo izq." style={inputStyle} />
                  <input value={newCat.right} onChange={e => setNewCat(p => ({ ...p, right: e.target.value }))} placeholder="Extremo der." style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button onClick={addCategory} variant="secondary" size="sm" style={{ flex: 1 }}>+ Agregar</Button>
                  <button
                    onClick={() => { playSfx('sfx_click_alt'); fileRef.current?.click(); }}
                    title="Importar desde .txt"
                    style={{ padding: '6px 10px', background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 13 }}
                  >📂</button>
                </div>
                <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: 'none' }} onChange={importFile} />
                {importMsg && <div style={{ fontSize: 12, color: 'var(--c-green)', fontWeight: 600 }}>{importMsg}</div>}
              </div>

              {/* List */}
              <AnimatePresence>
                {isHost ? (
                  categories.map(cat => {
                    const creator = players.find(p => p.id === cat.created_by);
                    const color = getPlayerColor(cat.created_by);
                    return (
                      <motion.div key={cat.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--r-sm)', background: 'var(--c-surface2)', border: `1px solid ${color}33`, marginBottom: 5 }}
                      >
                        <div style={{ flex: 1, fontSize: 13 }}>
                          <span style={{ fontWeight: 700, color: 'var(--c-text)' }}>{cat.term}</span>
                          <span style={{ color: 'var(--c-muted)' }}> · {cat.left_extreme} / {cat.right_extreme}</span>
                        </div>
                        <span style={{ fontSize: 11, color }}>{creator?.display_name}</span>
                        <button onClick={() => removeCategory(cat.id)} style={{ background: 'none', color: 'var(--c-muted)', fontSize: 15, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
                      </motion.div>
                    );
                  })
                ) : (() => {
                  const myCats = categories.filter(c => c.created_by === myPlayer.id);
                  const otherCounts = {};
                  for (const cat of categories) {
                    if (cat.created_by !== myPlayer.id)
                      otherCounts[cat.created_by] = (otherCounts[cat.created_by] || 0) + 1;
                  }
                  const color = getPlayerColor(myPlayer.id);
                  return (
                    <>
                      {myCats.map(cat => (
                        <motion.div key={cat.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--r-sm)', background: `${color}18`, border: `1px solid ${color}44`, marginBottom: 5 }}
                        >
                          <div style={{ flex: 1, fontSize: 13 }}>
                            <span style={{ fontWeight: 700 }}>{cat.term}</span>
                            <span style={{ color: 'var(--c-muted)' }}> · {cat.left_extreme} / {cat.right_extreme}</span>
                          </div>
                          <span style={{ fontSize: 11, color }}>vos</span>
                          <button onClick={() => removeCategory(cat.id)} style={{ background: 'none', color: 'var(--c-muted)', fontSize: 15, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
                        </motion.div>
                      ))}
                      {Object.entries(otherCounts).map(([pid, count]) => {
                        const player = players.find(p => p.id === pid);
                        const c = getPlayerColor(pid);
                        return (
                          <motion.div key={pid} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--r-sm)', background: 'var(--c-surface2)', marginBottom: 5 }}
                          >
                            <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>
                              <span style={{ color: c, fontWeight: 700 }}>{player?.display_name}</span>
                              {' '}agregó {count} {count === 1 ? 'categoria' : 'categorias'}
                            </span>
                          </motion.div>
                        );
                      })}
                    </>
                  );
                })()}
              </AnimatePresence>

              {categories.length === 0 && (
                <div style={{ color: 'var(--c-muted)', fontSize: 13, textAlign: 'center', padding: 10 }}>
                  Sin categorias aun.
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {isHost && (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={sectionTitle}>Config</div>
                  <button onClick={() => { playSfx('sfx_click_alt'); setShowConfig(s => !s); }} style={{ background: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 14 }}>
                    {showConfig ? 'cerrar' : 'editar'}
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--c-muted)', lineHeight: 1.7 }}>
                  <div>Modo: <span style={{ color: 'var(--c-text)' }}>{MODE_INFO[game.mode]?.label}</span></div>
                  <div>Rango: <span style={{ color: 'var(--c-text)' }}>{game.range_min} – {game.range_max}</span></div>
                  <div>Victoria: <span style={{ color: 'var(--c-text)' }}>{game.win_condition === 'points' ? `${game.win_value} pts` : `${game.win_value} rondas`}</span></div>
                  <div>Tiempo: <span style={{ color: 'var(--c-text)' }}>{Math.floor((game.guess_time || 120) / 60)}:{String((game.guess_time || 120) % 60).padStart(2,'0')} min</span></div>
                </div>

                <AnimatePresence>
                  {showConfig && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
                    >
                      <div style={labelStyle}>Modo</div>
                      {Object.entries(MODE_INFO).map(([key, info]) => (
                        <button key={key} onClick={() => { playSfx('sfx_click_alt'); setConfig(c => ({ ...c, mode: key })); }}
                          style={{ background: config.mode === key ? 'var(--c-accent)' : 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '6px 10px', cursor: 'pointer', color: 'var(--c-text)', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700, textAlign: 'left' }}
                        >
                          {info.label}
                        </button>
                      ))}

                      <div style={labelStyle}>Rango del espectro</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <input type="number" value={config.range_min} onChange={e => setConfig(c => ({ ...c, range_min: +e.target.value }))} placeholder="Min" style={inputStyle} />
                        <input type="number" value={config.range_max} onChange={e => setConfig(c => ({ ...c, range_max: +e.target.value }))} placeholder="Max" style={inputStyle} />
                      </div>

                      <div style={labelStyle}>Victoria</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {['points', 'rounds'].map(wc => (
                          <button key={wc} onClick={() => { playSfx('sfx_click_alt'); setConfig(c => ({ ...c, win_condition: wc })); }}
                            style={{ background: config.win_condition === wc ? 'var(--c-accent)' : 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '6px', cursor: 'pointer', color: 'var(--c-text)', fontFamily: 'Nunito, sans-serif', fontSize: 12, fontWeight: 700 }}
                          >
                            {wc === 'points' ? 'Puntos' : 'Rondas'}
                          </button>
                        ))}
                      </div>
                      <input type="number" min={1} value={config.win_value} onChange={e => setConfig(c => ({ ...c, win_value: +e.target.value }))} placeholder="Valor" style={inputStyle} />

                      <div style={labelStyle}>Puntos por zona 🎯</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {[
                          { key: 'score_bullseye', label: 'Bullseye' },
                          { key: 'score_close',    label: 'Cerca' },
                          { key: 'score_near',     label: 'Casi' },
                        ].map(({ key, label }) => (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontSize: 10, color: 'var(--c-muted)', textAlign: 'center' }}>{label}</span>
                            <input type="number" min={1} max={99} value={config[key]}
                              onChange={e => setConfig(c => ({ ...c, [key]: +e.target.value }))}
                              style={{ ...inputStyle, textAlign: 'center', padding: '5px 4px' }} />
                          </div>
                        ))}
                      </div>

                      <div style={labelStyle}>Tiempo de adivinación</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                        {[60, 90, 120, 180].map(t => (
                          <button key={t} onClick={() => { playSfx('sfx_click_alt'); setConfig(c => ({ ...c, guess_time: t })); }}
                            style={{ background: config.guess_time === t ? 'var(--c-accent)' : 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '5px 4px', cursor: 'pointer', color: config.guess_time === t ? '#fff' : 'var(--c-text)', fontFamily: 'Nunito, sans-serif', fontSize: 12, fontWeight: 700 }}
                          >
                            {t < 60 ? `${t}s` : `${t/60}m`}{t === 120 ? '' : ''}
                          </button>
                        ))}
                      </div>
                      <Button onClick={saveConfig} variant="secondary" size="sm">Guardar</Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {isHost
              ? <Button onClick={startGame} size="lg" style={{ width: '100%' }}>Iniciar partida</Button>
              : <div style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center', padding: '10px 0' }}>Esperando al host...</div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

const card = {
  background: 'var(--c-surface)',
  borderRadius: 'var(--r-lg)',
  border: '1px solid var(--c-border2)',
  padding: 16,
  boxShadow: 'var(--shadow-window)',
};

const sectionTitle = {
  fontSize: 12, fontWeight: 700, color: 'var(--c-muted)',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
};

const inputStyle = {
  width: '100%', background: 'var(--c-surface2)',
  border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)',
  padding: '7px 10px', color: 'var(--c-text)', fontSize: 13,
  outline: 'none', fontFamily: 'Nunito, sans-serif',
};

const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--c-muted)',
  textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2,
};
