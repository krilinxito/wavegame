import { useState } from 'react';
import useGameStore from '../store/gameStore';

export function useRound() {
  const { round, myPlayer, myPower, activePowers, revealData } = useGameStore();
  const [myGuessPct, setMyGuessPct] = useState(0.5);
  const [submitted, setSubmitted] = useState(false);

  const isMyTurnPsychic = round && myPlayer && round.psychic_id === myPlayer.id;
  const isGuessing = round?.status === 'guessing' && !isMyTurnPsychic && !submitted;
  const isRevealing = revealData !== null;

  const myGuessResult = revealData?.guesses?.find(g => g.playerId === myPlayer?.id);
  const isBlocked = activePowers.some(p => p.powerName === 'bloqueo' && p.effect?.targetId === myPlayer?.id);

  return {
    isMyTurnPsychic,
    isGuessing: isGuessing && !isBlocked,
    isBlocked,
    isRevealing,
    myGuessPct,
    setMyGuessPct,
    submitted,
    setSubmitted,
    myGuessResult,
  };
}
