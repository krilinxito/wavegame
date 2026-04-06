import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import ClueGiving from '../components/round/ClueGiving';
import Guessing from '../components/round/Guessing';
import Revealing from '../components/round/Revealing';
import PowerCard from '../components/powers/PowerCard';
import Leaderboard from '../components/shared/Leaderboard';
import ReactionBar from '../components/shared/ReactionBar';
import Button from '../components/shared/Button';
import socket from '../socket';
import useGameStore from '../store/gameStore';
import { getPlayerColor } from '../components/shared/PlayerAvatar';

function GameOver({ gameOver, myPlayer, isHost, returnToLobby }) {
  const color = getPlayerColor(gameOver.winner?.id);
  const isWinner = gameOver.winner?.id === myPlayer?.id;

  useEffect(() => {
    if (isWinner) {
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)', padding: 24 }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontFamily: 'Fredoka One', fontSize: 14, color: 'var(--c-muted)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Ganador</div>
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
      {isHost
        ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}><Button onClick={returnToLobby} style={{ marginTop: 24 }}>Volver al lobby</Button></motion.div>
        : <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ marginTop: 20, color: 'var(--c-muted)', fontSize: 13 }}>Esperando al host...</motion.div>
      }
      <ReactionBar />
    </div>
  );
}

export default function Game() {
  const { round, game, myPlayer, players, gameOver, noCategories, revealData } = useGameStore();
  if (!game || !myPlayer) return null;

  const isHost = !!myPlayer.is_host;

  const advanceRound  = () => socket.emit('next_round',      { gameId: game.id });
  const requestReveal = () => socket.emit('request_reveal',  { roundId: round?.id });
  const returnToLobby = () => socket.emit('return_to_lobby', { gameId: game.id });

  if (gameOver) return <GameOver gameOver={gameOver} myPlayer={myPlayer} isHost={isHost} returnToLobby={returnToLobby} />;

  // No categories left
  if (noCategories) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)', gap: 20 }}>
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fredoka One', fontSize: 32, color: 'var(--c-accent2)', marginBottom: 8 }}>Sin más categorías</div>
          <div style={{ color: 'var(--c-muted)', fontSize: 15 }}>Se acabaron las cartas del mazo</div>
        </motion.div>
        {isHost
          ? <Button onClick={returnToLobby}>Volver al lobby</Button>
          : <div style={{ color: 'var(--c-muted)', fontSize: 13 }}>Esperando al host...</div>
        }
        <ReactionBar />
      </div>
    );
  }

  // Waiting
  if (!round) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'Fredoka One', fontSize: 20, color: 'var(--c-muted)' }}>Preparando ronda...</div>
      </div>
    );
  }

  const isRevealed = !!(revealData || ['revealing','scoring','done'].includes(round.status));

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--c-bg)',
      display: 'grid', gridTemplateColumns: '1fr 210px', gridTemplateRows: 'auto 1fr',
    }}>
      {/* Header */}
      <div style={{
        gridColumn: '1 / -1',
        padding: '12px 20px',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--c-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'Fredoka One', fontSize: 20, color: 'var(--c-accent2)' }}>Wave</span>
          <span style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', padding: '2px 8px', fontSize: 11, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {game.mode}
          </span>
          <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>Ronda {round.round_number}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
          {game.win_condition === 'points' ? `Meta: ${game.win_value} pts` : `${round.round_number} / ${game.win_value} rondas`}
        </div>
      </div>

      {/* Main */}
      <div style={{ padding: '28px 24px', overflow: 'auto' }}>
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
              {isHost && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                  style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}
                >
                  <Button onClick={advanceRound}>Siguiente ronda</Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {isHost && round.status === 'guessing' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <Button variant="ghost" onClick={requestReveal} size="sm">Revelar ahora</Button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ padding: '20px 14px', borderLeft: '1px solid var(--c-border)' }}>
        <Leaderboard compact />
      </div>

      <PowerCard />
      <ReactionBar />
    </div>
  );
}
