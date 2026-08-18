# wavegame

Juego de fiesta multijugador en tiempo real: un jugador ve dónde cae el objetivo en un dial y tiene que
dar **una sola pista** para que su equipo adivine la posición. Inspirado en Wavelength.

🔗 **[wavebyplebe.com](https://wavebyplebe.com)** — salas públicas, sin instalar nada.

---

## Cómo se juega

Cada ronda saca una categoría con dos extremos — *Temperatura: frío polar ←→ calor extremo* — y una
posición objetivo oculta en el dial. El **psíquico** ve el objetivo; el resto no. Da una pista y los
demás mueven el dial hasta donde creen que está.

La puntuación premia la precisión y castiga la distancia:

| Zona | Distancia al objetivo | Puntos |
|---|---|---|
| Centro | ≤ 2 % | +4 |
| Cerca | ≤ 5 % | +3 |
| Próximo | ≤ 10 % | +2 |
| Fallo corto | ≤ 20 % | −1 |
| Fallo medio | ≤ 35 % | −2 |
| Fallo largo | > 35 % | −3 |

Hay cinco **poderes** que se compran con puntos y cambian la ronda: `cuartiles` (revela en qué cuarto
del dial está el objetivo, pero sube la exigencia del acierto), `veneno`, `escudo`, `bloqueo` y
`switch`. Tres modos de juego —normal, por equipos y *basta*— e interfaz en español e inglés.

---

## Arquitectura

```
navegador  ──WebSocket──►  Socket.io  ──►  handlers/     lobby · round · powers
   React                                       │
   Vite                                        ▼
                                          services/      reglas del juego, sin I/O de red
                                          ├── roundService · roundStartService
                                          ├── scoringService · revealService
                                          ├── powerService
                                          └── gameService · playerService
                                               │
                                    ┌──────────┴──────────┐
                                    ▼                     ▼
                                  Redis                MariaDB
                            estado de sala en vivo   partidas, rondas,
                            (efímero, rápido)        puntajes, categorías
```

La separación importante es **handlers ↔ services**: los handlers solo traducen eventos de socket a
llamadas; toda la lógica del juego vive en `services/`, sin saber que existe una red. Eso permite
razonar sobre las reglas —y probarlas— sin levantar un socket.

**Redis para el estado vivo, MariaDB para lo que persiste.** El estado de una sala en curso cambia
muchas veces por segundo y no sobrevive a la partida; escribirlo en SQL sería desperdiciar disco y
latencia. Lo que sí importa después —resultados, puntajes, categorías creadas— va a MariaDB.

Unos 50 eventos de socket cubren el ciclo completo: `join_room`, `host_start_game`, `submit_clue`,
`submit_guess`, `request_reveal`, `round_revealed`, `power_activated`, `game_over`.

---

## Stack

Node.js · Express 5 · Socket.io 4 · ioredis · MariaDB 11 · Multer · React · Vite · Docker Compose

## Cómo correrlo

```bash
docker compose up -d          # levanta MariaDB con el esquema y el seed

cd backend
npm install
cat > .env <<'ENV'            # crear el .env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
DB_HOST=localhost
DB_PORT=3306
DB_USER=wave
DB_PASSWORD=wavedev
DB_NAME=wave_game
REDIS_URL=redis://localhost:6379
ENV
npm run seed                  # categorías por defecto
npm run dev                   # API + WebSocket en :3001

cd ../frontend
npm install && npm run dev
```

## Estructura

```
backend/
├── server.js      Express + Socket.io
├── handlers/      lobby.js · round.js · powers.js
├── services/      reglas del juego
├── cache/         redis.js · powers.js
├── routes/        games · players · uploads
└── db/            schema.sql · seed.sql
frontend/src/
├── components/    spectrum/ · round/ · powers/ · shared/
├── hooks/         useSocket · useRound · useLocalPlayer
└── data/          categorías y retos por defecto
```
