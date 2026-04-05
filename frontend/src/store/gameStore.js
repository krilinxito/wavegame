import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // State
  game: null,
  players: [],
  myPlayer: null,
  round: null,
  category: null,
  myPower: null,         // { roundPowerId, power }
  revealData: null,      // { targetPct, guesses, activePowers }
  gameOver: null,        // { winner, finalScores }
  categories: [],        // lobby categories list
  activePowers: [],      // powers activated this round (for UI display)
  submittedGuesses: [],  // { playerId, playerName, photoPath, guessPct } — real-time guesses

  // Actions
  setGame: (game) => set({ game }),
  setPlayers: (players) => set({ players }),
  setMyPlayer: (myPlayer) => set({ myPlayer }),
  setRound: (round) => set({ round }),
  setCategory: (category) => set({ category }),
  setMyPower: (myPower) => set({ myPower }),
  setRevealData: (revealData) => set({ revealData }),
  setGameOver: (gameOver) => set({ gameOver }),
  setCategories: (categories) => set({ categories }),

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
    round: null, category: null, myPower: null,
    revealData: null, activePowers: [], submittedGuesses: [],
  }),

  reset: () => set({
    game: null, players: [], myPlayer: null, round: null,
    category: null, myPower: null, revealData: null,
    gameOver: null, categories: [], activePowers: [],
  }),
}));

export default useGameStore;
