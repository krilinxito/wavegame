import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // State
  game: null,
  players: [],
  myPlayer: null,
  round: null,
  category: null,
  myPowers: [],          // [{ roundPowerId, power, isFree, purchased, queued }] — hasta 3
  revealData: null,      // { targetPct, guesses, activePowers }
  gameOver: null,        // { winner, finalScores, stats }
  gameStats: null,       // { [playerId]: { bullseyes, bestDelta, roundsAsPsychic } }
  noCategories: false,
  categories: [],        // lobby categories list
  challenges: [],        // lobby challenges list
  activePowers: [],      // powers activated this round (for UI display)
  submittedGuesses: [],  // { playerId, playerName, photoPath, guessPct } — real-time guesses
  skipVotes: [],         // playerIds que votaron skipear la categoría actual
  // Teams mode parallel rounds
  teamRounds: {},        // { [teamNum]: { round, category, revealData, submittedGuesses } }
  allTeamRoundsDone: false,
  joinedMidRound: false, // true si se unió mientras había una ronda activa

  // Actions
  setGame: (game) => set({ game }),
  setPlayers: (players) => set({ players }),
  setMyPlayer: (myPlayer) => set({ myPlayer }),
  setRound: (round) => set({ round }),
  setCategory: (category) => set({ category }),
  setMyPowers: (myPowers) => set({ myPowers }),
  setRevealData: (revealData) => set({ revealData }),
  setGameOver: (gameOver, stats) => set({ gameOver, gameStats: stats ?? null }),
  setCategories: (categories) => set({ categories }),
  setChallenges: (challenges) => set({ challenges }),

  addChallenge: (challenge) => set(state => ({
    challenges: [...state.challenges.filter(c => c.id !== challenge.id), challenge],
  })),
  removeChallenge: (challengeId) => set(state => ({
    challenges: state.challenges.filter(c => c.id !== challengeId),
  })),
  setSkipVotes: (skipVotes) => set({ skipVotes }),

  updatePlayer: (player) => set(state => ({
    players: state.players.map(p => p.id === player.id ? player : p),
    myPlayer: state.myPlayer?.id === player.id ? player : state.myPlayer,
  })),

  addPlayer: (player) => set(state => ({
    players: [...state.players.filter(p => p.id !== player.id), player],
  })),

  removePlayer: (playerId) => set(state => ({
    players: state.players.filter(p => p.id !== playerId),
  })),

  updateScores: (players) => set({ players }),

  addCategory: (category) => set(state => ({
    categories: [...state.categories, category],
  })),

  removeCategory: (categoryId) => set(state => ({
    categories: state.categories.filter(c => c.id !== categoryId),
  })),

  addActivePower: (powerData) => set(state => ({
    activePowers: [...state.activePowers, powerData],
  })),

  addSubmittedGuess: (guess) => set(state => ({
    submittedGuesses: [...state.submittedGuesses.filter(g => g.playerId !== guess.playerId), guess],
  })),

  clearRound: () => set({
    round: null, category: null, myPowers: [],
    revealData: null, activePowers: [], submittedGuesses: [],
    skipVotes: [], teamRounds: {}, allTeamRoundsDone: false,
    joinedMidRound: false,
  }),

  reset: () => set({
    game: null, players: [], myPlayer: null, round: null,
    category: null, myPowers: [],
    revealData: null, gameOver: null, gameStats: null, noCategories: false, categories: [], challenges: [], activePowers: [],
    skipVotes: [], teamRounds: {}, allTeamRoundsDone: false,
    joinedMidRound: false,
  }),
}));

export default useGameStore;
