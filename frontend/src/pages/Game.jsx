import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { playSfx } from '../utils/sound';
import ClueGiving from '../components/round/ClueGiving';
import Guessing from '../components/round/Guessing';
import Revealing from '../components/round/Revealing';
import PowerCard from '../components/powers/PowerCard';
import PowerToast from '../components/powers/PowerToast';
import Leaderboard from '../components/shared/Leaderboard';
import ReactionBar from '../components/shared/ReactionBar';
import Button from '../components/shared/Button';
import Modal from '../components/shared/Modal';
import socket from '../socket';
import useGameStore from '../store/gameStore';
import { getPlayerColor } from '../components/shared/PlayerAvatar';
import { useLang } from '../hooks/useLang';
import { useSettings } from '../context/SettingsContext';
import { useIsMobile } from '../hooks/useIsMobile';

const TEAM_COLORS = ['#6c63ff', '#f97316', '#10b981', '#ef4444', '#fbbf24'];
const teamColor = (n) => TEAM_COLORS[(n - 1) % TEAM_COLORS.length];

function OtherTeamsStatus({ teamRounds, myTeamNum, players, allTeamRoundsDone }) {
  const L = useLang();
  const otherTeams = Object.entries(teamRounds).filter(([tn]) => parseInt(tn) !== myTeamNum);
  if (!otherTeams.length) return null;

  const phaseLabel = (round) => {
    if (!round) return '—';
    if (round.status === 'clue_giving') return L.phaseClue;
    if (round.status === 'guessing') return L.phaseGuessing;
    if (round.status === 'revealed' || round.status === 'done') return L.phaseDone;
    return round.status;
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {L.otherTeams}
      </div>
      {otherTeams.map(([tn, tr]) => {
        const teamNum = parseInt(tn);
        const color = teamColor(teamNum);
        const teamPlayers = players.filter(p => p.team === teamNum && !p.is_spectator);
        const guessCount = tr.submittedGuesses?.filter(g => g.guessPct !== null || g.playerId).length ?? 0;
        const eligibleCount = teamPlayers.filter(p => tr.round && p.id !== tr.round.psychic_id).length;
        return (
          <div key={tn} style={{
            background: `${color}11`, border: `1px solid ${color}33`,
            borderRadius: 10, padding: '10px 12px', marginBottom: 6,
          }}>
            <div style={{ fontWeight: 700, color, fontSize: 13, marginBottom: 4 }}>
              {L.team(teamNum)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 4 }}>
              {phaseLabel(tr.round)}
            </div>
            {tr.round?.status === 'guessing' && (
              <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>
                {L.guessedCount(guessCount, eligibleCount)}
              </div>
            )}
            {tr.round?.clue && tr.round.status !== 'clue_giving' && (
              <div style={{ fontSize: 11, color, fontStyle: 'italic', marginTop: 2 }}>
                "{tr.round.clue}"
              </div>
            )}
            {tr.revealData && (
              <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                {tr.revealData.guesses.filter(g => g.guessPct !== null).map(g => {
                  const p = players.find(pl => pl.id === g.playerId);
                  return (
                    <span key={g.playerId} style={{ marginRight: 6, color: g.scoreDelta > 0 ? '#10b981' : '#ef4444' }}>
                      {p?.display_name}: {g.scoreDelta >= 0 ? `+${g.scoreDelta}` : g.scoreDelta}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {allTeamRoundsDone && (
        <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, textAlign: 'center', marginTop: 4 }}>
          {L.allTeamsDone}
        </div>
      )}
    </div>
  );
}

function GameStats({ stats, players }) {
  const { lang } = useSettings();
  if (!stats) return null;
  const entries = Object.entries(stats);
  if (!entries.length) return null;

  const getName = (id) => players.find(p => p.id === id)?.display_name ?? '?';

  const mostBullseyes = entries.reduce((best, [id, s]) => (!best || s.bullseyes > best.val ? { id, val: s.bullseyes } : best), null);
  const bestDelta     = entries.reduce((best, [id, s]) => (!best || s.bestDelta > best.val ? { id, val: s.bestDelta } : best), null);
  const mostPsychic   = entries.reduce((best, [id, s]) => (!best || s.roundsAsPsychic > best.val ? { id, val: s.roundsAsPsychic } : best), null);

  const rows = [
    mostBullseyes?.val > 0 && { emoji: '🎯', label: lang === 'en' ? 'Most bullseyes' : 'Más bullseyes', name: getName(mostBullseyes.id), val: `×${mostBullseyes.val}` },
    bestDelta?.val > 0     && { emoji: '⚡', label: lang === 'en' ? 'Best round'     : 'Mejor ronda',    name: getName(bestDelta.id),     val: `+${bestDelta.val}` },
    mostPsychic?.val > 0   && { emoji: '🧠', label: lang === 'en' ? 'Most as psychic': 'Más veces psíquico', name: getName(mostPsychic.id), val: `×${mostPsychic.val}` },
  ].filter(Boolean);

  if (!rows.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
      style={{ width: '100%', maxWidth: 360, marginTop: 20, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}
    >
      <div style={{ padding: '8px 16px', background: 'var(--c-surface2)', fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {lang === 'en' ? 'Game highlights' : 'Highlights de la partida'}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderTop: '1px solid var(--c-border)' }}>
          <span style={{ fontSize: 16 }}>{row.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>{row.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{row.name}</div>
          </div>
          <span style={{ fontFamily: 'Fredoka One', fontSize: 18, color: 'var(--c-accent2)' }}>{row.val}</span>
        </div>
      ))}
    </motion.div>
  );
}

function GameOver({ gameOver, gameStats, myPlayer, players, isHost, returnToLobby }) {
  const L = useLang();
  const isTeams = gameOver.winnerTeam != null;
  const winnerTeamNum = gameOver.winnerTeam;
  const winnerColor = isTeams ? teamColor(winnerTeamNum) : getPlayerColor(gameOver.winner?.id);

  const isWinner = isTeams
    ? myPlayer?.team === winnerTeamNum
    : gameOver.winner?.id === myPlayer?.id;

  useEffect(() => {
    if (isWinner) {
      playSfx('sfx_celebrate');
      const end = Date.now() + 3500;
      const frame = () => {
        confetti({ particleCount: 6, angle: 60,  spread: 55, origin: { x: 0 }, colors: ['#ef4444','#fbbf24','#10b981','#6c63ff'] });
        confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ef4444','#fbbf24','#10b981','#6c63ff'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    } else {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.4 }, colors: ['#fbbf24','#6c63ff','#ef4444'] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isTeams) {
    const teamMap = {};
    for (const p of (gameOver.finalScores || [])) {
      if (!p.team || p.is_spectator) continue;
      if (!teamMap[p.team]) teamMap[p.team] = { players: [], total: 0 };
      teamMap[p.team].players.push(p);
      teamMap[p.team].total += p.score;
    }
    const teamsSorted = Object.entries(teamMap)
      .map(([tn, data]) => ({ teamNum: parseInt(tn), ...data }))
      .sort((a, b) => b.total - a.total);

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: 'Fredoka One', fontSize: 13, color: 'var(--c-muted)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>{L.winnerTeamLabel}</div>
          <div style={{ fontFamily: 'Fredoka One', fontSize: 48, color: winnerColor }}>{L.teamName(winnerTeamNum)}</div>
          <div style={{ fontFamily: 'Fredoka One', fontSize: 26, color: 'var(--c-muted)', marginTop: 2 }}>{L.totalPts(gameOver.teamScore)}</div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
            {(teamMap[winnerTeamNum]?.players || []).map(p => (
              <div key={p.id} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: winnerColor, fontSize: 18 }}>{p.display_name}</div>
                <div style={{ fontSize: 13, color: 'var(--c-muted)' }}>{p.score} pts</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {teamsSorted.map((team, i) => {
            const color = teamColor(team.teamNum);
            const isWinningTeam = team.teamNum === winnerTeamNum;
            return (
              <div key={team.teamNum} style={{
                background: isWinningTeam ? `${color}18` : 'var(--c-surface)',
                border: `1px solid ${isWinningTeam ? color : 'var(--c-border)'}`,
                borderRadius: 'var(--r-lg)', overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>{i + 1}.</span>
                    <span style={{ fontFamily: 'Fredoka One', fontSize: 17, color }}>{L.teamName(team.teamNum)}</span>
                    {isWinningTeam && <span style={{ fontSize: 16 }}>🏆</span>}
                  </div>
                  <span style={{ fontFamily: 'Fredoka One', fontSize: 22, color }}>{team.total} pts</span>
                </div>
                {team.players.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px 7px 36px', fontSize: 13 }}>
                    <span style={{ color: 'var(--c-text)' }}>{p.display_name}</span>
                    <span style={{ color: 'var(--c-muted)' }}>{p.score} pts</span>
                  </div>
                ))}
              </div>
            );
          })}
        </motion.div>

        <GameStats stats={gameStats} players={players} />
        {isHost
          ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}><Button onClick={returnToLobby} style={{ marginTop: 24 }}>{L.returnLobby}</Button></motion.div>
          : <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ marginTop: 20, color: 'var(--c-muted)', fontSize: 13 }}>{L.waitingHost}</motion.div>
        }
        <ReactionBar />
      </div>
    );
  }

  const color = getPlayerColor(gameOver.winner?.id);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontFamily: 'Fredoka One', fontSize: 14, color: 'var(--c-muted)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>{L.winnerLabel}</div>
        <div style={{ fontFamily: 'Fredoka One', fontSize: 52, color }}>{gameOver.winner?.display_name}</div>
        <div style={{ fontFamily: 'Fredoka One', fontSize: 28, color: 'var(--c-muted)', marginTop: 4 }}>{gameOver.winner?.score} pts</div>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        style={{ width: '100%', maxWidth: 360, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}
      >
        {gameOver.finalScores.map((p, i) => {
          const c = getPlayerColor(p.id);
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < gameOver.finalScores.length - 1 ? '1px solid var(--c-border)' : 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--c-muted)', width: 20 }}>{['1.','2.','3.'][i] ?? `${i+1}.`}</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{p.display_name}</span>
              <span style={{ fontFamily: 'Fredoka One', fontSize: 20, color: c }}>{p.score}</span>
            </div>
          );
        })}
      </motion.div>
      <GameStats stats={gameStats} players={players} />
      {isHost
        ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}><Button onClick={returnToLobby} style={{ marginTop: 24 }}>{L.returnLobby}</Button></motion.div>
        : <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ marginTop: 20, color: 'var(--c-muted)', fontSize: 13 }}>{L.waitingHost}</motion.div>
      }
      <ReactionBar />
    </div>
  );
}

export default function Game({ onGoHome }) {
  const L = useLang();
  const { lang } = useSettings();
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = React.useState('game');
  const [showLeaveConfirm, setShowLeaveConfirm] = React.useState(false);
  const { round, game, myPlayer, players, gameOver, gameStats, noCategories, revealData, teamRounds, allTeamRoundsDone } = useGameStore();
  if (!game || !myPlayer) return null;

  const isHost = !!myPlayer.is_host;
  const isTeamsMode = game.mode === 'teams';
  const myTeamNum = myPlayer.team ?? null;

  const advanceRound  = () => socket.emit('next_round',      { gameId: game.id });
  const requestReveal = () => socket.emit('request_reveal',  { roundId: round?.id });
  const returnToLobby = () => socket.emit('return_to_lobby', { gameId: game.id });

  if (gameOver) return <GameOver gameOver={gameOver} gameStats={gameStats} myPlayer={myPlayer} players={players} isHost={isHost} returnToLobby={returnToLobby} />;

  if (noCategories) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fredoka One', fontSize: 32, color: 'var(--c-accent2)', marginBottom: 8 }}>{L.noMoreCategories}</div>
          <div style={{ color: 'var(--c-muted)', fontSize: 15 }}>{L.noMoreCategoriesDesc}</div>
        </motion.div>
        {isHost
          ? <Button onClick={returnToLobby}>{L.returnLobby}</Button>
          : <div style={{ color: 'var(--c-muted)', fontSize: 13 }}>{L.waitingHost}</div>
        }
        <ReactionBar />
      </div>
    );
  }

  const isRevealed = !!(revealData || ['revealing','scoring','done','revealed'].includes(round?.status));
  const canAdvanceRound = isRevealed && (!isTeamsMode || allTeamRoundsDone);

  // ── Shared sidebar content ────────────────────────────────────
  const sidebarContent = (
    <>
      {isTeamsMode && (
        <OtherTeamsStatus
          teamRounds={teamRounds}
          myTeamNum={round ? myTeamNum : null}
          players={players}
          allTeamRoundsDone={allTeamRoundsDone}
        />
      )}
      <Leaderboard />
      {!isMobile && <PowerToast />}
    </>
  );

  // ── Shared main content ───────────────────────────────────────
  const mainContent = !round ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div style={{ fontFamily: 'Fredoka One', fontSize: 20, color: 'var(--c-muted)' }}>
        {Object.keys(teamRounds).length > 0 ? L.watchingGame : L.preparingRound}
      </div>
    </div>
  ) : (
    <>
      <AnimatePresence mode="wait">
        {round.status === 'clue_giving' && (
          <motion.div key="clue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ClueGiving />
          </motion.div>
        )}
        {round.status === 'guessing' && (
          <motion.div key="guess" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Guessing />
          </motion.div>
        )}
        {isRevealed && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Revealing />
            {isHost && canAdvanceRound && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}
              >
                <Button onClick={advanceRound}>{L.nextRound}</Button>
              </motion.div>
            )}
            {!isHost && canAdvanceRound && !game.auto_advance && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                style={{ textAlign: 'center', marginTop: 16, color: 'var(--c-muted)', fontSize: 13 }}
              >
                {L.waitingHostNextRound}
              </motion.div>
            )}
            {isHost && isTeamsMode && !allTeamRoundsDone && isRevealed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                style={{ textAlign: 'center', marginTop: 16, color: 'var(--c-muted)', fontSize: 13 }}
              >
                {L.waitingOtherTeam}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {isHost && round.status === 'guessing' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <Button variant="ghost" onClick={requestReveal} size="sm">{L.revealNow}</Button>
        </div>
      )}
    </>
  );

  // ── Mobile layout ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Mobile header */}
        <div style={{
          padding: '10px 48px 10px 12px',
          borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--c-surface)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span onClick={() => setShowLeaveConfirm(true)} style={{ fontFamily: 'Fredoka One', fontSize: 18, color: 'var(--c-accent2)', cursor: 'pointer' }}>Wave</span>
            <span style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '2px 6px', fontSize: 10, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {game.mode}
            </span>
          </div>
          {round && (
            <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>
              {game.win_condition === 'points' ? L.goalPts(game.win_value) : L.roundsGoal(round.round_number, game.win_value)}
            </span>
          )}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 12px 70px' }}>
          {mobileTab === 'game' ? mainContent : sidebarContent}
        </div>

        {/* Bottom nav */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 52,
          background: 'var(--c-surface)', borderTop: '1px solid var(--c-border)',
          display: 'flex', zIndex: 40,
        }}>
          {[
            { key: 'game',   label: '🎮 Juego' },
            { key: 'scores', label: '📊 Puntajes' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
                color: mobileTab === tab.key ? 'var(--c-accent2)' : 'var(--c-muted)',
                borderTop: `2px solid ${mobileTab === tab.key ? 'var(--c-accent2)' : 'transparent'}`,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <PowerCard />
        <ReactionBar />
        <PowerToast />

        <Modal
          open={showLeaveConfirm}
          onClose={() => setShowLeaveConfirm(false)}
          title={lang === 'en' ? '⚠ Leave game?' : '⚠ ¿Salir de la partida?'}
        >
          <p style={{ fontSize: 14, color: 'var(--c-muted)', marginBottom: 16 }}>
            {lang === 'en'
              ? 'You will leave the current game. This cannot be undone.'
              : 'Vas a salir de la partida en curso.'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onGoHome} style={{ flex: 1 }}>
              {lang === 'en' ? 'Leave' : 'Salir'}
            </Button>
            <Button variant="ghost" onClick={() => setShowLeaveConfirm(false)} style={{ flex: 1 }}>
              {lang === 'en' ? 'Stay' : 'Quedarse'}
            </Button>
          </div>
        </Modal>
      </div>
    );
  }

  // ── Desktop layout ────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid', gridTemplateColumns: '1fr 280px', gridTemplateRows: 'auto 1fr',
    }}>
      {/* Header */}
      <div style={{
        gridColumn: '1 / -1',
        padding: '12px 64px 12px 20px',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--c-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => setShowLeaveConfirm(true)} style={{ fontFamily: 'Fredoka One', fontSize: 20, color: 'var(--c-accent2)', cursor: 'pointer' }}>Wave</span>
          <span style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '2px 8px', fontSize: 11, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {game.mode}
          </span>
          {round && <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>{L.roundLabel(round.round_number)}</span>}
        </div>
        {round && (
          <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
            {game.win_condition === 'points' ? L.goalPts(game.win_value) : L.roundsGoal(round.round_number, game.win_value)}
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ padding: '28px 24px', overflow: 'auto' }}>
        {mainContent}
      </div>

      {/* Sidebar */}
      <div style={{ padding: '20px 18px', borderLeft: '1px solid var(--c-border)', overflowY: 'auto' }}>
        {sidebarContent}
      </div>

      <PowerCard />
      <ReactionBar />

      <Modal
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title={lang === 'en' ? '⚠ Leave game?' : '⚠ ¿Salir de la partida?'}
      >
        <p style={{ fontSize: 14, color: 'var(--c-muted)', marginBottom: 16 }}>
          {lang === 'en'
            ? 'You will leave the current game. This cannot be undone.'
            : 'Vas a salir de la partida en curso.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={onGoHome} style={{ flex: 1 }}>
            {lang === 'en' ? 'Leave' : 'Salir'}
          </Button>
          <Button variant="ghost" onClick={() => setShowLeaveConfirm(false)} style={{ flex: 1 }}>
            {lang === 'en' ? 'Stay' : 'Quedarse'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
