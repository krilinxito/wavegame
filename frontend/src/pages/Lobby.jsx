import { useState, useRef } from 'react';
import { playSfx } from '../utils/sound';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerAvatar, { getPlayerColor } from '../components/shared/PlayerAvatar';
import RoomCode from '../components/shared/RoomCode';
import Button from '../components/shared/Button';
import socket from '../socket';
import useGameStore from '../store/gameStore';
import { useLang } from '../hooks/useLang';
import { useSettings } from '../context/SettingsContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { DEFAULT_CATEGORIES } from '../data/defaultCategories';
import { DEFAULT_CHALLENGES } from '../data/defaultChallenges';
import { QRCodeSVG } from 'qrcode.react';
import TutorialOverlay from '../components/shared/TutorialOverlay';

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

export default function Lobby() {
  const L = useLang();
  const { lang } = useSettings();
  const isMobile = useIsMobile();
  const { game, players, myPlayer, categories, challenges } = useGameStore();
  const [newCat, setNewCat]     = useState({ term: '', left: '', right: '' });
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef();
  const [showConfig, setShowConfig] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showChallengePresets, setShowChallengePresets] = useState(false);
  const [challengeSearch, setChallengeSearch] = useState('');
  const [selectedChallengePresets, setSelectedChallengePresets] = useState(new Set());
  const [newChallenge, setNewChallenge] = useState({ name: '', description: '' });
  const [showShare, setShowShare] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [presetSearch, setPresetSearch] = useState('');
  const [selectedPresets, setSelectedPresets] = useState(new Set());
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
    min_score:      game?.min_score      ?? null,
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
      setImportMsg(L.imported(ok, skip));
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

  const kickPlayer = (targetPlayerId) => {
    playSfx('sfx_click_alt');
    socket.emit('host_kick_player', { targetPlayerId });
  };

  const addPresetsSelected = () => {
    for (const pair of DEFAULT_CATEGORIES) {
      const cat = pair[lang] ?? pair.es;
      const key = cat.term;
      if (selectedPresets.has(key)) {
        socket.emit('add_category', { gameId: game.id, term: cat.term, left_extreme: cat.left_extreme, right_extreme: cat.right_extreme, playerId: myPlayer.id });
      }
    }
    setSelectedPresets(new Set());
    setShowPresets(false);
    playSfx('sfx_click');
  };

  const addCustomChallenge = () => {
    if (!newChallenge.name.trim()) return;
    socket.emit('add_challenge', {
      name: newChallenge.name.trim(),
      nameEn: newChallenge.name.trim(),
      description: newChallenge.description.trim(),
      descriptionEn: newChallenge.description.trim(),
    });
    setNewChallenge({ name: '', description: '' });
    playSfx('sfx_click');
  };

  const addChallengePresetsSelected = () => {
    for (const c of DEFAULT_CHALLENGES) {
      if (selectedChallengePresets.has(c.id)) {
        socket.emit('add_challenge', { id: c.id, name: c.name, nameEn: c.nameEn, description: c.description, descriptionEn: c.descriptionEn });
      }
    }
    setSelectedChallengePresets(new Set());
    setShowChallengePresets(false);
    playSfx('sfx_click');
  };

  const removeChallenge = (challengeId) => {
    socket.emit('remove_challenge', { challengeId });
  };

  const startGame = () => {
    if (categories.length === 0) return alert(L.needCategories);
    socket.emit('host_start_game', { gameId: game.id, playerId: myPlayer.id });
  };

  return (
    <div style={{ minHeight: '100vh', padding: '28px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontFamily: 'Fredoka One', fontSize: 28, color: 'var(--c-accent2)' }}>Wave</span>
            <span style={{ fontSize: 12, color: 'var(--c-muted)', marginLeft: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              {L.waitingRoom} · {L.modes[game.mode]?.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RoomCode code={game.room_code} />
            <button
              onClick={() => { playSfx('sfx_click_alt'); setShowShare(true); }}
              title={lang === 'en' ? 'Share room' : 'Compartir sala'}
              style={{ padding: '5px 10px', background: 'var(--c-surface)', border: '1px solid var(--c-border2)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 12, fontFamily: 'Nunito, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
            >📲 {lang === 'en' ? 'Share' : 'Compartir'}</button>
          </div>
        </div>

        <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 16 } : { display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>

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
                  <div style={sectionTitle}>{L.teamsSection}</div>
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
                                {p.display_name}{p.id === myPlayer.id ? ` (${L.you})` : ''}
                              </span>
                            ))}
                            {members.length < 2 && <span style={{ fontSize: 12, color: 'var(--c-muted)', fontStyle: 'italic' }}>{L.waitingPartner}</span>}
                          </div>
                          {!isMine && !isFull && (
                            <button onClick={() => socket.emit('set_team', { team: teamNum })}
                              style={{ padding: '4px 10px', background: color, color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Nunito, sans-serif' }}>
                              {L.joinTeam}
                            </button>
                          )}
                          {isMine && (
                            <button onClick={() => socket.emit('set_team', { team: null })}
                              style={{ padding: '4px 10px', background: 'transparent', color: 'var(--c-muted)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 11, fontFamily: 'Nunito, sans-serif' }}>
                              {L.leaveTeam}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {!myPlayer.team && !myPlayer.is_spectator && (
                      <button onClick={() => socket.emit('set_team', { team: maxTeam + 1 })}
                        style={{ padding: '8px', background: 'var(--c-surface2)', border: '1px dashed var(--c-border2)', borderRadius: 'var(--r-md)', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 13, fontFamily: 'Nunito, sans-serif' }}>
                        {L.newTeam}
                      </button>
                    )}

                    {noTeamPlayers.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>
                        {L.noTeam}: {noTeamPlayers.map(p => p.display_name).join(', ')}
                      </div>
                    )}

                    {spectatorPlayers.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                        {L.spectatingList}: {spectatorPlayers.map(p => p.display_name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Players */}
            <div style={card}>
              <div style={sectionTitle}>{L.players(players.length)}</div>
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
                      {p.id === myPlayer.id && <span style={{ fontSize: 11, color: 'var(--c-muted)', marginLeft: 6 }}>{L.you}</span>}
                      {!!p.is_host && <span style={{ fontSize: 11, color: 'var(--c-yellow)', marginLeft: 6 }}>{L.host}</span>}
                      {!!p.is_spectator && <span style={{ fontSize: 11, color: 'var(--c-muted)', marginLeft: 6 }}>{L.spectator}</span>}
                    </div>
                    {p.id === myPlayer.id && (
                      <button
                        onClick={() => socket.emit('toggle_spectator')}
                        style={{ fontSize: 11, padding: '3px 8px', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--c-muted)', fontFamily: 'Nunito, sans-serif' }}
                      >
                        {myPlayer.is_spectator ? L.playBtn : L.spectateBtn}
                      </button>
                    )}
                    {isHost && p.id !== myPlayer.id && !p.is_host && (
                      <button
                        onClick={() => kickPlayer(p.id)}
                        title="Kickear jugador"
                        style={{ fontSize: 14, lineHeight: 1, padding: '2px 5px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-red)', opacity: 0.7 }}
                      >✕</button>
                    )}
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.connected ? 'var(--c-green)' : 'var(--c-red)', flexShrink: 0 }} />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div style={card}>
              <div style={sectionTitle}>{L.secretCategories}</div>
              <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 14 }}>
                {L.categoriesHint}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                <input value={newCat.term} onChange={e => setNewCat(p => ({ ...p, term: e.target.value }))} placeholder={L.categoryPlaceholder} style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <input value={newCat.left} onChange={e => setNewCat(p => ({ ...p, left: e.target.value }))} placeholder={L.leftExtreme} style={inputStyle} />
                  <input value={newCat.right} onChange={e => setNewCat(p => ({ ...p, right: e.target.value }))} placeholder={L.rightExtreme} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button onClick={addCategory} variant="secondary" size="sm" style={{ flex: 1 }}>{L.addCategory}</Button>
                  <button
                    onClick={() => { playSfx('sfx_click_alt'); fileRef.current?.click(); }}
                    title="Importar desde .txt"
                    style={{ padding: '6px 10px', background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 13 }}
                  >📂</button>
                  <button
                    onClick={() => { playSfx('sfx_click_alt'); setShowPresets(true); }}
                    style={{ padding: '6px 10px', background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 12, fontFamily: 'Nunito, sans-serif', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                  >⚡ Presets</button>
                </div>
                <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: 'none' }} onChange={importFile} />
                {importMsg && <div style={{ fontSize: 12, color: 'var(--c-green)', fontWeight: 600 }}>{importMsg}</div>}
              </div>

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
                          <span style={{ fontSize: 11, color }}>{L.you}</span>
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
                              {' '}{L.addedCategories('', count).replace('', '').trimStart()}
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
                  {L.noCategories}
                </div>
              )}
            </div>
            {/* Challenges */}
            {isHost && (
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ ...sectionTitle, marginBottom: 0 }}>
                    🎲 {lang === 'en' ? 'Round challenges' : 'Retos por ronda'}
                  </div>
                  <button
                    onClick={() => { playSfx('sfx_click_alt'); setShowChallengePresets(true); }}
                    style={{ padding: '4px 10px', background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 12, fontFamily: 'Nunito, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}
                  >⚡ Presets</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 12 }}>
                  {lang === 'en'
                    ? 'Each round a random challenge is drawn. Leave empty for no challenges.'
                    : 'Cada ronda se sortea un reto al azar. Dejá vacío para no usar retos.'}
                </div>

                {/* Custom challenge form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <input value={newChallenge.name} onChange={e => setNewChallenge(p => ({ ...p, name: e.target.value }))}
                    placeholder={lang === 'en' ? 'Challenge name' : 'Nombre del reto'} style={inputStyle} />
                  <input value={newChallenge.description} onChange={e => setNewChallenge(p => ({ ...p, description: e.target.value }))}
                    placeholder={lang === 'en' ? 'Short description' : 'Descripción corta'} style={inputStyle} />
                  <Button onClick={addCustomChallenge} variant="secondary" size="sm">
                    {lang === 'en' ? '+ Add challenge' : '+ Agregar reto'}
                  </Button>
                </div>

                {/* Challenges list */}
                <AnimatePresence>
                  {challenges.map(c => (
                    <motion.div key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', borderRadius: 'var(--r-sm)', background: 'var(--c-surface2)', border: '1px solid var(--c-border)', marginBottom: 5 }}
                    >
                      <div style={{ flex: 1, fontSize: 13 }}>
                        <div style={{ fontWeight: 700 }}>{lang === 'en' ? (c.nameEn || c.name) : c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>{lang === 'en' ? (c.descriptionEn || c.description) : c.description}</div>
                      </div>
                      <button onClick={() => removeChallenge(c.id)} style={{ background: 'none', color: 'var(--c-muted)', fontSize: 15, cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0, marginTop: 1 }}>×</button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {challenges.length === 0 && (
                  <div style={{ color: 'var(--c-muted)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                    {lang === 'en' ? 'No challenges — all rounds free style' : 'Sin retos — todas las rondas libres'}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {isHost && (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={sectionTitle}>{L.config}</div>
                  <button onClick={() => { playSfx('sfx_click_alt'); setShowConfig(s => !s); }} style={{ background: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 14 }}>
                    {showConfig ? L.configClose : L.configEdit}
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--c-muted)', lineHeight: 1.7 }}>
                  <div>{L.configMode}: <span style={{ color: 'var(--c-text)' }}>{L.modes[game.mode]?.label}</span></div>
                  <div>{L.configRange}: <span style={{ color: 'var(--c-text)' }}>{game.range_min} – {game.range_max}</span></div>
                  <div>{L.configWin}: <span style={{ color: 'var(--c-text)' }}>{game.win_condition === 'points' ? L.winPoints(game.win_value) : L.winRounds(game.win_value)}</span></div>
                  <div>{L.configTime}: <span style={{ color: 'var(--c-text)' }}>{Math.floor((game.guess_time || 120) / 60)}:{String((game.guess_time || 120) % 60).padStart(2,'0')} min</span></div>
                </div>

                <AnimatePresence>
                  {showConfig && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
                    >
                      <div style={labelStyle}>{L.modeLabel}</div>
                      {Object.entries(L.modes).map(([key, info]) => (
                        <button key={key} onClick={() => { playSfx('sfx_click_alt'); setConfig(c => ({ ...c, mode: key })); }}
                          style={{ background: config.mode === key ? 'var(--c-accent)' : 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '6px 10px', cursor: 'pointer', color: config.mode === key ? '#fff' : 'var(--c-text)', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700, textAlign: 'left' }}
                        >
                          {info.label}
                        </button>
                      ))}

                      <div style={labelStyle}>{L.spectrumRange}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <input type="number" value={config.range_min} onChange={e => setConfig(c => ({ ...c, range_min: +e.target.value }))} placeholder="Min" style={inputStyle} />
                        <input type="number" value={config.range_max} onChange={e => setConfig(c => ({ ...c, range_max: +e.target.value }))} placeholder="Max" style={inputStyle} />
                      </div>

                      <div style={labelStyle}>{L.winCondition}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {['points', 'rounds'].map(wc => (
                          <button key={wc} onClick={() => { playSfx('sfx_click_alt'); setConfig(c => ({ ...c, win_condition: wc })); }}
                            style={{ background: config.win_condition === wc ? 'var(--c-accent)' : 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '6px', cursor: 'pointer', color: config.win_condition === wc ? '#fff' : 'var(--c-text)', fontFamily: 'Nunito, sans-serif', fontSize: 12, fontWeight: 700 }}
                          >
                            {wc === 'points' ? L.points : L.rounds}
                          </button>
                        ))}
                      </div>
                      <input type="number" min={1} value={config.win_value} onChange={e => setConfig(c => ({ ...c, win_value: +e.target.value }))} placeholder="Valor" style={inputStyle} />

                      <div style={labelStyle}>{L.pointsPerZone}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {[
                          { key: 'score_bullseye', label: L.zoneBullseye },
                          { key: 'score_close',    label: L.zoneClose },
                          { key: 'score_near',     label: L.zoneNear },
                        ].map(({ key, label }) => (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontSize: 10, color: 'var(--c-muted)', textAlign: 'center' }}>{label}</span>
                            <input type="number" min={1} max={99} value={config[key]}
                              onChange={e => setConfig(c => ({ ...c, [key]: +e.target.value }))}
                              style={{ ...inputStyle, textAlign: 'center', padding: '5px 4px' }} />
                          </div>
                        ))}
                      </div>

                      <div style={labelStyle}>{L.guessTime}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                        {[60, 90, 120, 180].map(t => (
                          <button key={t} onClick={() => { playSfx('sfx_click_alt'); setConfig(c => ({ ...c, guess_time: t })); }}
                            style={{ background: config.guess_time === t ? 'var(--c-accent)' : 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '5px 4px', cursor: 'pointer', color: config.guess_time === t ? '#fff' : 'var(--c-text)', fontFamily: 'Nunito, sans-serif', fontSize: 12, fontWeight: 700 }}
                          >
                            {t < 60 ? `${t}s` : `${t/60}m`}
                          </button>
                        ))}
                      </div>

                      <div style={labelStyle}>{L.minScore}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                        {[null, -10, -4, 0].map(v => (
                          <button key={String(v)} onClick={() => { playSfx('sfx_click_alt'); setConfig(c => ({ ...c, min_score: v })); }}
                            style={{ background: config.min_score === v ? 'var(--c-accent)' : 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '5px 4px', cursor: 'pointer', color: config.min_score === v ? '#fff' : 'var(--c-text)', fontFamily: 'Nunito, sans-serif', fontSize: 12, fontWeight: 700 }}
                          >
                            {v === null ? L.minScoreNone : v}
                          </button>
                        ))}
                      </div>

                      <Button onClick={saveConfig} variant="secondary" size="sm">{L.save}</Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {isHost
              ? <Button onClick={startGame} size="lg" style={{ width: '100%' }}>{L.startGame}</Button>
              : <div style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center', padding: '10px 0' }}>{L.waitingHost}</div>
            }
          </div>
        </div>
      </div>

      {/* Tutorial button — bottom-left corner */}
      <button
        onClick={() => { playSfx('sfx_click_alt'); setShowTutorial(true); }}
        style={{
          position: 'fixed', bottom: isMobile ? 68 : 16, right: 16, zIndex: 30,
          background: 'var(--c-surface)', border: '1px solid var(--c-border2)',
          borderRadius: 'var(--r-sm)', padding: '6px 12px',
          cursor: 'pointer', color: 'var(--c-muted)', fontSize: 12,
          fontFamily: 'Nunito, sans-serif', fontWeight: 700,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {lang === 'en' ? '? Tutorial' : '? Tutorial'}
      </button>

      {/* Tutorial overlay */}
      <AnimatePresence>
        {showTutorial && (
          <TutorialOverlay onClose={() => setShowTutorial(false)} />
        )}
      </AnimatePresence>

      {/* Share / QR modal */}
      <AnimatePresence>
        {showShare && (() => {
          const shareUrl = `${window.location.origin}/${game.room_code}`;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowShare(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            >
              <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-lg)', padding: isMobile ? '20px 16px' : '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: isMobile ? '95vw' : 340 }}
              >
                <div style={{ fontWeight: 700, fontSize: 15 }}>{lang === 'en' ? 'Invite players' : 'Invitá jugadores'}</div>
                <div style={{ background: '#fff', padding: 12, borderRadius: 12 }}>
                  <QRCodeSVG value={shareUrl} size={180} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-muted)', textAlign: 'center', wordBreak: 'break-all' }}>{shareUrl}</div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(shareUrl); playSfx('sfx_click'); }}
                  style={{ padding: '7px 20px', background: 'var(--c-accent)', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: '#fff', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13 }}
                >{lang === 'en' ? '📋 Copy link' : '📋 Copiar link'}</button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Challenge presets modal */}
      <AnimatePresence>
        {showChallengePresets && (() => {
          const q = challengeSearch.toLowerCase();
          const alreadyIds = new Set(challenges.map(c => c.id));
          const filtered = DEFAULT_CHALLENGES.filter(c =>
            !alreadyIds.has(c.id) &&
            (!q || (lang === 'en' ? c.nameEn : c.name).toLowerCase().includes(q) || (lang === 'en' ? c.descriptionEn : c.description).toLowerCase().includes(q))
          );
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowChallengePresets(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            >
              <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: isMobile ? '95vw' : 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                <div style={{ padding: isMobile ? '12px 14px' : '16px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>🎲 {lang === 'en' ? 'Challenge presets' : 'Retos predeterminados'}</span>
                  <button onClick={() => setShowChallengePresets(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--c-muted)', lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--c-border)' }}>
                  <input value={challengeSearch} onChange={e => setChallengeSearch(e.target.value)} placeholder={lang === 'en' ? 'Search...' : 'Buscar...'} style={{ width: '100%', padding: '7px 10px', background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', color: 'var(--c-text)', fontFamily: 'Nunito, sans-serif', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filtered.map(c => {
                    const checked = selectedChallengePresets.has(c.id);
                    const name = lang === 'en' ? c.nameEn : c.name;
                    const desc = lang === 'en' ? c.descriptionEn : c.description;
                    return (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: checked ? 'rgba(184,56,32,0.10)' : 'var(--c-surface2)', border: `1px solid ${checked ? 'rgba(184,56,32,0.35)' : 'transparent'}`, cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          setSelectedChallengePresets(prev => {
                            const next = new Set(prev);
                            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                            return next;
                          });
                        }} style={{ accentColor: 'var(--c-accent)', width: 15, height: 15, flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{name}</div>
                          <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>{desc}</div>
                        </div>
                      </label>
                    );
                  })}
                  {filtered.length === 0 && <div style={{ color: 'var(--c-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>{lang === 'en' ? 'No results' : 'Sin resultados'}</div>}
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>{selectedChallengePresets.size} {lang === 'en' ? 'selected' : 'seleccionados'}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSelectedChallengePresets(new Set())} style={{ padding: '6px 12px', background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--c-muted)', fontFamily: 'Nunito, sans-serif', fontSize: 12 }}>{lang === 'en' ? 'Clear' : 'Limpiar'}</button>
                    <Button onClick={addChallengePresetsSelected} size="sm" disabled={selectedChallengePresets.size === 0}>{lang === 'en' ? 'Add' : 'Agregar'} {selectedChallengePresets.size > 0 ? `(${selectedChallengePresets.size})` : ''}</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {showPresets && (() => {
          const q = presetSearch.toLowerCase();
          const filtered = DEFAULT_CATEGORIES
            .map(pair => ({ key: (pair[lang] ?? pair.es).term, cat: pair[lang] ?? pair.es }))
            .filter(({ cat }) => !q || cat.term.toLowerCase().includes(q) || cat.left_extreme.toLowerCase().includes(q) || cat.right_extreme.toLowerCase().includes(q));
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPresets(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: isMobile ? '95vw' : 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{lang === 'en' ? 'Default categories' : 'Categorías predeterminadas'}</span>
                  <button onClick={() => setShowPresets(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--c-muted)', lineHeight: 1 }}>✕</button>
                </div>

                {/* Search */}
                <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--c-border)' }}>
                  <input value={presetSearch} onChange={e => setPresetSearch(e.target.value)} placeholder={lang === 'en' ? 'Search...' : 'Buscar...'} style={{ width: '100%', padding: '7px 10px', background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', color: 'var(--c-text)', fontFamily: 'Nunito, sans-serif', fontSize: 13, boxSizing: 'border-box' }} />
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filtered.map(({ key, cat }) => {
                    const checked = selectedPresets.has(key);
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 'var(--r-sm)', background: checked ? 'rgba(184,56,32,0.10)' : 'var(--c-surface2)', border: `1px solid ${checked ? 'rgba(184,56,32,0.35)' : 'transparent'}`, cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          setSelectedPresets(prev => {
                            const next = new Set(prev);
                            next.has(key) ? next.delete(key) : next.add(key);
                            return next;
                          });
                        }} style={{ accentColor: 'var(--c-accent)', width: 15, height: 15, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{cat.term}</span>
                          <span style={{ fontSize: 11, color: 'var(--c-muted)', marginLeft: 6 }}>{cat.left_extreme} / {cat.right_extreme}</span>
                        </div>
                      </label>
                    );
                  })}
                  {filtered.length === 0 && <div style={{ color: 'var(--c-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>{lang === 'en' ? 'No results' : 'Sin resultados'}</div>}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>{selectedPresets.size} {lang === 'en' ? 'selected' : 'seleccionadas'}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSelectedPresets(new Set())} style={{ padding: '6px 12px', background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--c-muted)', fontFamily: 'Nunito, sans-serif', fontSize: 12 }}>{lang === 'en' ? 'Clear' : 'Limpiar'}</button>
                    <Button onClick={addPresetsSelected} size="sm" disabled={selectedPresets.size === 0}>{lang === 'en' ? 'Add' : 'Agregar'} {selectedPresets.size > 0 ? `(${selectedPresets.size})` : ''}</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
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
