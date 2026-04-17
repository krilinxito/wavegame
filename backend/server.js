require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const { registerHandlers } = require('./handlers');
const { client: redis } = require('./cache/redis');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/games',   require('./routes/games'));
app.use('/api/players', require('./routes/players'));
app.use('/api/upload',  require('./routes/uploads'));

app.get('/api/health', async (_req, res) => {
  try {
    await redis.ping();
    res.json({ ok: true, store: 'redis' });
  } catch {
    res.status(503).json({ ok: false, error: 'Redis unreachable' });
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  registerHandlers(io, socket);
  socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Wave server on :${PORT}`));
